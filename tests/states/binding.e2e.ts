import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data, viewsFor } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

for (const role of ["employee", "hr"] as const) {
  test(`${role} changed normal views retain complete content and disclosures`, { session: `visual-${role}`, timeout: 240_000 }, async ({ app, browser, screen }) => {
    if (!app.baseUrl) throw new Error("Select the synthetic fixture");
    const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
    const views = (await viewsFor(client, role)).filter((view) => role === "employee" ? ["S05", "S06", "S22"].includes(view.id) : view.id === "S29");
    expect(views).toHaveLength(role === "employee" ? 3 : 1);
    await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
    const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-binding-${role}-${Date.now()}`;
    for (const view of views) {
      for (const environment of cases) {
        if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
        await app.open(view.path);
        await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
        await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
        await expect(screen.getByRole("alert")).toHaveCount(0);
        if (view.id === "S22") await screen.getByText("Версия и контрольная сумма", { exact: true }).press("Enter");
        if (view.id === "S29") await expect(screen.getByRole("main")).not.toContainText("Публикация актуальна");
        await capturePreparedPage({ app, browser, environment, directory, view: { ...view, id: `${view.id}-current` } });
      }
    }
    if (role === "employee") {
      const catalog = data(await client.GET("/api/v1/academy/courses/"));
      expect(catalog.count).toBeGreaterThanOrEqual(30);
    }
  });
}

for (const role of ["manager", "hr"] as const) {
  test(`${role} narrow navigation exposes scoped destinations and restores its trigger`, { session: `visual-${role}` }, async ({ app, browser, screen }) => {
    await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
    const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-menu-${role}-${Date.now()}`;
    for (const environment of cases.filter((item) => item.kind === "native-zoom" || item.width <= 768)) {
      if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
      await app.open("/");
      await expect(screen.getByRole("heading", "Ваш отпуск", { exact: true })).toBeVisible();
      const trigger = screen.getByRole("button", "Открыть навигацию", { exact: true });
      await trigger.press("Enter");
      await expect(screen.getByRole("link", "На согласовании", { exact: true })).toBeVisible();
      await capturePreparedPage({ app, browser, environment, directory, view: {
        id: `S02-menu-${role}`, path: "/", ready: "Ваш отпуск", state: `actual ${role} navigation open; desktop uses its persistent sidebar instead`,
      } });
      await browser.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });
}
