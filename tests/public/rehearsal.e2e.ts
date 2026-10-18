import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect, type Screen } from "e2e";
import { authenticateSyntheticRole } from "../visual/authenticate.js";
import { sessionClient } from "../web/api.js";

async function decide(screen: Screen, label: string) {
  await screen.getByRole("button", label).first().tap();
  await expect(screen.getByRole("heading", label)).toBeVisible();
  await screen.getByRole("button", label).last().tap();
}

test("record one real public advance across three roles and the employee receipt", async ({ app, browser, screen }) => {
  if (!app.baseUrl || process.env.JANAMEN_PUBLIC_PROJECT !== "janamen-public") throw new Error("Select the public synthetic rehearsal");
  const origin = new URL(app.baseUrl).origin;
  const stages: { role: string; at: string; screenshot: string }[] = [];
  await authenticateSyntheticRole(browser, origin, "employee");
  await app.open("/requests/new?type=advance");
  await screen.getByLabel("Сумма аванса, KZT").fill("5000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-10");
  await screen.getByLabel("Причина", { exact: true }).fill("Демонстрационный аванс для запланированных семейных расходов.");
  await screen.getByRole("button", "Сохранить черновик").tap();
  await expect(browser).toHaveURL(/\/requests\/[a-f0-9-]+$/);
  const path = new URL(await browser.url()).pathname;
  const id = path.split("/").at(-1);
  if (!id) throw new Error("Recorded request identity is missing");
  await decide(screen, "Отправить на рассмотрение");
  await expect(screen.getByRole("main")).toContainText("У руководителя");
  stages.push({ role: "employee", at: new Date().toISOString(), screenshot: await app.screenshot("employee-submitted") });
  await authenticateSyntheticRole(browser, origin, "manager");
  await app.open(path);
  await decide(screen, "Одобрить");
  await expect(screen.getByRole("main")).toContainText("У HR");
  stages.push({ role: "manager", at: new Date().toISOString(), screenshot: await app.screenshot("manager-approved") });
  await authenticateSyntheticRole(browser, origin, "hr");
  await app.open(path);
  await decide(screen, "Одобрить");
  await expect(screen.getByRole("main")).toContainText("Согласовано");
  stages.push({ role: "hr", at: new Date().toISOString(), screenshot: await app.screenshot("hr-approved") });
  await authenticateSyntheticRole(browser, origin, "employee");
  await app.open(path);
  await expect(screen.getByRole("main")).toContainText("Получена квитанция", { timeout: 30_000 });
  await expect(screen.getByRole("button", "Одобрить")).toHaveCount(0);
  stages.push({ role: "employee", at: new Date().toISOString(), screenshot: await app.screenshot("employee-receipt") });
  const { client } = await sessionClient(browser, origin);
  const fulfillment = await client.GET("/api/v1/requests/{id}/fulfillment/", { params: { path: { id } } });
  expect(fulfillment.data?.delivery.state).toBe("accepted");
  expect(fulfillment.data?.approval.status).toBe("approved");
  expect(fulfillment.data?.source_accounting.state).toBe("not_applicable");
  const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/defense";
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/rehearsal-${Date.now()}.json`, JSON.stringify({ origin, requestId: id, stages, fulfillment: fulfillment.data, authentication: "API-authenticated synthetic roles; no password-field fill; each role reopens the application" }, null, 2) + "\n", { flag: "wx" });
});
