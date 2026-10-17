import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { changeRole, signIn } from "./support.js";

test(
  "published assigned course keeps failures and completion after archive",
  { timeout: 240_000 },
  async ({ app, screen, browser }) => {
    const marker = `Безопасная передача ${Date.now()}`;
    await signIn(app, screen, "hr");
    await app.open("/hr/courses/new");
    await screen.getByLabel(/^Код курса/).fill(`browser-course-${Date.now()}`);
    await screen.getByLabel("Название на русском").fill(marker);
    await screen
      .getByLabel("Описание и цель курса")
      .fill("Проверить право получателя перед передачей кадровых данных.");
    await screen.getByRole("button", "Добавить материал").tap();
    await screen.getByLabel("Название материала").fill("Проверьте получателя");
    await screen
      .getByLabel("Содержание", { exact: true })
      .fill(
        "Перед передачей кадрового документа проверьте право доступа получателя. Отправляйте документ только уполномоченному адресату. Если право доступа не подтверждено, уточните его у HR.",
      );
    await screen.getByRole("button", "Добавить вопрос").tap();
    await screen
      .getByLabel("Формулировка")
      .fill("Что нужно проверить перед передачей кадрового документа?");
    await screen
      .getByLabel("Текст варианта 1")
      .fill("Право доступа получателя");
    await screen
      .getByLabel("Текст варианта 2")
      .fill("Цвет рабочего стола получателя");
    await screen.getByLabel("Верный вариант").selectOption({ value: "a" });
    await screen
      .getByLabel("Объяснение для автора")
      .fill("Кадровые данные получает только уполномоченный адресат.");
    await expect(screen.getByLabel("Код материала")).toHaveCount(0);
    await expect(screen.getByLabel("Код вопроса")).toHaveCount(0);
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(browser).toHaveURL(/\/hr\/courses\/[a-f0-9-]+$/);
    const coursePath = new URL(await browser.url()).pathname;
    await screen.getByRole("button", "Опубликовать новую версию").tap();
    await expect(
      screen.getByRole("heading", "Опубликовать новую версию"),
    ).toBeVisible();
    await screen.getByRole("button", "Опубликовать новую версию").last().tap();
    await expect(screen.getByRole("button", "Архивировать курс")).toBeVisible();
    await expect(
      screen.getByText(new RegExp(`^Версия 1 · ${marker}`)),
    ).toBeVisible();
    await app.open("/hr/assignments");
    await screen.getByLabel("Поиск сотрудника").fill("Дана Нұрланқызы");
    await screen.getByRole("radio", /Дана Нұрланқызы/).check();
    await screen.getByLabel("Поиск курса").fill(marker);
    await screen.getByRole("radio", new RegExp(marker)).check();
    await screen.getByRole("button", "Назначить обучение").tap();
    await screen.getByRole("link", "Открыть назначение").tap();
    await expect(browser).toHaveURL(/\/academy\/enrollments\/[a-f0-9-]+$/);
    const enrollmentPath = new URL(await browser.url()).pathname;

    await changeRole(app, screen, "employee");
    await app.open(`${enrollmentPath}/quiz`);
    await expect(screen.getByRole("radio")).toHaveCount(0);
    await app.open(enrollmentPath);
    await screen.getByRole("button", "Начать обучение").tap();
    await screen.getByRole("button", "Подтвердить завершение материала").tap();
    await expect(
      screen.getByText("Завершение материала сохранено."),
    ).toBeVisible();
    await app.open(`${enrollmentPath}/quiz`);
    await screen.getByRole("radio", "Цвет рабочего стола получателя").check();
    await screen
      .getByRole("button", "Отправить ответы и завершить попытку")
      .tap();
    await expect(screen.getByRole("heading", "Тест не пройден")).toBeVisible();
    await expect(screen.getByText("0.00%", { exact: true })).toBeVisible();
    const failedPath = new URL(await browser.url()).pathname;
    await app.open(`${enrollmentPath}/quiz`);
    await screen.getByRole("radio", "Право доступа получателя").check();
    await screen
      .getByRole("button", "Отправить ответы и завершить попытку")
      .tap();
    await expect(screen.getByRole("heading", "Тест пройден")).toBeVisible();
    await expect(screen.getByText("100.00%", { exact: true })).toBeVisible();
    const passedPath = new URL(await browser.url()).pathname;

    await changeRole(app, screen, "hr");
    await app.open(coursePath);
    await screen.getByRole("button", "Архивировать курс").tap();
    await expect(
      screen.getByRole("heading", "Архивировать курс"),
    ).toBeVisible();
    await screen.getByRole("button", "Архивировать курс").last().tap();
    await expect(
      screen.getByRole("button", "Вернуть курс в каталог"),
    ).toBeVisible();
    await changeRole(app, screen, "employee");
    await app.open(
      `${passedPath}?enrollment=${enrollmentPath.split("/").pop()}`,
    );
    await expect(screen.getByRole("heading", "Тест пройден")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("В архиве");
    await expect(screen.getByRole("main")).toContainText("Завершено");
    await app.open(
      `${failedPath}?enrollment=${enrollmentPath.split("/").pop()}`,
    );
    await expect(screen.getByRole("heading", "Тест не пройден")).toBeVisible();
    await expect(screen.getByText("0.00%", { exact: true })).toBeVisible();
  },
);
