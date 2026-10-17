import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { changeRole, signIn } from "./support.js";

const otherTeam = {
  employee: "aa118562-b496-530d-b0f5-c50ef4c4ff8b",
  request: "3599ffb3-14fd-5be2-96e2-3f8786f460c9",
  name: "Тимур Есенов",
};
const otherEntity = {
  employee: "988ecbe1-ca5a-5d96-8e8d-4493c7de4d54",
  request: "5ee5e66a-3f95-5a79-9ebe-f30d851e4123",
  name: "Мадина Омарова",
};

test(
  "manager and HR enforce different scopes after an account switch",
  async ({ app, screen, browser }) => {
    await signIn(app, screen, "manager");
    const [team] = await Promise.all([
      browser.waitForResponse("**/api/v1/employees/?**"),
      app.open("/team"),
    ]);
    expect(team.status).toBe(200);
    const body = await team.text();
    expect(body).toContain("Дана Нұрланқызы");
    for (const forbidden of [otherTeam, otherEntity]) {
      expect(body).not.toContain(forbidden.employee);
      expect(body).not.toContain(forbidden.name);
      const [person] = await Promise.all([
        browser.waitForResponse(`**/api/v1/employees/${forbidden.employee}/`),
        app.open(`/team/${forbidden.employee}`),
      ]);
      expect(person.status).toBe(404);
      expect(await person.text()).not.toContain(forbidden.name);
      await expect(screen.getByRole("alert")).toContainText("Запись недоступна");
      await expect(screen.getByRole("main")).not.toContainText(forbidden.name);
      const [request] = await Promise.all([
        browser.waitForResponse(`**/api/v1/requests/${forbidden.request}/`),
        app.open(`/requests/${forbidden.request}`),
      ]);
      expect(request.status).toBe(404);
      expect(await request.text()).not.toContain(forbidden.name);
      await expect(screen.getByRole("alert")).toContainText("Запись недоступна");
      await expect(screen.getByRole("main")).not.toContainText(forbidden.name);
    }

    await changeRole(app, screen, "hr");
    await app.open(`/team/${otherTeam.employee}`);
    await expect(screen.getByRole("heading", otherTeam.name)).toBeVisible();
    await expect(screen.getByRole("heading", "Кадровые данные")).toBeVisible();
    await app.open(`/requests/${otherTeam.request}`);
    await expect(screen.getByRole("heading", "Заявление на аванс")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText(otherTeam.name);
    const [foreign] = await Promise.all([
      browser.waitForResponse(`**/api/v1/employees/${otherEntity.employee}/`),
      app.open(`/team/${otherEntity.employee}`),
    ]);
    expect(foreign.status).toBe(404);
    await expect(screen.getByRole("alert")).toContainText("Запись недоступна");
    await expect(screen.getByRole("main")).not.toContainText(otherEntity.name);
    const [foreignRequest] = await Promise.all([
      browser.waitForResponse(`**/api/v1/requests/${otherEntity.request}/`),
      app.open(`/requests/${otherEntity.request}`),
    ]);
    expect(foreignRequest.status).toBe(404);
    await expect(screen.getByRole("alert")).toContainText("Запись недоступна");
    await expect(screen.getByRole("main")).not.toContainText(otherEntity.name);

    await changeRole(app, screen, "foreign");
    await app.open("/profile");
    await expect(screen.getByRole("main")).toContainText(otherEntity.name);
    await app.open(`/requests/${otherEntity.request}`);
    await expect(screen.getByRole("heading", "Заявление на аванс")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText(otherEntity.name);

    await changeRole(app, screen, "employee");
    await app.open(`/team/${otherTeam.employee}`);
    await expect(screen.getByText("Раздел недоступен вашей роли", { exact: true })).toBeVisible();
    await expect(screen.getByRole("main")).not.toContainText(otherTeam.name);
    await app.open("/profile");
    await expect(screen.getByRole("heading", "Мой профиль")).toBeVisible();
    await expect(screen.getByRole("main")).toContainText("Дана Нұрланқызы");
    await expect(screen.getByRole("main")).not.toContainText("Алия Серікқызы");
  },
);

for (const role of ["manager", "hr"]) {
  test(
    `${role} cannot approve their own pending request`,
    { session: role },
    async ({ app, screen }) => {
      await app.open("/requests/new?type=advance");
      await screen.getByLabel("Сумма аванса, KZT").fill("1000");
      await screen.getByLabel("Желаемая дата выплаты").fill("2027-02-02");
      await screen.getByLabel("Причина", { exact: true }).fill(`Self-review denial ${role} ${Date.now()}`);
      await screen.getByRole("button", "Сохранить черновик").tap();
      await screen.getByRole("button", "Отправить на рассмотрение").first().tap();
      await expect(screen.getByRole("heading", "Отправить на рассмотрение")).toBeVisible();
      await screen.getByRole("button", "Отправить на рассмотрение").last().tap();
      await expect(screen.getByRole("main")).toContainText("У HR");
      await expect(screen.getByRole("button", "Одобрить")).toHaveCount(0);
      await expect(screen.getByRole("button", "Вернуть на исправление")).toHaveCount(0);
      await expect(screen.getByRole("button", "Отклонить")).toHaveCount(0);
    },
  );
}
