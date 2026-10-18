import { test } from "@e2e-dev/web";
import { authenticateSyntheticRole } from "./authenticate.js";

for (const role of ["employee", "manager", "hr"] as const) {
  test.setup(`visual session for ${role}`, { sessions: [`visual-${role}`] }, async ({ app, browser, session }) => {
    if (!app.baseUrl) throw new Error("Synthetic visual environment is missing");
    await authenticateSyntheticRole(browser, new URL(app.baseUrl).origin, role);
    await session.save(`visual-${role}`);
  });
}
