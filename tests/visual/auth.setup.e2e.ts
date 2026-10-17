import { test, type Cookie } from "@e2e-dev/web";

for (const role of ["employee", "manager", "hr"]) {
  test.setup(`visual session for ${role}`, { sessions: [`visual-${role}`] }, async ({ app, browser, session }) => {
    if (!app.baseUrl || !process.env.DEMO_PASSWORD) throw new Error("Synthetic visual environment is missing");
    const origin = new URL(app.baseUrl).origin;
    const csrfResponse = await fetch(new URL("/api/v1/auth/csrf/", origin));
    if (!csrfResponse.ok) throw new Error(`Visual CSRF request failed (${csrfResponse.status})`);
    const csrf: unknown = await csrfResponse.json();
    if (!csrf || typeof csrf !== "object" || !("csrf_token" in csrf) || typeof csrf.csrf_token !== "string") throw new Error("Visual CSRF response has no token");
    const cookies = new Map<string, Cookie>();
    function collect(headers: Headers) {
      for (const header of headers.getSetCookie()) {
        const first = header.split(";", 1)[0];
        const equals = first.indexOf("=");
        if (equals <= 0) continue;
        const name = first.slice(0, equals);
        cookies.set(name, { name, value: first.slice(equals + 1), url: origin, httpOnly: /;\s*httponly/i.test(header), secure: origin.startsWith("https:"), sameSite: "Lax" });
      }
    }
    collect(csrfResponse.headers);
    const login = await fetch(new URL("/api/v1/auth/login/", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrf_token, Origin: origin, Cookie: [...cookies.values()].map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
      body: JSON.stringify({ username: `${role}.demo`, password: process.env.DEMO_PASSWORD }),
    });
    if (!login.ok) throw new Error(`Visual role login failed (${login.status})`);
    collect(login.headers);
    await browser.setCookies([...cookies.values()]);
    await session.save(`visual-${role}`);
  });
}
