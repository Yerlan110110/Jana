import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { authenticateSyntheticRole } from "../visual/authenticate.js";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("employee sees the immutable HR basis become superseded and then unavailable", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const origin = new URL(app.baseUrl).origin;
  const { client: employee } = await sessionClient(browser, origin);
  const answer = data(await employee.POST("/api/v1/assistant/answers/", { body: {
    question: `Как получить компенсацию за межпланетную стажировку ${crypto.randomUUID()}?`, language: "ru", client_message_id: crypto.randomUUID(),
  } }));
  const record = data(await employee.POST("/api/v1/knowledge/gaps/", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } }, body: { answer_id: answer.id, details: "Нужно опубликованное основание с проверяемой редакцией." },
  }));
  await authenticateSyntheticRole(browser, origin, "hr");
  const { client: hr } = await sessionClient(browser, origin);
  const me = data(await hr.GET("/api/v1/auth/me/"));
  const firstText = "Демонстрационное правило. Для проверки компенсации межпланетной стажировки сотрудник передаёт HR подтверждение расходов. HR проверяет документы и отвечает отдельно. Публикация этого примера не подтверждает право на реальную выплату.";
  const draft = data(await hr.POST("/api/v1/knowledge/admin/documents/", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { slug: `basis-${crypto.randomUUID()}`, title: "Демонстрационное основание ответа HR", summary: "Проверка сохранения редакции и отзыва доступа.", language: "ru", topic: "hr", audience: "all", legal_entity: me.employee?.legal_entity.id, is_synthetic: true, draft_sections: [{ heading: "Какие документы проверить", text: firstText }] },
  }));
  let policy = data(await hr.POST("/api/v1/knowledge/admin/documents/{id}/publish/", {
    params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: draft.version },
  }));
  data(await hr.POST("/api/v1/knowledge/gaps/{id}/resolve/", {
    params: { path: { id: record.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: record.version, response: "HR отдельно опубликовал демонстрационное правило. Проверьте связанную сохранённую редакцию перед подготовкой документов.", published_revision_id: policy.current_revision.id },
  }));
  await authenticateSyntheticRole(browser, origin, "employee");
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-basis-${Date.now()}`;
  for (const stage of ["current", "superseded", "unavailable"] as const) {
    if (stage === "superseded") {
      policy = data(await hr.PATCH("/api/v1/knowledge/admin/documents/{id}/", {
        params: { path: { id: policy.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
        body: { expected_version: policy.version, draft_sections: [{ heading: "Новая редакция", text: "Демонстрационное уточнение. Сначала уточните перечень подтверждающих документов у HR. Эта новая публикация сохраняется отдельно от основания ранее данного ответа." }] },
      }));
      policy = data(await hr.POST("/api/v1/knowledge/admin/documents/{id}/publish/", {
        params: { path: { id: policy.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: policy.version },
      }));
    }
    if (stage === "unavailable") policy = data(await hr.POST("/api/v1/knowledge/admin/documents/{id}/archive/", {
      params: { path: { id: policy.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: policy.version },
    }));
    for (const environment of cases) {
      if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
      const path = `/knowledge/cases/${record.id}`;
      await app.open(path);
      await expect(screen.getByRole("heading", record.question, { exact: true })).toBeVisible();
      await expect(screen.getByRole("main")).toContainText(stage === "current"
        ? "Ответ связан с опубликованным регламентом."
        : stage === "superseded" ? "После ответа появилась новая редакция регламента." : "Опубликованное основание сейчас недоступно.");
      await capturePreparedPage({ app, browser, environment, directory, view: {
        id: `S23-case-${stage}`, path, ready: record.question, state: `real resolved case with ${stage} immutable basis; fresh server permission check`,
      } });
      await app.open(`${path}/source`);
      if (stage === "unavailable") {
        await expect(screen.getByText("Основание недоступно", { exact: true })).toBeVisible();
        await expect(screen.getByRole("main")).not.toContainText(firstText);
      } else {
        await expect(screen.getByRole("heading", draft.title, { exact: true })).toBeVisible();
        await expect(screen.getByRole("main")).toContainText(firstText);
        await screen.getByText("Сведения о публикации", { exact: true }).press("Enter");
        if (stage === "superseded") await expect(screen.getByRole("main")).toContainText("Сохранённое основание. У документа есть новая редакция.");
      }
      await capturePreparedPage({ app, browser, environment, directory, view: {
        id: `S22-case-source-${stage}`, path: `${path}/source`, ready: stage === "unavailable" ? "Основание недоступно" : draft.title, state: `real full policy basis ${stage}; original revision retained until archive removes access`,
      } });
    }
  }
});
