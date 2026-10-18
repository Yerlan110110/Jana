import { mkdir, writeFile } from "node:fs/promises";
import { test, type Browser } from "@e2e-dev/web";
import { expect, type App, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { auditPage } from "./audit.js";
import { viewsFor, type View } from "./views.js";
import { captureOwnedViewport } from "../zoom/capture.js";

export type RenderCase = { kind: "viewport"; width: number } | { kind: "native-zoom"; factor: 2 };

export async function capturePreparedPage({ app, browser, view, environment, directory }: {
  app: App;
  browser: Browser;
  view: View;
  environment: RenderCase;
  directory: string;
}) {
  const name = environment.kind === "viewport" ? String(environment.width) : "zoom-200";
  await mkdir(directory, { recursive: true });
  await browser.evaluate(() => document.fonts.ready.then(() => true));
  await browser.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  });
  const audit = await browser.evaluate(auditPage);
  const geometry = await browser.evaluate(() => ({
    width: innerWidth,
    viewportHeight: visualViewport?.height ?? innerHeight,
    dpr: devicePixelRatio,
    outerWidth,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    visualScale: visualViewport?.scale ?? null,
    auditScrollY: scrollY,
    content: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  if (environment.kind === "native-zoom") {
    expect(geometry.dpr).toBe(environment.factor);
    expect(geometry.width * environment.factor).toBe(geometry.outerWidth);
    expect(geometry.cssZoom).toBe("1");
    expect(geometry.visualScale).toBe(1);
  } else {
    expect(geometry.width).toBe(environment.width);
    expect(geometry.dpr).toBe(1);
    expect(geometry.cssZoom).toBe("1");
    expect(geometry.visualScale).toBe(1);
  }
  const segments = [];
  for (let top = 0; top < geometry.height; top += Math.max(1, geometry.viewportHeight - 100)) {
    await browser.evaluate((position) => {
      window.scrollTo({ top: position, behavior: "instant" });
      return true;
    }, top);
    const offset = await browser.evaluate(() => scrollY);
    const image = environment.kind === "native-zoom"
      ? await captureOwnedViewport(browser, `${directory}/${view.id}-${name}-${offset}.png`)
      : { screenshot: await app.screenshot(`${view.id}-${name}-${offset}`) };
    segments.push({ offset, ...image });
    if (offset + geometry.viewportHeight >= geometry.height) break;
  }
  await writeFile(`${directory}/${view.id}-${name}.json`, JSON.stringify({
    view, environment, width: geometry.width, geometry, audit, segments,
  }, null, 2) + "\n", { flag: "wx" });
  expect.soft(audit.unresolved, `${view.id} at ${name}`).toEqual([]);
  expect.soft(geometry.content, `${view.id} document width at ${name}`).toBeLessThanOrEqual(geometry.width);
}

async function capture({ app, browser, screen, views, cases }: {
  app: App;
  browser: Browser;
  screen: Screen;
  views: View[];
  cases: readonly RenderCase[];
}) {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/inventory-${Date.now()}-${views[0]?.id}`;
  await mkdir(directory, { recursive: true });
  for (const view of views) {
    for (const environment of cases) {
      if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
      await app.open(view.path);
      await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      await expect(screen.getByRole("alert")).toHaveCount(0);
      await capturePreparedPage({ app, browser, view, environment, directory });
    }
  }
}

export function inventoryTests(cases: readonly RenderCase[]) {
  test("S01 sign-in entry", async ({ app, browser, screen }) => {
    await capture({ app, browser, screen, cases, views: [
      { id: "S01", path: "/login", ready: "Войдите в JanaMen", state: "unauthenticated sign-in form" },
    ] });
  });
  for (const role of ["employee", "manager", "hr"] as const) {
    test(`${role} inventory at supported environments`, { session: `visual-${role}` }, async ({ app, browser, screen }) => {
      if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
      const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
      await capture({ app, browser, screen, cases, views: await viewsFor(client, role) });
    });
  }
}
