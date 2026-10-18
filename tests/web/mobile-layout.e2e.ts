import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { signIn } from "./support.js";

test("mobile request screens fill the viewport without clipping navigation", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  for (const width of [320, 390, 768]) {
    await browser.setViewport({ width, height: 900 });
    for (const route of ["/requests", "/requests/new"]) {
      await app.open(route);
      await expect(screen.getByRole("button", "Открыть навигацию", { exact: true })).toBeVisible();
      const geometry = await browser.evaluate(() => {
        const shell = document.querySelector(".app-layout");
        const menu = document.querySelector('[aria-controls="mobile-navigation"]');
        if (!shell || !menu) throw new Error("Application shell or navigation is missing");
        const bounds = shell.getBoundingClientRect();
        const control = menu.getBoundingClientRect();
        return {
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
          left: bounds.left,
          right: bounds.right,
          menuLeft: control.left,
          menuRight: control.right,
          menuHeight: control.height,
        };
      });
      expect(geometry.left).toBe(0);
      expect(Math.abs(geometry.right - geometry.viewport)).toBeLessThanOrEqual(1);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.menuLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.menuRight).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.menuHeight).toBeLessThanOrEqual(60);
    }
  }
});
