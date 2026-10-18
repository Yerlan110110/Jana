import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect, type Screen } from "e2e";
import { sessionClient } from "../web/api.js";
import { signIn, changeRole } from "../web/support.js";

function selectedOrigin(baseUrl: string | undefined) {
  if (!baseUrl) throw new Error("Public synthetic demo URL is required");
  const url = new URL(baseUrl);
  if (process.env.JANAMEN_PUBLIC_PROJECT !== "janamen-public" || url.protocol !== "https:" || url.hostname !== process.env.PUBLIC_HOST || !url.hostname.endsWith(".trycloudflare.com")) {
    throw new Error("This mutating check only targets the explicitly selected synthetic Quick Tunnel demo");
  }
  return url.origin;
}

async function decide(screen: Screen, label: string) {
  await screen.getByRole("button", label).first().tap();
  await expect(screen.getByRole("heading", label)).toBeVisible();
  await screen.getByRole("button", label).last().tap();
}

test("public origin enforces HTTPS and ignores a spoofed forwarding protocol", async ({ app }) => {
  const origin = selectedOrigin(app.baseUrl);
  for (const headers of [new Headers(), new Headers({ "X-Forwarded-Proto": "https" })]) {
    const response = await fetch(origin.replace("https:", "http:") + "/login", { redirect: "manual", headers });
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`${origin}/login`);
  }
  const response = await fetch(`${origin}/api/v1/ready/`, { headers: { "X-Forwarded-Proto": "http" } });
  expect(response.status).toBe(200);
  expect(response.headers.get("strict-transport-security")).toBe("max-age=3600");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("cache-control")).toBe("no-store");
});

test("public employee manager and HR finish an advance with secure session and CSRF denial", { timeout: 240_000 }, async ({ app, screen, browser }) => {
  const origin = selectedOrigin(app.baseUrl);
  const startedAt = new Date().toISOString();
  await signIn(app, screen, "employee");
  const cookieFacts = (await browser.cookies()).map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite }));
  expect(cookieFacts.find(cookie => cookie.name === "sessionid")).toEqual({ name: "sessionid", secure: true, httpOnly: true, sameSite: "Lax" });
  expect(cookieFacts.find(cookie => cookie.name === "csrftoken")?.secure).toBe(true);
  const { client, cookie } = await sessionClient(browser, origin);
  const csrf = await client.GET("/api/v1/auth/csrf/");
  if (!csrf.data) throw new Error("Authenticated CSRF response is missing");
  const rejected: number[] = [];
  for (const headers of [
    new Headers({ Origin: origin }),
    new Headers({ Origin: "https://untrusted.invalid", "X-CSRFToken": csrf.data.csrf_token }),
  ]) {
    headers.set("Cookie", cookie);
    headers.set("Content-Type", "application/json");
    const denied = await fetch(`${origin}/api/v1/requests/`, { method: "POST", headers, body: "{}" });
    expect(denied.status).toBe(403);
    rejected.push(denied.status);
  }
  expect((await client.GET("/api/v1/auth/me/")).response.status).toBe(200);
  await app.open("/requests/new?type=advance");
  await screen.getByLabel("Сумма аванса, KZT").fill("5000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-10");
  await screen.getByLabel("Причина", { exact: true }).fill(`Демонстрационный аванс после проверки HTTPS ${Date.now()}`);
  await screen.getByRole("button", "Сохранить черновик").tap();
  await expect(browser).toHaveURL(/\/requests\/[a-f0-9-]+$/);
  const path = new URL(await browser.url()).pathname;
  const id = path.split("/").at(-1);
  if (!id) throw new Error("Saved public request identity is missing");
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
  await changeRole(app, screen, "employee");
  await app.open(path);
  await expect(screen.getByRole("main")).toContainText("Получена квитанция", { timeout: 30_000 });
  await expect(screen.getByRole("button", "Одобрить")).toHaveCount(0);
  const { client: employee } = await sessionClient(browser, origin);
  const request = await employee.GET("/api/v1/requests/{id}/", { params: { path: { id } } });
  const fulfillment = await employee.GET("/api/v1/requests/{id}/fulfillment/", { params: { path: { id } } });
  expect(request.data?.status).toBe("approved");
  expect(fulfillment.data?.approval.status).toBe("approved");
  expect(fulfillment.data?.delivery.state).toBe("accepted");
  expect(fulfillment.data?.source_accounting.state).toBe("not_applicable");
  const directory = process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/public-demo";
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/journey-${Date.now()}.json`, JSON.stringify({ startedAt, origin, requestId: id, cookieFacts, csrfDenials: rejected, requestVersion: request.data?.version, fulfillment: fulfillment.data }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
});
