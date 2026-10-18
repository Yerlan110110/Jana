import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("invalid login keeps the username and exposes the demo-role disclosure", { timeout: 240_000 }, async ({ app, browser, screen }) => {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-login-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await app.open("/login");
    await screen.getByLabel("Имя пользователя").fill("employee.demo");
    await screen.getByLabel("Пароль", { exact: true }).fill("public-invalid-canary");
    await screen.getByRole("button", "Войти", { exact: true }).press("Enter");
    await expect(screen.getByRole("alert")).toContainText("Проверьте имя и пароль");
    await screen.getByLabel("Пароль", { exact: true }).fill("");
    await screen.getByText("Демонстрационные роли", { exact: true }).press("Enter");
    await expect(screen.getByLabel("Имя пользователя")).toHaveValue("employee.demo");
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S01-invalid-login", path: "/login", ready: "Войдите в JanaMen", state: "actual invalid credentials; username retained; public canary cleared before capture; demo roles expanded",
    } });
    await screen.getByRole("button", "Руководитель", { exact: true }).press("Enter");
    await expect(screen.getByLabel("Имя пользователя")).toHaveValue("manager.demo");
  }
});

test("session lookup loading and transport error retain a recovery path", { timeout: 240_000 }, async ({ app, browser, screen }) => {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-session-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const pattern = "**/api/v1/auth/me/";
    await browser.route(pattern, (route) => route.fulfill({ status: 503, json: { code: "dependency_unavailable", message: "Presentation-only transport probe", field_errors: {} } }));
    await app.open("/login");
    await expect(screen.getByRole("alert")).toContainText("Сервис временно недоступен");
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S01-session-error", path: "/login", ready: "", state: "replayed503 during session lookup; real root wrapper and retry; presentation evidence only",
    } });
    await browser.unroute(pattern);
    await screen.getByRole("button", "Обновить", { exact: true }).press("Enter");
    await expect(screen.getByRole("heading", "Войдите в JanaMen", { exact: true })).toBeVisible();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await browser.route(pattern, async (route) => { await held; await route.continue(); });
    try {
      await app.open("/login");
      await expect(screen.getByRole("status", "Загружаем данные")).toBeVisible();
      await capturePreparedPage({ app, browser, environment, directory, view: {
        id: "S01-session-loading", path: "/login", ready: "", state: "real session lookup held at transport boundary; semantic loading with no private app content",
      } });
    } finally {
      release?.();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      await browser.unroute(pattern);
    }
    await expect(screen.getByRole("heading", "Войдите в JanaMen", { exact: true })).toBeVisible();
  }
});

test("a missing lazy feature chunk reaches the recoverable application boundary", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-fatal-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const pattern = /\/assets\/people-[^/]+\.js$/;
    await browser.route(pattern, (route) => route.abort());
    await app.open("/profile");
    await expect(screen.getByRole("heading", "Страница не открылась", { exact: true })).toBeVisible();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S03-chunk-unavailable", path: "/profile", ready: "Страница не открылась", state: "actual lazy-module network failure reaches application error boundary; no React setters or fabricated business state",
    } });
    await browser.unroute(pattern);
    await screen.getByRole("link", "Открыть главную", { exact: true }).press("Enter");
    await expect(screen.getByRole("heading", "Ваш отпуск", { exact: true })).toBeVisible();
  }
});
