import type { Browser, Cookie } from "@e2e-dev/web";
import type { Role } from "./views.js";

export async function authenticateSyntheticRole(browser: Browser, origin: string, role: Role) {
  const url = new URL(origin);
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  const publicFixture = url.protocol === "https:" && url.hostname === process.env.PUBLIC_HOST && url.hostname.endsWith(".trycloudflare.com") && process.env.JANAMEN_PUBLIC_PROJECT === "janamen-public";
  if ((!loopback && !publicFixture) || !process.env.DEMO_PASSWORD) throw new Error("Select an authorized synthetic visual environment");
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
}
