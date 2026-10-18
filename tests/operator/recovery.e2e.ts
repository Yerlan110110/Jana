import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { signIn, changeRole } from "../web/support.js";
import { compose } from "./fixture.js";

async function decide(screen: Screen, label: string) {
  await screen.getByRole("button", label).first().tap();
  await expect(screen.getByRole("heading", label)).toBeVisible();
  await screen.getByRole("button", label).last().tap();
}

test("operator recovers a real delivery failure without another HR decision", { timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (process.env.JANAMEN_OPERATOR_PROJECT !== "janamen-ci" || !app.baseUrl || new URL(app.baseUrl).origin !== "http://127.0.0.1:8090") {
    throw new Error("This worker-control probe requires the explicitly selected janamen-ci fixture at port 8090");
  }
  const origin = new URL(app.baseUrl).origin;
  const workerId = compose("ps", "-q", "worker");
  expect(workerId).not.toBe("");
  const startedAt = new Date().toISOString();
  try {
    compose("stop", "worker");
    await signIn(app, screen, "employee");
    await app.open("/requests/new?type=advance");
    await screen.getByLabel("Сумма аванса, KZT").fill("5000");
    await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-10");
    await screen.getByLabel("Причина", { exact: true }).fill(`Проверка восстановления передачи ${Date.now()}`);
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(browser).toHaveURL(/\/requests\/[a-f0-9-]+$/);
    const path = new URL(await browser.url()).pathname;
    const requestId = path.split("/").at(-1);
    if (!requestId) throw new Error("Saved request identity is missing");
    await decide(screen, "Отправить на рассмотрение");
    await expect(screen.getByRole("main")).toContainText("У руководителя");
    await changeRole(app, screen, "manager");
    await app.open(path);
    await decide(screen, "Одобрить");
    await expect(screen.getByRole("main")).toContainText("У HR");
    await changeRole(app, screen, "hr");
    await app.open(path);
    await decide(screen, "Одобрить");
    await expect(screen.getByRole("main")).toContainText("Согласовано");
    const { client } = await sessionClient(browser, origin);
    const approved = await client.GET("/api/v1/requests/{id}/", { params: { path: { id: requestId } } });
    expect(approved.response.status).toBe(200);
    const list = await client.GET("/api/v1/integrations/exports/", { params: { query: { page_size: 100, ordering: "-created_at" } } });
    expect(list.response.status).toBe(200);
    const record = list.data?.results.find(item => item.request_id === requestId);
    if (!record) throw new Error("Approved request has no real export");
    expect(record.delivery_status).toBe("pending");
    expect(record.mock_fault_available).toBe(true);
    await app.open("/hr/integrations");
    await expect(screen.getByRole("heading", "Документы к передаче")).toBeVisible();
    await screen.getByRole("link", record.employee_name, { exact: true }).first().tap();
    await expect(browser).toHaveURL(new RegExp(`/exports/${record.id}$`));
    await expect(screen.getByRole("heading", "Передача документа")).toBeVisible();
    await screen.getByText("Демонстрация сбоя mock-адаптера", { exact: true }).tap();
    const confirmations: string[] = [];
    await browser.onDialog(async dialog => { confirmations.push(dialog.message); await dialog.accept(); });
    await screen.getByRole("button", "Включить демонстрационный сбой").tap();
    await expect.poll(async () => (await client.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).data?.version).toBe(record.version + 1);
    compose("start", "worker");
    await expect(screen.getByRole("button", "Повторить передачу")).toBeVisible({ timeout: 30_000 });
    const failed = await client.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } });
    expect(failed.data?.delivery_status).toBe("failed");
    expect(failed.data?.export_receipt).toBe(null);
    const failedFulfillment = await client.GET("/api/v1/requests/{id}/fulfillment/", { params: { path: { id: requestId } } });
    expect(failedFulfillment.data?.approval.status).toBe("approved");
    expect(failedFulfillment.data?.delivery.state).toBe("needs_operator");
    await screen.getByRole("button", "Восстановить mock-адаптер").tap();
    await expect.poll(async () => (await client.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } })).data?.version).toBe((failed.data?.version ?? 0) + 1);
    await screen.getByRole("button", "Повторить передачу").tap();
    await expect(screen.getByRole("heading", "Квитанция о получении")).toBeVisible({ timeout: 30_000 });
    const delivered = await client.GET("/api/v1/integrations/exports/{id}/", { params: { path: { id: record.id } } });
    expect(delivered.data?.delivery_status).toBe("processed");
    expect(delivered.data?.attempt_count).toBe(2);
    expect(delivered.data?.delivery_attempts.map(attempt => attempt.result?.outcome)).toEqual(["failed", "accepted"]);
    expect(delivered.data?.export_receipt?.request_revision).toBe(approved.data?.revisions[0].id);
    expect(delivered.data?.export_receipt?.acceptance_meaning).toBe("document_received_only");
    const afterDelivery = await client.GET("/api/v1/requests/{id}/", { params: { path: { id: requestId } } });
    expect(afterDelivery.data?.version).toBe(approved.data?.version);
    expect(afterDelivery.data?.history).toEqual(approved.data?.history);
    expect(confirmations).toHaveLength(3);
    await changeRole(app, screen, "employee");
    await app.open(path);
    await expect(screen.getByRole("main")).toContainText("Получена квитанция");
    await expect(screen.getByRole("main")).toContainText("Неприменимо к авансу");
    await expect(screen.getByRole("button", "Повторить передачу")).toHaveCount(0);
    const { client: employee } = await sessionClient(browser, origin);
    const fulfillment = await employee.GET("/api/v1/requests/{id}/fulfillment/", { params: { path: { id: requestId } } });
    expect(fulfillment.data?.approval.status).toBe("approved");
    expect(fulfillment.data?.delivery.state).toBe("accepted");
    expect(fulfillment.data?.source_accounting.state).toBe("not_applicable");
    const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/operator";
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/recovery-${Date.now()}.json`, JSON.stringify({ startedAt, requestId, exportId: record.id, workerId, failed: failed.data, delivered: delivered.data, fulfillment: fulfillment.data, requestVersion: afterDelivery.data?.version, confirmationCount: confirmations.length }, null, 2) + "\n", { flag: "wx" });
  } finally {
    compose("start", "worker");
    expect(compose("ps", "-q", "worker")).toBe(workerId);
  }
});
