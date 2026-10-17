import { test } from "@e2e-dev/web";
import { expect } from "e2e";

function actionPaint(selector: string) {
  return [...document.querySelectorAll(selector)].map((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser cannot measure rendered colors");
    const ancestors = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      ancestors.unshift(node);
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, 1, 1);
    for (const node of ancestors) {
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
    }
    const background = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const foreground = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    return { background, foreground };
  });
}

function contrast({ background, foreground }: ReturnType<typeof actionPaint>[number]) {
  function luminance(rgb: number[]) {
    const channels = rgb.map((value) => {
      const linear = value / 255;
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const first = luminance(background);
  const second = luminance(foreground);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test(
  "employee home has readable primary links at rest and on hover",
  { session: "visual-employee" },
  async ({ app, screen, browser }) => {
    await app.open("/");
    await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
    await expect(screen.getByRole("heading", "Ваш отпуск")).toBeVisible();
    await expect(screen.getByRole("heading", "Моё обучение")).toBeVisible();
    await browser.evaluate(() => document.fonts.ready.then(() => true));
    const primary = await browser.evaluate(actionPaint, "a.action-button.bg-primary");
    expect(primary.length).toBeGreaterThan(0);
    for (const action of primary) expect(contrast(action)).toBeGreaterThanOrEqual(4.5);
    await screen.getByRole("link", "Создать заявку").hover();
    await browser.evaluate(async () => {
      const action = document.querySelector("a.action-button.bg-primary:hover");
      await Promise.all((action?.getAnimations() ?? []).map((animation) => animation.finished));
      return true;
    });
    const hovered = await browser.evaluate(actionPaint, "a.action-button.bg-primary:hover");
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
