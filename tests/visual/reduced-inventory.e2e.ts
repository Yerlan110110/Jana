import { mkdir, writeFile } from "node:fs/promises";
import { test, type Browser } from "@e2e-dev/web";
import { expect, type App, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { viewsFor, type View } from "./views.js";

async function motionState(browser: Browser) {
  return browser.evaluate(() => ({
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    viewport: { width: innerWidth, height: innerHeight },
    running: document.getAnimations().filter((animation) => animation.playState === "running").map((animation) => ({
      id: animation.id,
      frames: animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes().map((frame) => ({
        offset: frame.computedOffset, easing: frame.easing, transform: String(frame.transform ?? "none"), opacity: String(frame.opacity ?? "1"),
      })) : [],
    })),
    controls: Array.from(document.querySelectorAll<HTMLElement>(".action-button,.wait-spinner,[data-slot=skeleton]"))
      .map((element) => {
        const style = getComputedStyle(element);
        return { tag: element.tagName, name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "", animation: style.animationName, duration: style.transitionDuration, transform: style.transform };
      }),
  }));
}

async function inspect({ app, browser, screen, views }: { app: App; browser: Browser; screen: Screen; views: View[] }) {
  await browser.emulateMedia({ reducedMotion: "reduce" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/reduced-${Date.now()}-${views[0]?.id}`;
  await mkdir(directory, { recursive: true });
  for (const view of views) {
    await app.open(view.path);
    await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
    await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
    const idle = await motionState(browser);
    expect.soft(idle.reduced).toBe(true);
    expect.soft(idle.running, `${view.id} loaded animations`).toEqual([]);
    expect.soft(idle.controls.filter((control) => control.animation !== "none" || control.duration.split(",").some((duration) => ![0, 0.000001].includes(Number.parseFloat(duration)))), `${view.id} moving controls`).toEqual([]);
    await writeFile(`${directory}/${view.id}.json`, JSON.stringify({ view, idle, scope: "loaded state and rendered shared controls; open disclosures and pending commands are separate" }, null, 2) + "\n", { flag: "wx" });
  }
}

test("S01 reduced-motion sign-in state", async ({ app, browser, screen }) => {
  await inspect({ app, browser, screen, views: [{ id: "S01", path: "/login", ready: "Войдите в JanaMen", state: "empty sign-in" }] });
});

for (const role of ["employee", "manager", "hr"] as const) {
  test(`${role} reduced-motion loaded inventory`, { session: `visual-${role}`, timeout: 240_000 }, async ({ app, browser, screen }) => {
    if (!app.baseUrl) throw new Error("Select the synthetic fixture");
    const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
    await inspect({ app, browser, screen, views: await viewsFor(client, role) });
  });
}

test("reduced-motion loading skeleton keeps its semantic status without animation", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  await browser.emulateMedia({ reducedMotion: "reduce" });
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await browser.route("**/api/v1/academy/courses/?**", async (route) => { await held; await route.continue(); });
  try {
    await app.open("/academy/catalog");
    await expect(screen.getByRole("status", "Загружаем данные")).toBeVisible();
    const pending = await motionState(browser);
    expect(pending.reduced).toBe(true);
    expect(pending.running).toEqual([]);
    const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual";
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/reduced-loading-${Date.now()}.json`, JSON.stringify(pending, null, 2) + "\n", { flag: "wx" });
  } finally {
    release?.();
    await browser.unroute("**/api/v1/academy/courses/?**");
  }
  await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
  await expect(screen.getByRole("heading", "Каталог курсов")).toBeVisible();
});
