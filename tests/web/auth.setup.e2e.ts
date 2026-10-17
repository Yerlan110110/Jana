import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

for (const role of ["employee", "manager", "hr"]) {
  test.setup(
    `sign in as ${role}`,
    { sessions: [role] },
    async ({ app, screen, session }) => {
      const account = credentials.user(role);
      await app.open("/login");
      await screen.getByLabel("Имя пользователя").fill(account.username);
      await screen.getByLabel("Пароль").fill(account.password);
      await screen.getByRole("button", "Войти").tap();
      await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
      await expect(
        screen.getByRole("button", "Выйти из кабинета"),
      ).toBeVisible();
      await session.save(role);
    },
  );
}
