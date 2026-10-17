import { mkdir, writeFile } from "node:fs/promises";
import { test, type Browser } from "@e2e-dev/web";
import { expect, type App, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { auditPage } from "./audit.js";
import { viewsFor, type View } from "./views.js";

async function capture({ app, browser, screen, views }: {
  app: App;
  browser: Browser;
  screen: Screen;
  views: View[];
}) {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `.artifacts/visual/inventory-${Date.now()}-${views[0]?.id}`;
  await mkdir(directory, { recursive: true });
  for (const view of views) {
    for (const width of [1280, 1440, 768, 390, 320]) {
      await browser.setViewport({ width, height: 800 });
      await app.open(view.path);
      await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      await browser.evaluate(() => document.fonts.ready.then(() => true));
      const audit = await browser.evaluate(auditPage);
      const geometry = await browser.evaluate(() => ({
        width: innerWidth,
        content: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      const segments = [];
      for (let top = 0; top < geometry.height; top += 700) {
        await browser.evaluate((position) => {
          window.scrollTo({ top: position, behavior: "instant" });
          return true;
        }, top);
        const offset = await browser.evaluate(() => scrollY);
        const screenshot = await app.screenshot(`${view.id}-${width}-${offset}`);
        segments.push({ offset, screenshot });
        if (offset + 800 >= geometry.height) break;
      }
      await writeFile(`${directory}/${view.id}-${width}.json`, JSON.stringify({
        view, width, geometry, audit, segments,
      }, null, 2) + "\n", { flag: "wx" });
      expect.soft(audit.unresolved, `${view.id} at ${width}`).toEqual([]);
      expect.soft(geometry.content, `${view.id} document width at ${width}`).toBeLessThanOrEqual(width);
    }
  }
}

test("S01 sign-in entry", async ({ app, browser, screen }) => {
  await capture({ app, browser, screen, views: [
    { id: "S01", path: "/login", ready: "Войдите в JanaMen", state: "unauthenticated sign-in form" },
  ] });
});

for (const role of ["employee", "manager", "hr"] as const) {
  test(`${role} inventory at supported widths`, { session: `visual-${role}` }, async ({ app, browser, screen }) => {
    if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
    const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
    await capture({ app, browser, screen, views: await viewsFor(client, role) });
  });
}
