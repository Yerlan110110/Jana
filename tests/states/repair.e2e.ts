import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { authenticateSyntheticRole } from "../visual/authenticate.js";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data, viewsFor } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("server validation is readable and recoverable at every required size", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/repair-field-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const path = "/requests/new?type=advance";
    await app.open(path);
    const amount = screen.getByLabel("Сумма аванса, KZT");
    await amount.fill("1000000000000");
    await screen.getByLabel("Желаемая дата выплаты").fill("2027-01-15");
    await screen.getByLabel("Причина", { exact: true }).fill("Проверка ошибки суммы без потери введённых данных.");
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(screen.getByRole("alert")).toBeVisible();
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(amount).toBeFocused();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S06-server-field-error", path, ready: "Данные заявления", state: "actual server 400; amount retained, described and focused",
    } });
    await amount.fill("5000");
    await expect(amount).not.toHaveAttribute("aria-invalid", "true");
    await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue("Проверка ошибки суммы без потери введённых данных.");
  }
});

test("quiz exit confirmation keeps the background inert and the selected answer", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic application");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const enrollment = data(await client.GET("/api/v1/academy/enrollments/", { params: { query: { page_size: 100 } } }))
    .results.find((item) => item.allowed_actions.includes("submit_attempt"));
  if (!enrollment) throw new Error("A real eligible assessment is required");
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/repair-quiz-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const path = `/academy/enrollments/${enrollment.id}/quiz`;
    await app.open(path);
    const choice = screen.getByRole("radio").first();
    await choice.check();
    await screen.getByRole("link", "К материалам и истории").tap();
    const dialog = screen.getByRole("dialog", "Уйти без отправки ответов?");
    await expect(dialog).toBeVisible();
    await expect(screen.getByRole("button", "Остаться в тесте")).toBeFocused();
    await browser.keyboard.press("Shift+Tab");
    const boundaryFocus = await browser.evaluate(() => ({
      tag: document.activeElement?.tagName ?? null,
      inDialog: !!document.activeElement?.closest("dialog[open]"),
      documentFocused: document.hasFocus(),
    }));
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/focus-${environment.kind === "viewport" ? environment.width : "zoom"}.json`, JSON.stringify(boundaryFocus) + "\n", { flag: "wx" });
    expect(boundaryFocus).toEqual({ tag: "BODY", inDialog: false, documentFocused: false });
    await browser.keyboard.press("Tab");
    await expect(screen.getByRole("button", "Остаться в тесте")).toBeFocused();
    await browser.keyboard.press("Tab");
    await expect(screen.getByRole("button", "Уйти без отправки")).toBeFocused();
    await browser.keyboard.press("Shift+Tab");
    await expect(screen.getByRole("button", "Остаться в тесте")).toBeFocused();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S18-unsent-dialog", path, ready: "Уйти без отправки ответов?", state: "selected real question; blocked link navigation; native modal excludes background from focus",
    } });
    await browser.keyboard.press("Escape");
    await expect(choice).toBeChecked();
    await expect(screen.getByRole("link", "К материалам и истории")).toBeFocused();
    await screen.getByRole("link", "К материалам и истории").tap();
    await screen.getByRole("button", "Уйти без отправки").tap();
    await expect(browser).toHaveURL(`/academy/enrollments/${enrollment.id}`);
  }
});

test("return reason and answer sources precede the work they explain", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic application");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const views = (await viewsFor(client, "employee")).filter((view) => ["S08", "S21"].includes(view.id));
  expect(views).toHaveLength(2);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/repair-hierarchy-${Date.now()}`;
  for (const view of views) {
    for (const environment of cases) {
      if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
      await app.open(view.path);
      await expect(screen.getByRole("heading", view.ready, { exact: true })).toBeVisible();
      await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
      if (view.id === "S08") {
        const reason = await screen.getByRole("heading", "Причина возврата").boundingBox();
        const edit = await screen.getByRole("heading", "Исправить заявление").boundingBox();
        if (!reason || !edit) throw new Error("Return reason and correction form must render");
        expect(reason.y).toBeLessThan(edit.y);
      } else {
        const source = await screen.getByRole("heading", "Проверьте основание").boundingBox();
        const answer = await screen.getByRole("heading", "Текст ответа").boundingBox();
        if (!source || !answer) throw new Error("Answer sources and text must render");
        expect(source.y).toBeLessThan(answer.y);
        if (environment.kind === "viewport" && environment.width >= 1280) expect(source.y).toBeLessThan(800);
      }
      await capturePreparedPage({ app, browser, view, environment, directory });
    }
  }
});

test("notification translation retains the event stage and reading makes no decision", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic application");
  const origin = new URL(app.baseUrl).origin;
  const { client: employee } = await sessionClient(browser, origin);
  const created = data(await employee.POST("/api/v1/requests/", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { kind: "advance", amount: "5000.00", currency: "KZT", requested_payment_date: "2027-01-15", reason: "Проверка исторического этапа уведомления." },
  }));
  const submitted = data(await employee.POST("/api/v1/requests/{id}/submit/", {
    params: { path: { id: created.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: created.version },
  }));
  const historical = data(await employee.GET("/api/v1/notifications/"))
    .results.find((item) => item.target_id === created.id && item.request_status === "pending_manager");
  if (!historical) throw new Error("The submitted event must have its own status");
  await authenticateSyntheticRole(browser, origin, "manager");
  const { client: manager } = await sessionClient(browser, origin);
  const approved = data(await manager.POST("/api/v1/requests/{id}/approve/", {
    params: { path: { id: created.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: submitted.version, comment: "Проверка уведомления после решения руководителя." },
  }));
  expect(approved.status).toBe("pending_hr");
  await authenticateSyntheticRole(browser, origin, "employee");
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/repair-notifications-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await app.open("/notifications");
    await expect(screen.getByRole("heading", "Уведомления")).toBeVisible();
    const rows = screen.getByRole("article").filter({ has: browser.locator(`a[href="/requests/${created.id}"]`) });
    await expect(rows).toHaveCount(2);
    await expect(rows).toContainText(["Заявка: У HR", "Заявка: У руководителя"]);
    await expect(screen.getByRole("main")).not.toContainText(/Pending manager|Pending HR|Cancelled|Approved/);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S24", path: "/notifications", ready: "Уведомления", state: "historical manager stage and later HR stage; real unread action",
    } });
  }
  const previous = screen.getByRole("article")
    .filter({ has: browser.locator(`a[href="/requests/${created.id}"]`) })
    .filter({ hasText: "Заявка: У руководителя" });
  await previous.getByRole("button", "Отметить прочитанным").tap();
  await expect(previous.getByRole("button", "Отметить прочитанным")).toHaveCount(0);
  const read = data(await employee.POST("/api/v1/notifications/{id}/read/", { params: { path: { id: historical.id } } }));
  expect(read.request_status).toBe("pending_manager");
  expect(read.body).toBe(historical.body);
  const request = data(await employee.GET("/api/v1/requests/{id}/", { params: { path: { id: created.id } } }));
  expect(request.status).toBe("pending_hr");
  expect(request.version).toBe(approved.version);
});
