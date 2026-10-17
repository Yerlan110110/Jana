import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "./api.js";

test("saved normalized values remain submittable without losing later edits", { session: "employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
  const { client, cookie } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const marker = `Проверка сохранённой суммы ${Date.now()}`;
  await app.open("/requests/new?type=advance");
  await screen.getByLabel("Сумма аванса, KZT").fill("5000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-04");
  await screen.getByLabel("Причина", { exact: true }).fill(marker);
  await screen.getByRole("button", "Сохранить черновик").tap();
  await expect(browser).toHaveURL(/\/requests\/[a-f0-9-]+$/);
  const id = new URL(await browser.url()).pathname.split("/").at(-1);
  if (!id) throw new Error("The saved request has no identity");
  await screen.getByLabel("Сумма аванса, KZT").fill("6500");
  await screen.getByLabel("Причина", { exact: true }).fill(`  ${marker}  `);
  const [response] = await Promise.all([
    browser.waitForResponse(`**/api/v1/requests/${id}/`),
    screen.getByRole("button", "Сохранить изменения").tap(),
  ]);
  expect(response.status).toBe(200);
  const saved = await client.GET("/api/v1/requests/{id}/", { params: { path: { id } } });
  expect(saved.data?.amount).toBe("6500.00");
  expect(saved.data?.reason).toBe(marker);
  await expect(screen.getByText("Изменения сохранены.", { exact: true })).toBeVisible();
  await expect(screen.getByLabel("Сумма аванса, KZT")).toHaveValue("6500.00");
  await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(marker);
  let interrupted = false;
  const pattern = `**/api/v1/requests/${id}/`;
  await browser.route(pattern, async route => {
    if (route.request.method !== "PATCH" || interrupted) {
      await route.continue();
      return;
    }
    interrupted = true;
    const headers = new Headers(route.request.headers);
    headers.set("Cookie", cookie);
    const result = await fetch(route.request.url, { method: "PATCH", headers, body: route.request.postData });
    expect(result.status).toBe(200);
    await result.arrayBuffer();
    await route.abort();
  });
  await screen.getByLabel("Причина", { exact: true }).fill(`${marker}, отправленное уточнение`);
  await screen.getByRole("button", "Сохранить изменения").tap();
  await expect(screen.getByRole("button", "Повторить те же данные")).toBeVisible();
  const laterReason = `${marker}, новое уточнение после сбоя`;
  await screen.getByLabel("Сумма аванса, KZT").fill("7200");
  await screen.getByLabel("Причина", { exact: true }).fill(laterReason);
  const [replayed] = await Promise.all([
    browser.waitForResponse(pattern),
    screen.getByRole("button", "Повторить те же данные").tap(),
  ]);
  expect(replayed.status).toBe(200);
  await expect(screen.getByRole("button", "Сохранить изменения")).toBeEnabled();
  await expect(screen.getByLabel("Сумма аванса, KZT")).toHaveValue("7200");
  await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(laterReason);
  await expect(screen.getByRole("button", "Отправить на рассмотрение")).toHaveCount(0);
  const afterReplay = await client.GET("/api/v1/requests/{id}/", { params: { path: { id } } });
  expect(afterReplay.data?.history.filter(event => event.action === "edited")).toHaveLength(2);
  await browser.unroute(pattern);
  await screen.getByRole("button", "Сохранить изменения").tap();
  await expect(screen.getByText("Изменения сохранены.", { exact: true })).toBeVisible();
  await expect(screen.getByLabel("Сумма аванса, KZT")).toHaveValue("7200.00");
  await screen.getByRole("button", "Отправить на рассмотрение").tap();
  await expect(screen.getByRole("heading", "Отправить на рассмотрение")).toBeVisible();
  await screen.getByRole("button", "Отправить на рассмотрение").last().tap();
  await expect(screen.getByRole("main")).toContainText("У руководителя");
  const submitted = await client.GET("/api/v1/requests/{id}/", { params: { path: { id } } });
  expect(submitted.data?.revisions[0].payload.amount).toBe("7200.00");
  expect(submitted.data?.revisions[0].payload.reason).toBe(laterReason);
  await screen.getByRole("button", "Отменить заявление").tap();
  await expect(screen.getByRole("heading", "Отменить заявление")).toBeVisible();
  await screen.getByRole("button", "Отменить заявление").last().tap();
  await expect(screen.getByRole("main")).toContainText("Отменено");
});
