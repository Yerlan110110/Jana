# Same-origin frontend serving

Date: 17 October 2026. Runtime implementation follows backend baseline commit `871a278`.
The integrator owns frontend source, package manifests and lockfiles. This change owns container serving and configuration.

## Contract

`frontend` is a standalone npm package. Its API client is `file:../packages/api-client`; the root workspace still owns `packages/*`.
The Node build installs the frozen root dependencies, then the frozen frontend dependencies, then runs `npm --prefix frontend run build`. The root installation supplies the sibling API client's dependencies. Without it, an isolated build failed to resolve `openapi-fetch`. No package manifests were changed by this worker.

The final image copies only `frontend/dist` and the nginx configuration. It carries no Node runtime, backend code or source credentials. Fixed image tags follow the repository's existing convention. The observed image digests are retained in the local evidence directory.

nginx serves the SPA, falls back to `index.html` for deep links, and forwards `/api` unchanged to `api:8000`. It preserves the original Host header including the port. Django therefore compares the browser Origin with the actual same-origin request when enforcing CSRF. Unknown API routes and missing `/assets/` files do not become a successful SPA response.

Compose binds the product to loopback port `${FRONTEND_PORT:-8080}`. `${API_PORT:-8000}` remains available for direct API access. The frontend waits for API health; API and worker retain their release dependency. A frontend healthcheck requests its built index.

`.dockerignore` excludes `.artifacts`, `.worktrees` and generated `dist` directories. Existing exclusions keep environment files and runtime credentials outside the build context.

## Observed verification

The actual in-progress frontend snapshot could not build. The first attempt failed on the sibling API client's missing `openapi-fetch`. After adding the root dependency install, the remaining errors were missing Pace component files in that snapshot. These logs remain evidence of an incomplete frontend integration, not a successful product build.

A separate marked serving fixture used the same Dockerfile, nginx config, root and frontend manifests and locks, generated API client, Vite config and TypeScript config. Its only screen was `Runtime serving fixture`. It imported the real API client and built successfully through the standalone frontend command. No fixture file was written into product source.

The resulting image ran as the Compose `frontend` service against the isolated PostgreSQL/API/worker baseline. Observed checks passed:

- The root returned the built index with `Cache-Control: no-cache`.
- A deep link with query parameters returned the same SPA entrypoint.
- The built JavaScript asset returned JavaScript content.
- `/api/v1/ready/` returned the backend readiness JSON.
- A missing asset, unknown API resource and bare `/api` returned 404 rather than the SPA entrypoint.
- `nginx -t` passed.
- The existing HTTP workflow runner passed all 807 assertions through port 8080. Its Origin header, cookies, CSRF, pagination and persisted workflows passed through the proxy. `mock_export_delivery_verified` was true.

The direct API run and proxied run are two executions of the same runner, not distinct test inventories. Both created their own synthetic records in the isolated database. Browser layout and interaction, complete frontend source, live models and real external integrations remain unverified here.

## Evidence and integration gate

Raw files remain under `.artifacts/runtime-baseline/` in the runtime worktree:

- `frontend-build.log` records the failed clean frontend build.
- `frontend-build-root-deps.log` records the failure after root dependency installation.
- `frontend-fixture-build.log` and `.exit` record the successful serving fixture build.
- `serving-checks.json`, `nginx-config-check.log` and `service-status-with-proxy.txt` record serving checks.
- `proxy-workflow-smoke.json` and `.log` record the successful same-origin HTTP journey.
- `frontend-base-digests.jsonl` identifies the observed base images.
- `frontend-context` preserves the source snapshot that failed. `serving-fixture` preserves the marked serving probe. `fixture-compose.yaml` selects its image.

When the integrator merges the frontend source and locks, run `docker compose build frontend`, then `python3 scripts/dev.py up`. Repeat the serving checks against the product image and use the project's browser acceptance workflow for real role journeys. The fixture result does not close that integration gate.

The fixture container is stopped after verification so it cannot be mistaken for the product. Evidence and isolated volumes remain until integration review. Stop the remaining baseline services with `docker compose -p janamen-runtime-baseline down`. Retain volumes unless the integrator explicitly retires this synthetic run.

## Decisions and review

Laziness Protocol kept nginx static serving and the existing API/worker startup commands. Model the Domain kept serving ownership in one Compose service and one nginx config instead of adding a second backend. Make Operations Idempotent preserved database volumes and the existing repeatable release command. Writing for Agents gives two distinct triggers: integrated-source verification and retirement of the isolated run.

Author Standards review found no remaining findings against the fixed point `f4a2be1`, including untracked nginx configuration. Author Spec review found the requested serving behavior implemented and fixture-verified, with the real-source integration gate explicitly open. No independent reviewer ran. The integrator retains that gate.
