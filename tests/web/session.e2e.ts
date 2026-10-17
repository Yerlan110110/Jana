import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

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
