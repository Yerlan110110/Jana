import { mkdir, writeFile } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "../web/api.js";
import { data } from "./views.js";

test("the complete assessment action fits its narrow control", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const me = data(await client.GET("/api/v1/auth/me/"));
  if (!me.employee) throw new Error("Visual employee profile is missing");
  const enrollments = data(await client.GET("/api/v1/academy/enrollments/", {
    params: { query: { employee: me.employee.id, page_size: 100 } },
  }));
  const enrollment = enrollments.results.find((item) => item.allowed_actions.includes("submit_attempt"));
  if (!enrollment) throw new Error("A real eligible assessment is required");
  const name = "Отправить ответы и завершить попытку";
  await browser.setViewport({ width: 320, height: 800 });
  await app.open(`/academy/enrollments/${enrollment.id}/quiz`);
  await expect(screen.getByRole("heading", "Вопросы", { exact: true })).toBeVisible();
  await browser.evaluate(() => document.fonts.ready.then(() => true));
  await screen.getByRole("button", name).scrollIntoView();
  const geometry = await browser.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
    const text = button?.querySelector(".button-label");
    if (!button || !text) throw new Error("The real assessment action is missing");
    const bounds = button.getBoundingClientRect();
    const content = text.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      label: { left: content.left, right: content.right, top: content.top, bottom: content.bottom },
      content: {
        left: bounds.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
        right: bounds.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth),
        top: bounds.top + parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth),
        bottom: bounds.bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth),
      },
    };
  }, name);
  const screenshot = await app.screenshot("assessment-action-320");
  await mkdir(".artifacts/visual", { recursive: true });
  await writeFile(`.artifacts/visual/action-${Date.now()}.json`, JSON.stringify({ geometry, screenshot }, null, 2) + "\n", { flag: "wx" });
  expect(geometry.label.left).toBeGreaterThanOrEqual(geometry.content.left - 1);
  expect(geometry.label.right).toBeLessThanOrEqual(geometry.content.right + 1);
  expect(geometry.label.top).toBeGreaterThanOrEqual(geometry.content.top - 1);
  expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.content.bottom + 1);
});
