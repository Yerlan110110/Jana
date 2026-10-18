import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { authenticateSyntheticRole } from "../visual/authenticate.js";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("reviewer stale decision retains the required comment and refresh removes obsolete commands", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const origin = new URL(app.baseUrl).origin;
  const { client: employee } = await sessionClient(browser, origin);
  await authenticateSyntheticRole(browser, origin, "manager");
  const { client: manager } = await sessionClient(browser, origin);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-review-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const draft = data(await employee.POST("/api/v1/requests/", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { kind: "advance", amount: "5000.00", currency: "KZT", requested_payment_date: "2027-02-01", reason: "Проверка конкурирующих решений руководителя." },
    }));
    const submitted = data(await employee.POST("/api/v1/requests/{id}/submit/", {
      params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: draft.version },
    }));
    const path = `/requests/${draft.id}`;
    await app.open(path);
    await screen.getByRole("button", "Вернуть на исправление", { exact: true }).tap();
    const comment = screen.getByLabel("Комментарий · обязательно");
    await expect(comment).toHaveAttribute("required", "");
    await screen.getByRole("button", "Вернуть на исправление", { exact: true }).last().tap();
    await expect(comment).toBeFocused();
    const text = "Уточните основание и желаемую дату. Этот комментарий должен сохраниться при конфликте.";
    await comment.fill(text);
    const changed = data(await manager.POST("/api/v1/requests/{id}/approve/", {
      params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { expected_version: submitted.version, comment: "Решение из другого окна." },
    }));
    const [response] = await Promise.all([
      browser.waitForResponse(`**/api/v1/requests/${draft.id}/return-for-changes/`),
      screen.getByRole("button", "Вернуть на исправление", { exact: true }).last().tap(),
    ]);
    expect(response.status).toBe(409);
    await expect(comment).toHaveValue(text);
    await expect(screen.getByRole("alert")).toContainText("Обновите запись");
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S10-review-conflict", path, ready: "Следующее действие", state: "real second-window approval; stale return rejected409; required comment retained",
    } });
    await screen.getByRole("button", "Обновить запись", { exact: true }).tap();
    await expect(screen.getByRole("button", "Вернуть на исправление", { exact: true })).toHaveCount(0);
    await expect(screen.getByRole("main")).toContainText("У HR");
    const current = data(await manager.GET("/api/v1/requests/{id}/", { params: { path: { id: draft.id } } }));
    expect(current.version).toBe(changed.version);
    expect(current.history.filter((event) => event.action === "returned")).toHaveLength(0);
    expect(current.history.filter((event) => event.action === "approved")).toHaveLength(1);
  }
});

test("HR case form distinguishes an individual answer, published basis and stale resolution", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const origin = new URL(app.baseUrl).origin;
  const { client: employee } = await sessionClient(browser, origin);
  await authenticateSyntheticRole(browser, origin, "hr");
  const { client: hr } = await sessionClient(browser, origin);
  const documents = data(await hr.GET("/api/v1/knowledge/admin/documents/", { params: { query: { state: "published", page_size: 100 } } }));
  const policy = documents.results.find((record) => record.current_revision && record.audience === "all");
  if (!policy) throw new Error("An accessible real published basis is required");
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-case-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const answer = data(await employee.POST("/api/v1/assistant/answers/", { body: {
      question: `Каков порядок межпланетной стажировки ${crypto.randomUUID()}?`, language: "ru", client_message_id: crypto.randomUUID(),
    } }));
    const record = data(await employee.POST("/api/v1/knowledge/gaps/", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { answer_id: answer.id, details: "Нужно уточнение HR по отсутствующему демонстрационному правилу." },
    }));
    const path = `/knowledge/cases/${record.id}`;
    await app.open(path);
    await expect(screen.getByRole("heading", "Подготовить ответ")).toBeVisible();
    const response = screen.getByLabel("Ответ сотруднику");
    const text = "Сначала уточните обстоятельства у HR. Индивидуальный ответ сам по себе не публикует правило для всех сотрудников.";
    await response.fill(text);
    await expect(screen.getByLabel("Опубликованное основание")).toHaveValue("");
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S30-individual-form", path, ready: "Подготовить ответ", state: "open real HR case; typed individual response with no publication selected",
    } });
    await screen.getByLabel("Опубликованное основание").selectOption({ value: policy.current_revision.id });
    await expect(screen.getByLabel("Опубликованное основание")).toHaveValue(policy.current_revision.id);
    data(await hr.POST("/api/v1/knowledge/gaps/{id}/resolve/", {
      params: { path: { id: record.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { expected_version: record.version, response: "Индивидуальное уточнение HR из другого окна. Новое правило этим не опубликовано." },
    }));
    const [conflict] = await Promise.all([
      browser.waitForResponse(`**/api/v1/knowledge/gaps/${record.id}/resolve/`),
      screen.getByRole("button", "Сохранить ответ и закрыть обращение").tap(),
    ]);
    expect(conflict.status).toBe(409);
    await expect(response).toHaveValue(text);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S30-resolution-conflict", path, ready: "Подготовить ответ", state: "real concurrent individual resolution; selected basis and local typed response retained after409",
    } });
    await screen.getByRole("button", "Обновить", { exact: true }).tap();
    await expect(screen.getByRole("main")).toContainText("Это индивидуальный ответ HR.");
    await expect(screen.getByRole("button", "Сохранить ответ и закрыть обращение")).toHaveCount(0);
    const saved = data(await hr.GET("/api/v1/knowledge/gaps/{id}/", { params: { path: { id: record.id } } }));
    expect(saved.resolution_kind).toBe("individual_answer");
    expect(saved.policy_reference).toBeNull();
  }
});

test("policy editor and complete published revision expose their real controls", { session: "visual-hr", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const documents = data(await client.GET("/api/v1/knowledge/admin/documents/", { params: { query: { state: "published", page_size: 100 } } }));
  const record = documents.results.find((item) => item.current_revision && item.audience === "all");
  if (!record) throw new Error("A real policy editor and immutable publication are required");
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-policy-${Date.now()}`;
  const dialogs: string[] = [];
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const path = `/hr/policies/${record.id}`;
    await app.open(path);
    await expect(screen.getByLabel("Название", { exact: true })).toHaveValue(record.title);
    const local = `${record.title} · локальная правка`;
    await screen.getByLabel("Название", { exact: true }).fill(local);
    const stop = await browser.onDialog(async (dialog) => { dialogs.push(dialog.message); await dialog.dismiss(); });
    await screen.getByRole("button", "Загрузить текущий черновик").tap();
    await stop();
    expect(dialogs.at(-1)).toContain("Несохранённые поля будут заменены");
    await expect(screen.getByLabel("Название", { exact: true })).toHaveValue(local);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S29-dirty-editor", path, ready: record.title, state: "actual full policy editor; cancelled native replacement keeps local title; no publication",
    } });
    await app.open(`/knowledge/documents/${record.id}`);
    await expect(screen.getByRole("heading", record.current_revision.title, { exact: true })).toBeVisible();
    await screen.getByText("Сведения о публикации", { exact: true }).tap();
    await expect(screen.getByRole("main")).toContainText(record.current_revision.content_hash);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S22-full-publication", path: `/knowledge/documents/${record.id}`, ready: record.current_revision.title, state: "actual full published policy; publication disclosure open with immutable hash",
    } });
  }
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/native-confirmations.json`, JSON.stringify({ dialogs, dismissed: dialogs.length }, null, 2) + "\n", { flag: "wx" });
});
