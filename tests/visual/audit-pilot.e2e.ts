import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { auditPage } from "./audit.js";

test(
  "employee entry views retain readable accessible controls at 1280 and 320",
  { session: "visual-employee" },
  async ({ app, browser, screen }) => {
    await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
    const observations = [];
    for (const view of [
      { id: "S02", path: "/", heading: "Ваш отпуск" },
      { id: "S03", path: "/profile", heading: "Кадровые данные" },
      { id: "S06", path: "/requests/new?type=advance", heading: "Данные заявления" },
    ]) {
      for (const width of [1280, 320]) {
        await browser.setViewport({ width, height: 800 });
        await app.open(view.path);
        await expect(screen.getByRole("heading", view.heading)).toBeVisible();
        await expect(screen.getByRole("link", "JanaMen, главная", { visible: true })).toHaveCount(1);
        await browser.evaluate(() => document.fonts.ready.then(() => true));
        const audit = await browser.evaluate(auditPage);
        const geometry = await browser.evaluate(() => ({
          width: innerWidth,
          content: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }));
        const screenshot = await app.screenshot(`${view.id}-${width}`);
        observations.push({ view: view.id, width, audit, geometry, screenshot });
        expect.soft(audit.unresolved, `${view.id} at ${width}`).toEqual([]);
        expect.soft(geometry.content, `${view.id} page width at ${width}`).toBeLessThanOrEqual(width);
      }
    }
    await mkdir(".artifacts/visual", { recursive: true });
    await writeFile(
      `.artifacts/visual/audit-pilot-${Date.now()}.json`,
      JSON.stringify(observations, null, 2) + "\n",
      { flag: "wx" },
    );
  },
);
