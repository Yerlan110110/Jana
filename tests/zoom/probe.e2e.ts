import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("observe native browser zoom before accepting its test method", async ({ app, browser, screen }) => {
  const factor = process.env.JANAMEN_ZOOM_FACTOR;
  if (factor !== "1" && factor !== "2") throw new Error("The owned launcher must declare zoom factor 1 or 2");
  await app.open("/login");
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  const metrics = await browser.evaluate(() => ({
    dpr: devicePixelRatio,
    innerWidth,
    outerWidth,
    visualWidth: visualViewport?.width ?? null,
    visualScale: visualViewport?.scale ?? null,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    bodyFont: getComputedStyle(document.body).fontSize,
    documentWidth: document.documentElement.scrollWidth,
  }));
  const screenshot = await app.screenshot("native-zoom-probe");
  const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual";
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/zoom-probe-${Date.now()}.json`, JSON.stringify({ metrics, screenshot }, null, 2) + "\n", { flag: "wx" });
  expect(metrics.dpr).toBe(Number(factor));
  expect(metrics.innerWidth * Number(factor)).toBe(metrics.outerWidth);
  expect(metrics.visualScale).toBe(1);
  expect(metrics.cssZoom).toBe("1");
});
