# Generated JanaMen API client

This package has no frontend framework dependency. The backend owns the API shape. `openapi-typescript` generates `src/schema.d.ts` from `contracts/openapi.yaml`, and `openapi-fetch` uses those types for requests and responses.

From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run contracts:generate
npm run contracts:check
```

Use the server origin as `baseUrl`, such as `http://localhost:8000`. The generated paths already contain `/api/v1/`. The factory sends session cookies and reads the current CSRF token through the supplied getter before each unsafe request. Obtain the token from `/api/v1/auth/csrf/`, and replace it with the rotated token returned by login.

```ts
import { createJanaClient } from "@janamen/api-client";

let csrfToken: string | undefined;
const api = createJanaClient({
  baseUrl: "http://localhost:8000",
  getCsrfToken: () => csrfToken,
});
const token = await api.GET("/api/v1/auth/csrf/");
csrfToken = token.data?.csrf_token;
```

The application owns session UI, cache invalidation, login, errors and navigation. Clear user-specific caches on logout or identity change. Never share a mutable authenticated client across users in a server-rendering process. The browser cookie jar is not automatically available to a server-side fetch implementation.

Pass the same `Idempotency-Key` when retrying one unchanged command after a lost response. A changed payload is a new command. Read the latest version after a 409 before asking the user to submit again. This package does not automatically retry mutations or invent business command identifiers.

Generated types describe the schema; they do not validate untrusted runtime data. Server validation and access checks remain authoritative. Inspect [the integration guide](../../docs/architecture/api-contract-guide.md) and the actual operation schema before building a form.
