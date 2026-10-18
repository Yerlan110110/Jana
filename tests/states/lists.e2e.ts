import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

for (const role of ["employee", "manager", "hr"] as const) {
  test(`${role} filtered empty lists retain their controls and navigation`, { session: `visual-${role}`, timeout: 240_000 }, async ({ app, browser, screen }) => {
    await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
    const search = `absent-${crypto.randomUUID()}`;
    const views = role === "employee" ? [
      { id: "S04-empty", path: `/requests?search=${search}`, ready: "Мои заявления", state: "real filtered-empty own request list" },
      { id: "S14-empty", path: `/academy/catalog?search=${search}`, ready: "Каталог курсов", state: "real filtered-empty catalog; reset retains full catalog" },
      { id: "S22-document-empty", path: `/knowledge?search=${search}`, ready: "Правила, к которым можно вернуться", state: "real filtered-empty policy directory" },
    ] : role === "manager" ? [
      { id: "S09-empty", path: `/team/requests?search=${search}`, ready: "Требует моего решения", state: "real filtered-empty server-scoped manager queue" },
    ] : [
      { id: "S25-empty", path: `/team/requests?kind=hr&search=${search}`, ready: "Очередь HR", state: "real filtered-empty server-scoped HR queue" },
      { id: "S26-empty", path: `/hr/courses?search=${search}`, ready: "Управление курсами", state: "real filtered-empty author course list" },
    ];
    const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-empty-${role}-${Date.now()}`;
    for (const view of views) {
      for (const environment of cases) {
        if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
        await app.open(view.path);
        await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
        await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
        await expect(screen.getByRole("alert")).toHaveCount(0);
        await expect(screen.getByRole("main")).toContainText(/не найден|не найдены|Нет заявлений|Заявлений пока нет/);
        await capturePreparedPage({ app, browser, environment, directory, view });
      }
    }
    if (role === "employee") {
      await app.open(`/academy/catalog?search=${search}`);
      await screen.getByRole("link", "Сбросить фильтры").press("Enter");
      await expect(browser).toHaveURL("/academy/catalog");
      await expect(screen.getByRole("main")).toContainText(/Найдено курсов [3-9][0-9]/);
    }
  });
}

test("request-list transport error and loading retain the same filter wrapper and recover", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-query-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const pattern = "**/api/v1/requests/?**";
    await browser.route(pattern, (route) => route.fulfill({ status: 503, json: { code: "unavailable", message: "Presentation-only transport probe", field_errors: {} } }));
    await app.open("/requests");
    await expect(screen.getByRole("alert")).toContainText("Сервис временно недоступен");
    await expect(screen.getByLabel("Тип", { exact: true })).toBeVisible();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S04-query-error", path: "/requests", ready: "Мои заявления", state: "replayed503 presentation only; filters and retry remain available",
    } });
    await browser.unroute(pattern);
    await screen.getByRole("button", "Обновить", { exact: true }).tap();
    await expect(screen.getByRole("alert")).toHaveCount(0);
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await browser.route(pattern, async (route) => { await held; await route.continue(); });
    try {
      await app.open("/requests?type=advance");
      await expect(screen.getByRole("status", "Загружаем данные")).toBeVisible();
      await capturePreparedPage({ app, browser, environment, directory, view: {
        id: "S04-query-loading", path: "/requests?type=advance", ready: "Мои заявления", state: "real request held at transport boundary; visible skeleton and retained filters",
      } });
    } finally {
      release?.();
      await browser.unroute(pattern);
    }
    await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
    await expect(screen.getByRole("alert")).toHaveCount(0);
  }
});
