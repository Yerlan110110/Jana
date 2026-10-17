import { mkdir } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { captureNativeViewport } from "./capture.js";

test("capture the sign-in action at native zoom after scrolling", async ({ app, browser, screen }) => {
  await app.open("/login");
  const action = screen.getByRole("button", "Войти", { exact: true });
  await expect(action).toBeVisible();
  await browser.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); return true; });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/native-capture-${Date.now()}`;
  await mkdir(directory, { recursive: true });
  await captureNativeViewport(browser, `${directory}/sign-in-action.png`);
});
