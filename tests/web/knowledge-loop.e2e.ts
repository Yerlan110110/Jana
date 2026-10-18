import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { changeRole, signIn } from "./support.js";

test(
  "HR publishes a new basis and employee verifies it until access is revoked",
  { timeout: 240_000 },
  async ({ app, screen, browser }) => {
    const question = "Что нужно для возмещения ночного такси после смены?";
    const title = `Ночное такси после смены ${Date.now()}`;
    const rule =
      "Демонстрационное правило JanaMen. Для возмещения ночного такси после смены сотрудник передаёт HR чек поездки и подтверждение руководителя смены. HR проверяет документы перед оформлением возмещения.";
    await signIn(app, screen, "employee");
    await app.open("/assistant");
    await screen.getByLabel("Ваш вопрос").fill(question);
    await screen.getByRole("button", "Найти ответ").tap();
    await expect(
      screen.getByText("Основание не найдено", { exact: true }),
    ).toBeVisible();
    await screen.getByRole("button", "Обратиться к HR").tap();
    await expect(browser).toHaveURL(/\/knowledge\/cases\/[a-f0-9-]+$/);
    const casePath = new URL(await browser.url()).pathname;

    await changeRole(app, screen, "hr");
    await app.open("/hr/policies/new");
    await screen.getByLabel("Название", { exact: true }).fill(title);
    await screen
      .getByLabel("Краткое описание")
      .fill("Синтетический порядок возмещения ночного такси после смены.");
    await screen
      .getByLabel("Заголовок раздела")
      .fill("Документы для возмещения ночного такси");
    await screen.getByLabel("Текст правила").fill(rule);
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(browser).toHaveURL(/\/hr\/policies\/[a-f0-9-]+$/);
    const policyPath = new URL(await browser.url()).pathname;
    await screen.getByLabel("Свой вопрос для проверки (необязательно)").fill(question);
    await screen.getByRole("button", "Сравнить ответы").tap();
    await expect(screen.getByText("Новых оснований: 1", { exact: true })).toBeVisible();
    await screen.getByRole("button", "Опубликовать сохранённую версию").tap();
    await expect(screen.getByText(/^Текущая редакция 1/)).toBeVisible();
    await app.open(casePath);
    await screen
      .getByLabel("Ответ сотруднику")
      .fill(
        "HR опубликовал демонстрационный порядок. Для проверки откройте связанное основание и подготовьте указанные документы.",
      );
    const revisionId = await screen
      .getByRole("option", new RegExp(title))
      .getAttribute("value");
    if (!revisionId)
      throw new Error("Published policy is absent from the scoped selection");
    await screen
      .getByLabel("Опубликованное основание")
      .selectOption({ value: revisionId });
    await screen
      .getByRole("button", "Сохранить ответ и закрыть обращение")
      .tap();
    await expect(
      screen.getByText("Ответ связан с опубликованным регламентом."),
    ).toBeVisible();

    await changeRole(app, screen, "employee");
    await app.open(casePath);
    await screen.getByRole("link", "Проверить основание").tap();
    await expect(screen.getByRole("heading", title)).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("чек поездки");
    await app.open("/assistant");
    await screen.getByLabel("Ваш вопрос").fill(question);
    await screen.getByRole("button", "Найти ответ").tap();
    await expect(
      screen.getByText("Выдержки из регламента", { exact: true }),
    ).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("чек поездки");
    const answerPath = new URL(await browser.url()).pathname;
    const citationPath = await screen
      .getByRole("link", new RegExp(title))
      .first()
      .getAttribute("href");
    if (!citationPath)
      throw new Error("Answer has no source link to the published policy");
    await screen.getByRole("link", new RegExp(title)).first().tap();
    await expect(screen.getByRole("heading", title)).toBeVisible();

    await changeRole(app, screen, "hr");
    await app.open(policyPath);
    await screen.getByLabel("Заголовок раздела").fill("Демонстрационный график работы");
    await screen.getByLabel("Текст правила").fill("Демонстрационный график работы отделения согласует руководитель. Рабочая смена начинается по утверждённому расписанию.");
    await expect(screen.getByRole("button", "Сравнить ответы")).toBeDisabled();
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(screen.getByRole("button", "Сравнить ответы")).toBeEnabled();
    await screen.getByLabel("Свой вопрос для проверки (необязательно)").fill(question);
    await screen.getByRole("button", "Сравнить ответы").tap();
    await expect(screen.getByText("Изменятся: 1", { exact: true })).toBeVisible();
    await screen.getByLabel("Название", { exact: true }).fill(`График работы ${Date.now()}`);
    await expect(screen.getByText("Изменятся: 1", { exact: true })).toHaveCount(0);
    await screen.getByRole("button", "Сохранить черновик").tap();
    await expect(screen.getByRole("button", "Сравнить ответы")).toBeEnabled();
    await screen.getByRole("button", "Сравнить ответы").tap();
    await expect(screen.getByText("Потеряют источник: 1", { exact: true })).toBeVisible();
    await screen.getByLabel("Текст правила").fill(rule);
    await expect(screen.getByText("Потеряют источник: 1", { exact: true })).toHaveCount(0);
    await app.open(policyPath);
    await expect(screen.getByText(/^Текущая редакция 1/)).toBeVisible();
    await browser.onDialog("accept");
    await screen.getByRole("button", "Убрать в архив").tap();
    await expect(screen.getByText("В архиве", { exact: true })).toBeVisible();
    await changeRole(app, screen, "employee");
    await app.open(`${casePath}/source`);
    await expect(
      screen.getByText("Основание недоступно", { exact: true }),
    ).toBeVisible();
    await expect(screen.getByRole("main")).not.toContainText("чек поездки");
    await app.open(citationPath);
    await expect(screen.getByRole("alert")).toBeVisible();
    await expect(screen.getByRole("main")).not.toContainText("чек поездки");
    await app.open(answerPath);
    await expect(screen.getByRole("main")).toContainText(
      "Прежнее основание больше недоступно",
    );
    await expect(screen.getByRole("link", new RegExp(title))).toHaveCount(0);
  },
);
