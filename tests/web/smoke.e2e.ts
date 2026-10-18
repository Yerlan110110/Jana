import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("the Docker web entry exposes a labeled sign-in form", async ({
  app,
  screen,
  browser,
}) => {
  await app.open("/login");
  await screen.getByRole("button", "Пропустить", { exact: true }).tap();
  await expect(screen.getByRole("heading", "Войдите в JanaMen")).toBeVisible();
  await expect(screen.getByLabel("Имя пользователя")).toBeVisible();
  await expect(screen.getByLabel("Пароль")).toBeVisible();
  await expect(screen.getByRole("button", "Войти")).toBeEnabled();
  await expect(
    screen.getByText("Демонстрационные данные.", { exact: false }),
  ).toBeVisible();
  expect(
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await app.screenshot("docker-sign-in");
});
