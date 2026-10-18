import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("course publication rejects missing material and stale saving preserves the author's fields", { session: "visual-hr", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-author-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    const record = data(await client.POST("/api/v1/academy/manage/courses/", {
      params: { header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { slug: `author-check-${crypto.randomUUID()}`, draft: {
        title: "Проверка безопасной публикации", title_kk: "", summary: "Содержание проверяется перед публикацией и назначением.", summary_kk: "", category: "hr", content_language: "ru", passing_percent: 80, max_attempts: 3, estimated_minutes: null, lessons: [], questions: [],
      } },
    }));
    const path = `/hr/courses/${record.id}`;
    await app.open(path);
    await screen.getByRole("button", "Опубликовать новую версию", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Опубликовать новую версию", { exact: true })).toBeVisible();
    const [invalid] = await Promise.all([
      browser.waitForResponse(`**/api/v1/academy/manage/courses/${record.id}/publish/`),
      screen.getByRole("button", "Опубликовать новую версию", { exact: true }).last().tap(),
    ]);
    expect(invalid.status).toBe(400);
    await expect(screen.getByRole("alert")).toContainText("Добавьте хотя бы один обязательный материал.");
    await expect(screen.getByLabel("Название на русском")).toHaveValue(record.title);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S27-invalid-publication", path, ready: "Редактируемый черновик", state: "actual400 publication of a draft without lessons/questions; confirmation and recovery remain visible",
    } });
    await app.open(path);
    const local = "Мой сохранённый замысел после конфликта";
    await screen.getByLabel("Название на русском").fill(local);
    data(await client.POST("/api/v1/academy/manage/courses/{id}/save-draft/", {
      params: { path: { id: record.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
      body: { expected_version: record.version, draft: { ...record.draft, title: "Правка автора из другого окна" } },
    }));
    const [conflict] = await Promise.all([
      browser.waitForResponse(`**/api/v1/academy/manage/courses/${record.id}/save-draft/`),
      screen.getByRole("button", "Сохранить черновик", { exact: true }).tap(),
    ]);
    expect(conflict.status).toBe(409);
    await expect(screen.getByLabel("Название на русском")).toHaveValue(local);
    await expect(screen.getByRole("button", "Опубликовать новую версию", { exact: true })).toBeDisabled();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S27-stale-author", path, ready: "Редактируемый черновик", state: "real concurrent draft update;409 retains local course title and prevents publishing unsaved content",
    } });
    await screen.getByRole("button", "Обновить запись", { exact: true }).tap();
    await expect(screen.getByLabel("Название на русском")).toHaveValue(local);
    await screen.getByRole("button", "Сохранить черновик", { exact: true }).tap();
    await expect(screen.getByText("Черновик сохранён.", { exact: true })).toBeVisible();
    const saved = data(await client.GET("/api/v1/academy/manage/courses/{id}/", { params: { path: { id: record.id } } }));
    expect(saved.draft.title).toBe(local);
    expect(saved.published_version).toBeNull();
  }
});
