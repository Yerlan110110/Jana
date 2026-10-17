import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./schema";

export type { paths, components, operations } from "./schema";

type JanaClientOptions = {
  baseUrl: string;
  getCsrfToken: () => string | undefined;
  fetch?: ClientOptions["fetch"];
};

export function createJanaClient(options: JanaClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: "include",
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use({
    onRequest({ request }) {
      if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(request.method)) {
        const token = options.getCsrfToken();
        if (token) request.headers.set("X-CSRFToken", token);
      }
      return request;
    },
  });
  return client;
}
