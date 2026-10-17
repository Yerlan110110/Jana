import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("sign in explains a throttled response without blaming the password", async ({
  app,
  screen,
  browser,
}) => {
  await browser.route("**/api/v1/auth/login/", async (route) => {
    await route.fulfill({
      status: 429,
      json: {
        code: "throttled",
        message: "Request was throttled.",
        field_errors: {},
        request_id: "synthetic-throttle-response",
      },
    });
  });
  await app.open("/login");
  await screen.getByLabel("Имя пользователя").fill("employee.demo");
  await screen.getByLabel("Пароль").fill("Incorrect-synthetic-password");
  await screen.getByRole("button", "Войти").tap();
  await expect(screen.getByRole("alert")).toContainText(
    "Слишком много попыток входа",
  );
  await expect(screen.getByRole("alert")).not.toContainText(
    "Проверьте имя и пароль",
  );
  await expect(screen.getByLabel("Имя пользователя")).toHaveValue(
    "employee.demo",
  );
});

test(
  "logout removes the previous account and returns to sign in",
  { session: "employee" },
  async ({ app, screen }) => {
    await app.open("/profile");
    await expect(screen.getByRole("heading", "Мой профиль")).toBeVisible();
    await screen.getByRole("button", "Выйти из кабинета").tap();
    await expect(
      screen.getByRole("heading", "Войдите в JanaMen"),
    ).toBeVisible();
    await expect(screen.getByRole("button", "Выйти из кабинета")).toHaveCount(
      0,
    );
    const account = credentials.user("manager");
    await screen.getByLabel("Имя пользователя").fill(account.username);
    await screen.getByLabel("Пароль").fill(account.password);
    await screen.getByRole("button", "Войти").tap();
    await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
    await expect(screen.getByRole("link", "Обучение команды")).toBeVisible();
    await app.open("/profile");
    await expect(screen.getByRole("heading", "Мой профиль")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("Аян Бекенов");
    await expect(screen.getByRole("main")).not.toContainText("Дана Нұрланқызы");
  },
);
