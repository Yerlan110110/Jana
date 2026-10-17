import { mkdir } from "node:fs/promises";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { sessionClient } from "../web/api.js";
import { data } from "./views.js";
import { captureNativeViewport } from "../zoom/capture.js";

test("submitted leave and advance versions retain readable historical facts", { session: "visual-employee" }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Synthetic app URL is missing");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  const me = data(await client.GET("/api/v1/auth/me/"));
  if (!me.employee) throw new Error("Employee fixture is missing");
  const native = process.env.JANAMEN_ZOOM_FACTOR === "2";
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/submitted-${Date.now()}`;
  if (native) await mkdir(directory, { recursive: true });
  for (const kind of ["leave", "advance"] as const) {
    const requests = data(await client.GET("/api/v1/requests/", {
      params: { query: { employee: me.employee.id, kind, page_size: 100 } },
    }));
    const request = requests.results.find(record => record.status === "approved" && record.submission_number >= (kind === "advance" ? 2 : 1));
    if (!request) throw new Error(`A completed real ${kind} fixture with submitted history is required`);
    const record = data(await client.GET("/api/v1/requests/{id}/", { params: { path: { id: request.id } } }));
    for (const width of native ? [null] : [1280, 320]) {
      if (width !== null) await browser.setViewport({ width, height: 800 });
      await app.open(`/requests/${record.id}`);
      await expect(screen.getByRole("heading", "Поданные версии")).toBeVisible();
      for (const revision of record.revisions) {
        const disclosure = browser.locator("details").filter({ has: screen.getByText(new RegExp(`^Подача ${revision.number} ·`)) });
        await disclosure.getByText(new RegExp(`^Подача ${revision.number} ·`)).press("Enter");
        await expect(disclosure.getByText("Причина", { exact: true })).toBeVisible();
        const reason = disclosure.getByText(revision.payload.reason || "Не указана", { exact: true });
        await expect(reason).toBeVisible();
        await expect(disclosure.getByText(revision.payload.employee_name, { exact: true })).toBeVisible();
        await reason.scrollIntoView();
        if (native) await captureNativeViewport(browser, `${directory}/${kind}-submission-${revision.number}.png`);
        else await app.screenshot(`${kind}-submission-${revision.number}-${width}`);
      }
      const dimensions = await browser.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    }
  }
});
