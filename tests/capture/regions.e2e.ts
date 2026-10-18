import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "../web/api.js";
import { data } from "../visual/views.js";
import { captureOwnedViewport } from "../zoom/capture.js";

test("compare incomplete capture regions against owned viewport and painted frames", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  const root = process.env.JANAMEN_CAPTURE_ROOT;
  if (!root || !app.baseUrl) throw new Error("Select the owned capture fixture");
  await mkdir(root, { recursive: true });
  const native = process.env.JANAMEN_ZOOM_FACTOR === "2";
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const requests = data(await client.GET("/api/v1/requests/", { params: { query: { status: "returned", page_size: 100 } } }));
  const returned = requests.results[0];
  if (!returned) throw new Error("The real returned fixture is required");
  if (!native) await browser.setViewport({ width: 320, height: 800 });
  const path = native ? `/requests/${returned.id}` : "/notifications";
  await app.open(path);
  await expect(screen.getByRole("heading", native ? "Причина возврата" : "Уведомления", { exact: true })).toBeVisible();
  await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
  await browser.evaluate(() => document.fonts.ready.then(() => true));
  await browser.evaluate((top) => { window.scrollTo({ top, behavior: "instant" }); return true; }, native ? 0 : 1400);
  const rows = [];
  for (const phase of ["immediate", "painted"] as const) {
    if (phase === "painted") await browser.evaluate(() => new Promise<boolean>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
    }));
    const geometry = await browser.evaluate(() => ({
      width: innerWidth, height: visualViewport?.height ?? innerHeight, dpr: devicePixelRatio, scrollY,
      visibility: document.visibilityState,
      headers: Array.from(document.querySelectorAll("header")).map((element) => {
        const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
        return { x: box.x, y: box.y, width: box.width, height: box.height, display: style.display, visibility: style.visibility, opacity: style.opacity };
      }),
    }));
    const ordinary = await app.screenshot(`region-${native ? "zoom" : "320"}-${phase}`);
    const owned = await captureOwnedViewport(browser, `${root}/${phase}.png`);
    rows.push({ phase, geometry, ordinary, owned });
  }
  await writeFile(`${root}/comparison.json`, JSON.stringify({ path, native, rows }, null, 2) + "\n", { flag: "wx" });
});
