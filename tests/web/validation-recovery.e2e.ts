import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import { sessionClient } from "./api.js";
import { signIn } from "./support.js";

test("server field validation focuses and describes the unchanged amount", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  await app.open("/requests/new?type=advance");
  const amount = screen.getByLabel("Сумма аванса, KZT");
  await amount.fill("1000000000000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-01-15");
  await screen.getByLabel("Причина", { exact: true }).fill("Проверка серверной валидации");
  await screen.getByRole("button", "Сохранить черновик").tap();
  await expect(screen.getByRole("alert")).toBeVisible();
  await expect(amount).toHaveValue("1000000000000");
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toHaveAttribute("aria-describedby");
  await expect(amount).toBeFocused();
  const association = await browser.evaluate(() => {
    const field = document.querySelector('input[name="amount"]');
    const id = field?.getAttribute("aria-describedby");
    return { text: id ? document.getElementById(id)?.textContent ?? null : null };
  });
  expect(association.text).toContain("12");
  await amount.fill("5000");
  await expect(amount).not.toHaveAttribute("aria-invalid", "true");
  await expect(screen.getByLabel("Причина", { exact: true })).toHaveValue("Проверка серверной валидации");
});

test("unsent quiz answers survive cancelled link and history navigation", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  if (!app.baseUrl) throw new Error("Synthetic application URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const result = await client.GET("/api/v1/academy/enrollments/", { params: { query: { page_size: 100 } } });
  const enrollment = result.data?.results.find((item) => item.allowed_actions.includes("submit_attempt"));
  if (!enrollment) throw new Error("A real eligible quiz is required");
  const path = `/academy/enrollments/${enrollment.id}/quiz`;
  await app.open(`/academy/enrollments/${enrollment.id}`);
  await screen.getByRole("link", /^Тест ·/).tap();
  const choice = screen.getByRole("radio").first();
  await choice.check();
  await screen.getByRole("link", "К материалам и истории").tap();
  await expect(screen.getByRole("dialog", "Уйти без отправки ответов?")).toBeVisible();
  await screen.getByRole("button", "Остаться в тесте").tap();
  await expect(browser).toHaveURL(path);
  await expect(choice).toBeChecked();
  await browser.evaluate(() => { history.back(); return true; });
  await expect(screen.getByRole("dialog", "Уйти без отправки ответов?")).toBeVisible();
  await browser.keyboard.press("Escape");
  await expect(browser).toHaveURL(path);
  await expect(choice).toBeChecked();
  let observed: (() => void) | undefined;
  const unload = new Promise<void>((resolve) => { observed = resolve; });
  const stop = await browser.onDialog(async (dialog) => {
    await dialog.dismiss();
    observed?.();
  });
  await browser.evaluate(() => { location.reload(); return true; });
  await unload;
  await stop();
  await expect(browser).toHaveURL(path);
  await expect(choice).toBeChecked();
  await screen.getByRole("link", "К материалам и истории").tap();
  await screen.getByRole("button", "Уйти без отправки").tap();
  await expect(browser).toHaveURL(`/academy/enrollments/${enrollment.id}`);
});

test("a delayed previous-session response cannot sign out the next account", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  await app.open("/requests/new?type=advance");
  await screen.getByLabel("Сумма аванса, KZT").fill("5000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-01-15");
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const received = new Promise<void>((resolve) => { started = resolve; });
  await browser.route("**/api/v1/requests/", async (route) => {
    if (route.request.method !== "POST") return route.fallback();
    started?.();
    await blocked;
    await route.fulfill({ status: 401, json: { code: "not_authenticated", field_errors: {} } });
  });
  await screen.getByRole("button", "Сохранить черновик").tap();
  await received;
  if (!app.baseUrl) throw new Error("Synthetic application URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  expect((await client.POST("/api/v1/auth/logout/")).response.status).toBe(204);
  await screen.getByRole("link", "Мой профиль").tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  const manager = credentials.user("manager");
  await screen.getByLabel("Имя пользователя").fill(manager.username);
  await screen.getByLabel("Пароль").fill(manager.password);
  await screen.getByRole("button", "Войти").tap();
  await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
  const response = browser.waitForResponse("**/api/v1/requests/");
  release?.();
  expect((await response).status).toBe(401);
  await screen.getByRole("link", "Обучение команды").tap();
  await expect(screen.getByRole("heading", "Обучение команды")).toBeVisible();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toHaveCount(0);
});

test("an expired session returns a failed write to sign in and clears the previous role", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  await app.open("/requests/new?type=advance");
  await screen.getByLabel("Сумма аванса, KZT").fill("5000");
  await screen.getByLabel("Желаемая дата выплаты").fill("2027-01-15");
  if (!app.baseUrl) throw new Error("Synthetic application URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  expect((await client.POST("/api/v1/auth/logout/")).response.status).toBe(204);
  await screen.getByRole("button", "Сохранить черновик").tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  await expect(screen.getByRole("button", "Выйти из кабинета")).toHaveCount(0);
  await signIn(app, screen, "manager");
  await app.open("/profile");
  await expect(screen.getByRole("main")).toContainText("Аян Бекенов");
  await expect(screen.getByRole("main")).not.toContainText("Дана Нұрланқызы");
});

test("normal sign out also recovers when the server session is already absent", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  if (!app.baseUrl) throw new Error("Synthetic application URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  expect((await client.POST("/api/v1/auth/logout/")).response.status).toBe(204);
  await screen.getByRole("button", "Выйти из кабинета").tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
});

test("a forbidden resource does not expire a valid session", async ({ app, browser, screen }) => {
  await signIn(app, screen, "employee");
  await browser.route("**/api/v1/requests/?*", async (route) => {
    await route.fulfill({ status: 403, json: { code: "permission_denied", message: "Forbidden", field_errors: {} } });
  });
  await app.open("/requests");
  await expect(screen.getByRole("alert")).toContainText("Действие недоступно");
  await expect(screen.getByRole("button", "Выйти из кабинета")).toBeVisible();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toHaveCount(0);
});
