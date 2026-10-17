import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { captureOwnedViewport } from "../zoom/capture.js";

test("record ordinary and owned visible captures after scrolling", async ({ app, browser, screen }) => {
  const root = process.env.JANAMEN_CAPTURE_ROOT;
  if (!root) throw new Error("An owned capture output is required");
  await mkdir(root, { recursive: true });
  const rows = [];
  for (const width of [1280, 320]) {
    await browser.setViewport({ width, height: 800 });
    await app.open("/licenses/");
    await expect(screen.getByRole("heading", "Исходный код и лицензии")).toBeVisible();
    for (const mode of ["top", "keyboard-end", "scroll-to-end"]) {
      if (mode === "keyboard-end") await browser.keyboard.press("Control+End");
      if (mode === "scroll-to-end") await browser.evaluate(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
        return true;
      });
      const geometry = await browser.evaluate(() => {
        const rectangle = document.querySelector("main > p:last-child")?.getBoundingClientRect();
        return {
          width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollY,
          visual: visualViewport ? { pageTop: visualViewport.pageTop, offsetTop: visualViewport.offsetTop, height: visualViewport.height, scale: visualViewport.scale } : null,
          documentHeight: document.documentElement.scrollHeight,
          finalParagraph: rectangle ? { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, top: rectangle.top, bottom: rectangle.bottom } : null,
        };
      });
      expect(geometry.width).toBe(width);
      const ordinary = await app.screenshot(`ordinary-${width}-${mode}`);
      const native = await captureOwnedViewport(browser, `${root}/native-${width}-${mode}.png`);
      const afterCapture = await browser.evaluate(() => ({ scrollY, pageTop: visualViewport?.pageTop ?? null }));
      rows.push({ width, mode, geometry, ordinary, native, afterCapture });
    }
  }
  await writeFile(`${root}/comparison.json`, JSON.stringify(rows, null, 2) + "\n", { flag: "wx" });
});

test("owned capture refuses a populated password field", async ({ app, browser, screen }) => {
  const root = process.env.JANAMEN_CAPTURE_ROOT;
  if (!root) throw new Error("An owned capture output is required");
  await app.open("/login");
  await screen.getByLabel("Пароль").fill("synthetic-capture-canary");
  let rejection: unknown;
  try {
    await captureOwnedViewport(browser, `${root}/must-not-capture-password.png`);
  } catch (error) {
    rejection = error;
  }
  if (!(rejection instanceof Error)) throw new Error("The populated password capture did not refuse");
  expect(rejection.message).toBe("Viewport screenshots refuse populated password fields");
  expect(existsSync(`${root}/must-not-capture-password.png`)).toBe(false);
});
