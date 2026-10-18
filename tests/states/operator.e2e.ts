import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { compose } from "../operator/fixture.js";
import { authenticateSyntheticRole } from "../visual/authenticate.js";
import { auditPage } from "../visual/audit.js";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

test("operator disclosures distinguish queued, failed and receipted delivery and cancelled commands", { session: "visual-employee", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (process.env.JANAMEN_OPERATOR_PROJECT !== "janamen-ci" || !app.baseUrl || new URL(app.baseUrl).origin !== "http://127.0.0.1:8090") throw new Error("Select the owned worker-control fixture");
  const origin = new URL(app.baseUrl).origin;
  const { client: employee } = await sessionClient(browser, origin);
  const draft = data(await employee.POST("/api/v1/requests/", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { kind: "advance", amount: "5000.00", currency: "KZT", requested_payment_date: "2027-02-01", reason: "Проверка состояний передачи и раскрытых подтверждений." },
  }));
  let request = data(await employee.POST("/api/v1/requests/{id}/submit/", {
    params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: draft.version },
  }));
  await authenticateSyntheticRole(browser, origin, "manager");
  const { client: manager } = await sessionClient(browser, origin);
  request = data(await manager.POST("/api/v1/requests/{id}/approve/", {
    params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: request.version, comment: "Проверено руководителем." },
  }));
  await authenticateSyntheticRole(browser, origin, "hr");
  const { client: hr } = await sessionClient(browser, origin);
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-operator-${Date.now()}`;
  await mkdir(directory, { recursive: true });
  const disclosures = [];
  const confirmations: string[] = [];
  let accept = false;
  const unsubscribe = await browser.onDialog(async (dialog) => {
    confirmations.push(`${accept ? "accepted" : "dismissed"}: ${dialog.message}`);
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const worker = compose("ps", "-q", "worker");
  expect(worker).not.toBe("");
  try {
    compose("stop", "worker");
    const approved = data(await hr.POST("/api/v1/requests/{id}/approve/", {
      params: { path: { id: draft.id }, header: { "Idempotency-Key": crypto.randomUUID() } }, body: { expected_version: request.version, comment: "Согласовано HR отдельно от передачи." },
    }));
    const exports = data(await hr.GET("/api/v1/integrations/exports/", { params: { query: { page_size: 100, ordering: "-created_at" } } }));
    const record = exports.results.find((item) => item.request_id === draft.id);
    if (!record || !record.mock_fault_available) throw new Error("The explicit mock-control export is required");
    const path = `/hr/integrations/exports/${record.id}`;
    for (const stage of ["pending", "failed", "processed"] as const) {
      if (stage === "failed") {
        await app.open(path);
        await screen.getByText("Демонстрация сбоя mock-адаптера", { exact: true }).press("Enter");
        await screen.getByRole("button", "Включить демонстрационный сбой").hover();
        expect((await browser.evaluate(auditPage)).unresolved).toEqual([]);
        await screen.getByRole("button", "Включить демонстрационный сбой").tap();
        expect(data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).version).toBe(record.version);
        accept = true;
        await screen.getByRole("button", "Включить демонстрационный сбой").tap();
        await expect.poll(async () => data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).version).toBe(record.version + 1);
        compose("start", "worker");
        await expect(screen.getByRole("button", "Повторить передачу")).toBeVisible({ timeout: 30_000 });
      }
      if (stage === "processed") {
        const before = data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } }));
        accept = false;
        await screen.getByRole("button", "Повторить передачу").tap();
        expect(data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).version).toBe(before.version);
        accept = true;
        await screen.getByRole("button", "Восстановить mock-адаптер").tap();
        await expect.poll(async () => data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).version).toBe(before.version + 1);
        await screen.getByRole("button", "Повторить передачу").tap();
        await expect(screen.getByRole("heading", "Квитанция о получении")).toBeVisible({ timeout: 30_000 });
      }
      for (const environment of cases) {
        if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
        await app.open(path);
        await expect(screen.getByRole("heading", "Передача документа", { exact: true })).toBeVisible();
        await expect(screen.getByRole("status", "Загружаем данные")).toHaveCount(0);
        for (const state of ["closed", "expanded"] as const) {
          if (state === "expanded") {
            if (stage === "processed") {
              await expect(screen.getByText("Демонстрация сбоя mock-адаптера", { exact: true })).toHaveCount(0);
              await expect(screen.getByRole("button", "Включить демонстрационный сбой")).toHaveCount(0);
              await expect(screen.getByRole("button", "Восстановить mock-адаптер")).toHaveCount(0);
            } else {
              await screen.getByText("Демонстрация сбоя mock-адаптера", { exact: true }).press("Enter");
              await screen.getByRole("button", "Включить демонстрационный сбой").hover();
              expect((await browser.evaluate(auditPage)).unresolved).toEqual([]);
            }
            const label = stage === "failed" ? "Диагностика последнего сбоя" : stage === "processed" ? "Идентичность документа" : "Демонстрация сбоя mock-адаптера";
            const summary = screen.getByText(label, { exact: true });
            if (stage !== "pending") await summary.tap();
            await summary.press("Space");
            await expect(browser.locator("details[open]").getByText(label, { exact: true })).toHaveCount(0);
            await summary.press("Enter");
            await expect(browser.locator("details[open]").getByText(label, { exact: true })).toHaveCount(1);
          }
          const geometry = await browser.evaluate(() => [...document.querySelectorAll("summary")].map((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { label: element.textContent, width: rect.width, height: rect.height, open: element.parentElement?.hasAttribute("open") ?? false, focused: document.activeElement === element, focusVisible: element.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
          }));
          const audit = await browser.evaluate(auditPage);
          disclosures.push({ stage, environment, state, geometry, audit });
          await writeFile(`${directory}/disclosures.json`, JSON.stringify(disclosures, null, 2) + "\n");
          expect(geometry.length).toBeGreaterThan(0);
          for (const summary of geometry) {
            expect(summary.width, summary.label ?? "summary").toBeGreaterThanOrEqual(24);
            expect(summary.height, summary.label ?? "summary").toBeGreaterThanOrEqual(44);
          }
          if (state === "expanded") expect(geometry.some((summary) => summary.focused && summary.focusVisible && summary.outlineStyle === "solid" && summary.outlineWidth === "2px")).toBe(true);
          expect(audit.unresolved).toEqual([]);
        }
        const saved = data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } }));
        expect(saved.delivery_status).toBe(stage);
        await capturePreparedPage({ app, browser, environment, directory, view: {
          id: `S31-export-${stage}`, path, ready: "Передача документа", state: `actual worker delivery ${stage}; available disclosures expanded; mock mutation controls absent after receipt`,
        } });
      }
    }
    const after = data(await hr.GET("/api/v1/requests/{id}/", { params: { path: { id: draft.id } } }));
    expect(after.version).toBe(approved.version);
    expect(after.history).toEqual(approved.history);
    const delivered = data(await hr.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } }));
    expect(delivered.delivery_attempts.map((item) => item.result?.outcome)).toEqual(["failed", "accepted"]);
    expect(delivered.export_receipt?.request_revision).toBe(approved.revisions[0].id);
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/confirmations.json`, JSON.stringify({ request_id: draft.id, export_id: record.id, confirmations, worker_restored: true }, null, 2) + "\n", { flag: "wx" });
  } finally {
    await unsubscribe();
    compose("start", "worker");
  }
});
