import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { paint, contrast } from "./paint.js";

test(
  "employee home has readable primary links at rest and on hover",
  { session: "visual-employee" },
  async ({ app, screen, browser }) => {
    await app.open("/");
    await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
    await expect(screen.getByRole("heading", "Ваш отпуск")).toBeVisible();
    await expect(screen.getByRole("heading", "Моё обучение")).toBeVisible();
    await browser.evaluate(() => document.fonts.ready.then(() => true));
    const primary = await browser.evaluate(paint, { selector: "a.action-button.bg-primary", property: "color" });
    expect(primary.length).toBeGreaterThan(0);
    for (const action of primary) expect(contrast(action)).toBeGreaterThanOrEqual(4.5);
    await screen.getByRole("link", "Создать заявку").hover();
    await browser.evaluate(async () => {
      const action = document.querySelector("a.action-button.bg-primary:hover");
      await Promise.all((action?.getAnimations() ?? []).map((animation) => animation.finished));
      return true;
    });
    const hovered = await browser.evaluate(paint, { selector: "a.action-button.bg-primary:hover", property: "color" });
    expect(hovered).toHaveLength(1);
    expect(contrast(hovered[0])).toBeGreaterThanOrEqual(4.5);
    const dimensions = await browser.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    await app.screenshot("employee-home-1280");
  },
);

test(
  "enabled form controls have distinguishable boundaries",
  { session: "visual-employee" },
  async ({ app, screen, browser }) => {
    await app.open("/requests/new?type=advance");
    await expect(screen.getByRole("button", "Сохранить черновик")).toBeVisible();
    const boundaries = await browser.evaluate(paint, {
      selector: "input, textarea",
      property: "borderTopColor",
    });
    expect(boundaries).toHaveLength(3);
    for (const boundary of boundaries) {
      expect(contrast(boundary), boundary.name).toBeGreaterThanOrEqual(3);
    }
    await screen.getByRole("textbox", "Причина").hover();
    await browser.evaluate(async () => {
      await Promise.all(document.querySelector("textarea")?.getAnimations().map((animation) => animation.finished) ?? []);
      return true;
    });
    const hovered = await browser.evaluate(paint, { selector: "textarea:hover", property: "borderTopColor" });
    expect(hovered).toHaveLength(1);
    expect(contrast(hovered[0]), "Reason boundary on hover").toBeGreaterThanOrEqual(3);
  },
);
