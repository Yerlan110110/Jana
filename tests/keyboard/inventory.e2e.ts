import { mkdir, writeFile } from "node:fs/promises";
import { test, type Browser } from "@e2e-dev/web";
import { expect, type App, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { viewsFor, type View } from "../visual/views.js";
import { tabCycle } from "./focus.js";

async function inspect({ app, browser, screen, views }: { app: App; browser: Browser; screen: Screen; views: View[] }) {
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/keyboard-${Date.now()}-${views[0]?.id}`;
  await mkdir(directory, { recursive: true });
  const native = process.env.JANAMEN_ZOOM_FACTOR === "2";
  for (const view of views) {
    for (const width of native ? [null] : [1280, 320]) {
      if (width !== null) await browser.setViewport({ width, height: 800 });
      await app.open(view.path);
      await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      await expect(screen.getByRole("alert")).toHaveCount(0);
      await browser.evaluate(() => document.fonts.ready.then(() => true));
      const positiveTabIndexes = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[tabindex]")).filter(element => element.tabIndex > 0).map(element => element.tagName));
      const stops = await tabCycle(browser);
      const failures = stops.filter(stop => {
        const nativeDateFocus = (stop.inputType === "date" || stop.inputType === "datetime-local") && stop.focusWithin;
        return (!stop.focusVisible && !nativeDateFocus) || !stop.exposed || stop.outline === "none" || stop.outlineWidth < 2 || stop.outlineColor === "rgba(0, 0, 0, 0)";
      });
      await writeFile(`${directory}/${view.id}-${width ?? "zoom-200"}.json`, JSON.stringify({ view, width, positiveTabIndexes, stops, failures }, null, 2) + "\n", { flag: "wx" });
      expect.soft(positiveTabIndexes, `${view.id} positive tabindex`).toEqual([]);
      expect.soft(stops.length, `${view.id} reachable controls`).toBeGreaterThan(0);
      expect.soft(failures, `${view.id} focus at ${width ?? "zoom-200"}`).toEqual([]);
    }
  }
}

test("S01 sign-in keyboard cycle", async ({ app, browser, screen }) => {
  await inspect({ app, browser, screen, views: [{ id: "S01", path: "/login", ready: "Войдите в JanaMen", state: "empty sign-in form" }] });
});

for (const role of ["employee", "manager", "hr"] as const) {
  test(`${role} normal-state keyboard inventory`, { session: `visual-${role}`, timeout: 240_000 }, async ({ app, browser, screen }) => {
    if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
    const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
    await inspect({ app, browser, screen, views: await viewsFor(client, role) });
  });
}
