---
name: verify-janamen
description: Run JanaMen's real Docker web application through employee, manager and HR journeys, preserve browser evidence, and check roles, states and source-backed outcomes before accepting a change.
---

# Verify JanaMen

## Read first

Run `npx e2e guide setup`, `npx e2e guide writing-tests`, and `npx e2e guide running` for the installed engine's current contract. The project uses `e2e.config.ts` and `tests/web/**/*.e2e.ts`. Read `features/README.md`, `docs/continuation-status.md` and the changed feature's charter. Read `docs/design/state-and-data-contracts.md` for visible states. The native e2e skill is available at `/home/yqecea/.codex/skills/e2e/SKILL.md` on this host. The CLI guides are the portable alternative.

## Launch

Confirm the Git top level is Jana. Run `python3 scripts/dev.py prepare`. Run `LOGIN_THROTTLE_RATE=120/min docker compose -p janamen-demo up --build -d db api worker frontend`. This starts an isolated synthetic database, release migrations/seed, API, worker and nginx. The frontend is at `http://127.0.0.1:8080`, API at port 8000. `docker compose -p janamen-demo ps` must show healthy db, api and frontend, with a running worker. `curl --fail http://127.0.0.1:8080/api/v1/ready/` must succeed.

The synthetic browser fixture raises only its own login rate because a complete suite performs more than ten role logins in one minute. The application default remains `10/min`. The backend test container explicitly keeps `10/min` and verifies the eleventh failed attempt receives 429. Never use the browser-fixture override as evidence that rate limiting is absent or as a public-demo setting.

The config attaches to this instance. It does not start or stop Docker. The root `.env` contains generated local synthetic credentials and is ignored. The config loads it locally, declares named credentials employee, manager and hr, and never puts values in source. `JANAMEN_WEB_URL` selects another explicitly authorized synthetic instance. Never run these mutating journeys against a real personnel database. One worker runs at a time because all roles share one workflow database. Another writer must use a different Compose project and ports.

## Doctor

Run `npx e2e list`. Then run `npx e2e run tests/web/smoke.e2e.ts --trace on --output .artifacts/browser/doctor-<unique-run>`. Both must exit 0. The smoke checks the actual Docker sign-in entry and labeled fields, then retains a screenshot. For signed-in readiness run `npx e2e run tests/web/knowledge.e2e.ts --trace on --output .artifacts/browser/knowledge-<unique-run>`. Selecting this test also runs its employee setup. The setup file alone is not a doctor.

## Drive

Use T3 `preview_status`, then `preview_open` if needed, to inspect and drive the collaborative browser. Use semantic snapshot locators. An unavailable preview is not established until `preview_open` reports it. The e2e MCP server is not registered in this session. Do not claim MCP discovery from CLI installation. If a supported e2e MCP session becomes available, follow `npx e2e guide mcp` and use `locate` before writing its locators.

The deterministic lane uses the installed e2e CLI with no model. Tests import `test` from `@e2e-dev/web`, and `expect` and `credentials` from `e2e`. Named sessions employee, manager and hr sign in through the real form. Use labels, roles, exact values and URL/result assertions. Keep expected versions and all changing command fields inside the `useCommand` values object. Exercise stale writes and uncertain retries at the network boundary. Do not inject business state with React setters or invent test-only approval endpoints.

## Evidence

Use a unique `--output .artifacts/browser/<run>` for every retained run. Default `.e2e/results/` is replaced by the next run. Keep the report, step trace and failed screenshots. Inspect the output before counting a pass. Trace and screenshot permissions follow the engine. After a Secret fill, engine screenshots are withheld for that session. Never bypass that restriction or claim missing images were inspected. Collaborative preview captures and model-free deterministic assertions are separate evidence.

Prove the action and resulting server state. A notification read does not decide a request. A successful assessment is not course completion until required material is complete. Receipt, approval and source accounting are independent. A resolved HR case is not model training; only a separately published revision supplies new retrieval evidence. Preserve unique IDs and check persistence through a fresh read, account switch or reopen. Mock business integrations only at the existing 1C, Documentolog and optional generation boundaries. A replayed HTTP error proves its presentation only. A transport interruption must retain the actual server commit and subsequent read as evidence. Do not capture cookies, CSRF values, passwords or raw source payloads in public reports.

On Linux, `docker compose --profile test run --build --rm browser-test` runs the same role suite in an isolated browser image. Its host network reaches the app through loopback because the browser engine rejects plain HTTP on non-loopback hosts. The fixture shares the selected Compose project's synthetic credentials. It writes `.artifacts/browser/ci/`; retain that directory before another run. CI uploads trace summaries, not saved sessions or cookies.

## Bug bash

Use the charters in `features/`. An exploratory model is not configured. Agent-driven `e2e explore` remains unproven until an authorized model actually runs the mapped charter. Do not invent a passing bug bash. A future local bug-bash config stays ignored under `.e2e/bugbash/`. Keep one signed-in charter per session and one writer to the database. A reported defect becomes a verified bug only after its specific assertion fails with `ASSERTION_FAILED` in `tests/web/bugbash/<slug>.e2e.ts`.

Manual T3 adversarial inspection may proceed without a model. Record its scope separately. The app cannot perform real 1C imports, real Documentolog delivery, real payments, legal signatures, automated HR decisions or unrestricted generative answers.

## Cleanup

Close only preview tabs and processes you own. The CLI closes its isolated browser. It does not own the attached Docker stack. Stop an owned stack with `docker compose -p janamen-demo down` after active users and tests finish. Keep volumes unless deletion is separately authorized. Keep evidence in `.artifacts/browser/`, not in a removable worktree. Remove transient fault injection after checking recovery. Never reset source data or delete unique requests to obtain a green run.

## Helpers

No extra launcher is required. `scripts/dev.py` prepares the existing Docker environment. The installed e2e CLI drives it. `features/README.md` records which features have actually passed.
