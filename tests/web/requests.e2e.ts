import { test, type Browser } from "@e2e-dev/web";
import { credentials, expect, type App, type Screen } from "e2e";

async function signIn(app: App, screen: Screen, role: string) {
  const account = credentials.user(role);
  await app.open("/login");
  await screen.getByLabel("Имя пользователя").fill(account.username);
  await screen.getByLabel("Пароль").fill(account.password);
  await screen.getByRole("button", "Войти").tap();
  await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
}

async function changeRole(app: App, screen: Screen, role: string) {
  await screen.getByRole("button", "Выйти из кабинета").tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  await signIn(app, screen, role);
}

async function decide(screen: Screen, label: string, comment?: string) {
  await screen.getByRole("button", label).first().tap();
  await expect(screen.getByRole("heading", label)).toBeVisible();
  if (comment) await screen.getByLabel(/^Комментарий/).fill(comment);
  await screen.getByRole("button", label).last().tap();
}

async function requestPath(browser: Browser) {
  await expect(browser).toHaveURL(/\/requests\/[a-f0-9-]+$/);
  return new URL(await browser.url()).pathname;
}

test(
  "both requests finish through employee manager and HR with return history",
  { timeout: 240_000 },
  async ({ app, screen, browser }) => {
    const marker = `Browser journey ${Date.now()}`;
    await signIn(app, screen, "employee");
    await app.open("/requests/new?type=advance");
    await screen.getByLabel("Сумма аванса, KZT").fill("5000");
    await screen.getByLabel("Желаемая дата выплаты").fill("2027-01-15");
    await screen.getByLabel("Причина", { exact: true }).fill(marker);
    await screen.getByRole("button", "Сохранить черновик").tap();
    const advancePath = await requestPath(browser);
    await decide(screen, "Отправить на рассмотрение");
    await expect(screen.getByRole("main")).toContainText("У руководителя");

    await changeRole(app, screen, "manager");
    await app.open(advancePath);
    await decide(
      screen,
      "Вернуть на исправление",
      "Уточните причину и подтвердите сумму.",
    );
    await expect(screen.getByRole("main")).toContainText("На исправлении");

    await changeRole(app, screen, "employee");
    await app.open(advancePath);
    await screen
      .getByLabel("Причина", { exact: true })
      .fill(`${marker}, причина уточнена.`);
    await screen.getByRole("button", "Сохранить изменения").tap();
    await expect(screen.getByText("Изменения сохранены.")).toBeVisible();
    await decide(screen, "Отправить на рассмотрение");
    await expect(screen.getByRole("main")).toContainText("У руководителя");

    await changeRole(app, screen, "manager");
    await app.open(advancePath);
    await decide(screen, "Одобрить", "Сумма и основание проверены.");
    await expect(screen.getByRole("main")).toContainText("У HR");

    await changeRole(app, screen, "hr");
    await app.open(advancePath);
    await decide(screen, "Одобрить", "Проверка HR завершена.");
    await expect(screen.getByRole("main")).toContainText("Согласовано");

    await changeRole(app, screen, "employee");
    await app.open(advancePath);
    await expect(screen.getByRole("main")).toContainText(
      "Уточните причину и подтвердите сумму.",
    );
    await expect(
      screen.getByRole("heading", "История заявления"),
    ).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("Подача 2");
    await expect(screen.getByRole("button", "Одобрить")).toHaveCount(0);

    await app.open("/requests/new?type=leave");
    const future = new Date(
      Date.UTC(2028, 0, 1 + (Math.floor(Date.now() / 60_000) % 1000)),
    )
      .toISOString()
      .slice(0, 10);
    await screen.getByLabel("Первый день отпуска").fill(future);
    await screen.getByLabel("Последний день отпуска").fill(future);
    await screen
      .getByLabel("Причина", { exact: true })
      .fill(`${marker}, отпуск`);
    await screen.getByRole("button", "Сохранить черновик").tap();
    const leavePath = await requestPath(browser);
    await decide(screen, "Отправить на рассмотрение");
    await expect(screen.getByRole("main")).toContainText("У руководителя");
    await changeRole(app, screen, "manager");
    await app.open(leavePath);
    await decide(screen, "Одобрить");
    await expect(screen.getByRole("main")).toContainText("У HR");
    await changeRole(app, screen, "hr");
    await app.open(leavePath);
    await decide(screen, "Одобрить");
    await expect(screen.getByRole("main")).toContainText("Согласовано");
    await changeRole(app, screen, "employee");
    await app.open(leavePath);
    await expect(screen.getByRole("heading", "Исполнение")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("Не подтверждён");
    await expect(screen.getByRole("main")).toContainText("Подача 1");
    await expect(screen.getByRole("button", "Одобрить")).toHaveCount(0);
  },
);
