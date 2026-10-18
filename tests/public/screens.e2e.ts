import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "../web/api.js";
import { viewsFor } from "../visual/views.js";

for (const role of ["employee", "manager", "hr"] as const) {
  test(`${role} actual public screens for defense`, { session: `visual-${role}` }, async ({ app, browser, screen }) => {
    if (!app.baseUrl || new URL(app.baseUrl).protocol !== "https:" || new URL(app.baseUrl).hostname !== process.env.PUBLIC_HOST || process.env.JANAMEN_PUBLIC_PROJECT !== "janamen-public") {
      throw new Error("Defense captures require the selected synthetic public demo");
    }
    const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
    const selected = new Set(["S02", "S07", "S08", "S14", "S16", "S21", "S22", "S23", "S09", "S29", "S30", "S31"]);
    const views = (await viewsFor(client, role)).filter(view => selected.has(view.id));
    const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/defense";
    await mkdir(directory, { recursive: true });
    for (const view of views) {
      await browser.setViewport({ width: 1280, height: 800 });
      await app.open(view.path);
      await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      await browser.evaluate(() => document.fonts.ready.then(() => true));
      const geometry = await browser.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, dpr: devicePixelRatio }));
      expect(geometry).toEqual({ width: 1280, content: 1280, dpr: 1 });
      const screenshot = await app.screenshot(`${view.id}-public-defense`);
      await writeFile(`${directory}/${view.id}.json`, JSON.stringify({ origin: new URL(app.baseUrl).origin, role, view, geometry, screenshot }, null, 2) + "\n", { flag: "wx" });
    }
  });
}
