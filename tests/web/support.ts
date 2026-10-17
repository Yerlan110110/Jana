import { credentials, expect, type App, type Screen } from "e2e";

export async function signIn(app: App, screen: Screen, role: string) {
  const account = credentials.user(role);
  await app.open("/login");
  await screen.getByLabel("Имя пользователя").fill(account.username);
  await screen.getByLabel("Пароль").fill(account.password);
  await screen.getByRole("button", "Войти").tap();
  await expect(screen.getByRole("heading", /^Здравствуйте/)).toBeVisible();
}

export async function changeRole(app: App, screen: Screen, role: string) {
  await screen.getByRole("button", "Выйти из кабинета").tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  await signIn(app, screen, role);
}
