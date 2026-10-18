import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("source and bundled license texts are reachable before sign-in", async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
  const origin = new URL(app.baseUrl).origin;
  for (const width of [1280, 320]) {
    await browser.setViewport({ width, height: 800 });
    await app.open("/login");
    if (width === 1280) await screen.getByRole("button", "Пропустить", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
    await screen.getByRole("link", "Исходный код и лицензии", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Исходный код и лицензии", { exact: true })).toBeVisible();
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await app.screenshot(`licenses-${width}-top`);
    await browser.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      return true;
    });
    const paragraph = await browser.locator("main > p:last-child").boundingBox();
    if (!paragraph) throw new Error("The final notice paragraph has no bounds");
    expect(paragraph.y).toBeGreaterThanOrEqual(0);
    expect(paragraph.y + paragraph.height).toBeLessThanOrEqual(800);
    await expect(screen.getByRole("link", "Лицензия шрифта Geist Mono")).toBeVisible();
    await app.screenshot(`licenses-${width}-bottom`);
    const links = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>("main a[href]")).map(link => link.href));
    expect(links).toContain("https://github.com/Yerlan110110/Jana");
    for (const url of links.filter(link => link.startsWith(`${origin}/licenses/`))) {
      const response = await fetch(url);
      expect(response.status, url).toBe(200);
      const text = await response.text();
      expect(text.trim().length, url).toBeGreaterThan(100);
      expect(text.trim().startsWith("<!doctype"), `${url} must serve the license rather than SPA fallback`).toBe(false);
    }
    const dependencyText = await (await fetch(`${origin}/licenses/dependencies.md`)).text();
    expect(dependencyText).toContain("## react - 19.3.1 (MIT)");
    expect(dependencyText).toContain("Copyright (c) Meta Platforms, Inc. and affiliates.");
    await screen.getByRole("link", "Вернуться в JanaMen").tap();
    await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  }
});
