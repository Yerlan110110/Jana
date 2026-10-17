import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "./api.js";

function committedRecord(value: unknown) {
  if (
    !value || typeof value !== "object" ||
    !("id" in value) || typeof value.id !== "string" ||
    !("version" in value) || typeof value.version !== "number"
  ) throw new Error("The committed response has no request identity or version");
  return { id: value.id, version: value.version };
}

test(
  "lost create response retries one server record and stale edits preserve local fields",
  { session: "employee" },
  async ({ app, screen, browser }) => {
    if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
    const marker = `Transport recovery ${Date.now()}`;
    await app.open("/requests/new?type=advance");
    await expect(screen.getByRole("heading", "Новое заявление")).toBeVisible();
    const { client, cookie } = await sessionClient(browser, new URL(app.baseUrl).origin);
    const calls: { key: string | undefined; body: unknown }[] = [];
    const committed: ReturnType<typeof committedRecord>[] = [];
    await browser.route("**/api/v1/requests/", async (route) => {
      if (route.request.method !== "POST") {
        await route.continue();
        return;
      }
      const body: unknown = route.request.postData
        ? JSON.parse(route.request.postData)
        : null;
      calls.push({
        key: route.request.headers["idempotency-key"],
        body,
      });
      if (calls.length === 1) {
        const headers = new Headers(route.request.headers);
        headers.set("Cookie", cookie);
        const response = await fetch(route.request.url, {
          method: "POST",
          headers,
          body: route.request.postData,
        });
        expect(response.status).toBe(201);
        const result: unknown = await response.json();
        committed.push(committedRecord(result));
        await route.abort();
        return;
      }
      await route.continue();
    });
    await screen.getByLabel("Сумма аванса, KZT").fill("5000");
    await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-01");
    await screen.getByLabel("Причина", { exact: true }).fill(marker);
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(screen.getByRole("button", "Повторить те же данные")).toBeVisible();
    await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(marker);
    await expect(screen.getByLabel("Сумма аванса, KZT")).toHaveValue("5000");
    expect(committed).toHaveLength(1);
    await screen.getByRole("button", "Повторить те же данные").tap();
    await expect(browser).toHaveURL(`/requests/${committed[0].id}`);
    expect(calls).toHaveLength(2);
    expect(calls[0].key).toMatch(/^[a-f0-9-]{36}$/);
    expect(calls[1]).toEqual(calls[0]);
    const listing = await client.GET("/api/v1/requests/", {
      params: { query: { search: marker } },
    });
    expect(listing.response.status).toBe(200);
    expect(listing.data?.count).toBe(1);
    expect(listing.data?.results[0].id).toBe(committed[0].id);

    const localReason = `${marker}, local correction`;
    await screen.getByLabel("Причина", { exact: true }).fill(localReason);
    const secondWriter = await client.PATCH("/api/v1/requests/{id}/", {
      params: {
        path: { id: committed[0].id },
        header: { "Idempotency-Key": crypto.randomUUID() },
      },
      body: { expected_version: committed[0].version, reason: `${marker}, concurrent edit` },
    });
    expect(secondWriter.response.status).toBe(200);
    expect(secondWriter.data?.version).toBe(committed[0].version + 1);
    const [conflict] = await Promise.all([
      browser.waitForResponse(`**/api/v1/requests/${committed[0].id}/`),
      screen.getByRole("button", "Сохранить изменения").tap(),
    ]);
    expect(conflict.status).toBe(409);
    await expect(screen.getByRole("alert")).toContainText("Обновите запись");
    await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(localReason);
    await screen.getByRole("button", "Обновить запись").tap();
    await expect(screen.getByText(`Редактируете на основе версии ${committed[0].version + 1}. Сохраните изменения перед отправкой.`)).toBeVisible();
    await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(localReason);
    await screen.getByRole("button", "Сохранить изменения").tap();
    await expect(screen.getByText("Изменения сохранены.")).toBeVisible();
    await browser.reload();
    await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue(localReason);
    const saved = await client.GET("/api/v1/requests/{id}/", {
      params: { path: { id: committed[0].id } },
    });
    expect(saved.response.status).toBe(200);
    expect(saved.data?.version).toBe(committed[0].version + 2);
    expect(saved.data?.reason).toBe(localReason);
    expect(saved.data?.history.filter((event) => event.action === "created")).toHaveLength(1);
  },
);
