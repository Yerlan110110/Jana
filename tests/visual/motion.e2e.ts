import { mkdir, writeFile } from "node:fs/promises";
import { test, type Browser } from "@e2e-dev/web";
import { expect } from "e2e";

async function activeState(browser: Browser) {
  return browser.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) throw new Error("Keyboard focus has no element");
    const style = getComputedStyle(element);
    return {
      name: element.textContent?.trim() ?? "",
      tag: element.tagName,
      focusVisible: element.matches(":focus-visible"),
      transform: style.transform,
      translate: style.translate,
      duration: style.transitionDuration,
      runningAnimations: element.getAnimations().filter(animation => animation.playState === "running").length,
      outline: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
}

async function tabTo(browser: Browser, name: string) {
  for (let step = 0; step < 80; step += 1) {
    await browser.keyboard.press("Tab");
    const state = await activeState(browser);
    if (state.tag === "BUTTON" && state.name === name) return state;
  }
  throw new Error(`Keyboard navigation did not reach ${name}`);
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`action feedback respects keyboard and ${reducedMotion}`, { session: "visual-employee" }, async ({ app, browser, screen }) => {
    await browser.emulateMedia({ reducedMotion });
    await app.open("/assistant");
    await expect(screen.getByRole("heading", "Что вы хотите узнать?", { level: 2 })).toBeVisible();
    await browser.evaluate(() => document.fonts.ready.then(() => true));
    const name = "Что делать, если заявку вернули?";
    const focused = await tabTo(browser, name);
    expect(focused.focusVisible).toBe(true);
    expect(focused.outline).toBe("solid");
    expect(Number.parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
    const blurredAnimations = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".action-button"))
      .filter(element => !element.matches(":focus-visible"))
      .filter(element => element.getAnimations().some(animation => animation.playState === "running"))
      .map(element => element.textContent?.trim() ?? ""));
    expect.soft(blurredAnimations).toEqual([]);
    let keyboard: Awaited<ReturnType<typeof activeState>> | null = null;
    await browser.keyboard.down("Space");
    try {
      keyboard = await activeState(browser);
      expect.soft(keyboard.transform).toBe("none");
      expect.soft(keyboard.translate).toBe("none");
      expect.soft(keyboard.runningAnimations).toBe(0);
    } finally {
      await browser.keyboard.up("Space");
    }
    await expect(screen.getByLabel("Ваш вопрос")).toHaveValue(name);
    const pointerName = "Как подать заявление на отпуск?";
    const button = screen.getByRole("button", pointerName);
    const bounds = await button.boundingBox();
    if (!bounds) throw new Error("The real suggestion button has no bounds");
    await browser.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    let pointer: Awaited<ReturnType<typeof activeState>> | null = null;
    let screenshot: string | undefined;
    await browser.mouse.down();
    try {
      await browser.evaluate(async () => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) throw new Error("Pointer focus is missing");
        await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
        return true;
      });
      pointer = await activeState(browser);
      expect(pointer.focusVisible).toBe(false);
      expect.soft(pointer.translate).toBe("none");
      expect.soft(pointer.transform).toBe(reducedMotion === "reduce" ? "none" : "matrix(0.96, 0, 0, 0.96, 0, 0)");
      if (reducedMotion === "no-preference") expect.soft(pointer.duration).toBe("0.15s");
      screenshot = await app.screenshot(`button-press-${reducedMotion}`);
    } finally {
      await browser.mouse.up();
    }
    await expect(screen.getByLabel("Ваш вопрос")).toHaveValue(pointerName);
    await browser.evaluate(async () => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) throw new Error("Pointer focus is missing");
      await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
      return true;
    });
    const released = await activeState(browser);
    expect(released.transform).toBe("none");
    expect(released.translate).toBe("none");
    const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual";
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/button-motion-${reducedMotion}-${Date.now()}.json`, JSON.stringify({ reducedMotion, focused, keyboard, pointer, released, screenshot }, null, 2) + "\n", { flag: "wx" });
  });
}
