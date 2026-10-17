import type { Browser } from "@e2e-dev/web";
import { createJanaClient } from "@janamen/api-client";
import { expect } from "e2e";

export async function sessionClient(browser: Browser, origin: string) {
  const cookie = (await browser.cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  let csrf: string | undefined;
  const client = createJanaClient({
    baseUrl: origin,
    getCsrfToken: () => csrf,
    fetch: async (request) => {
      request.headers.set("Cookie", cookie);
      request.headers.set("Origin", origin);
      return fetch(request);
    },
  });
  const token = await client.GET("/api/v1/auth/csrf/");
  expect(token.response.status).toBe(200);
  if (!token.data) throw new Error("Authenticated fixture has no CSRF response");
  csrf = token.data.csrf_token;
  return { client, cookie };
}
