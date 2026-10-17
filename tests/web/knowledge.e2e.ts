import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test(
  "employee follows an answer to its exact policy fragment",
  { session: "employee" },
  async ({ app, screen, browser }) => {
    await app.open("/assistant");
    await screen
      .getByLabel("Ваш вопрос")
      .fill("Как подать заявление на отпуск?");
    await screen.getByRole("button", "Найти ответ").tap();
    await expect(browser).toHaveURL(/\/assistant\/answers\/[a-f0-9-]+$/);
    await expect(
      screen.getByRole("heading", "Как подать заявление на отпуск?", { level: 1 }),
    ).toBeVisible();
    await expect(screen.getByText("Выдержки из регламента")).toBeVisible();
    await expect(
      screen.getByRole("heading", "Проверьте основание"),
    ).toBeVisible();
    await screen
      .getByRole("link", /Отпуск и маршрут согласования/)
      .first()
      .tap();
    await expect(browser).toHaveURL(/\/knowledge\/citations\/[a-f0-9-]+$/);
    await expect(
      screen.getByRole("heading", "Отпуск и маршрут согласования", { level: 1 }),
    ).toBeVisible();
    await expect(screen.getByText("Действующая редакция")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText(
      "Чтобы подать заявку на отпуск",
    );
    await expect(screen.getByText("Версия и контрольная сумма")).toBeVisible();
  },
);
