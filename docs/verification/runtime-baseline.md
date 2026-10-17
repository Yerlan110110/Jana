# Container baseline

Date: 17 October 2026. Source checkpoint: `f4a2be1dc35045b7d319c9ceeaf615e56a642178`.
Owner: runtime implementation agent. Isolated Compose project: `janamen-runtime-baseline`.
This report covers the existing backend. It does not establish frontend behavior or independent review.

## Observed results

- The full containerized PostgreSQL suite passed all 191 tests in 120.72 seconds. No failures or skips were reported.
- Pytest reported 153 warnings. These include missing test staticfiles and a database teardown warning because two sessions still accessed `test_janamen`. The test command exited zero. The warning remains unresolved.
- A clean release applied migrations, collected 154 static files, seeded the synthetic dataset and exited zero.
- API readiness returned `{"status":"ready"}` on port 8000. Compose reported the API healthy and the worker running.
- The existing HTTP workflow runner passed all 807 assertions. Its report recorded `mock_export_delivery_verified: true`. Both newly approved requests received mock export receipts from the containerized worker.
- Containerized Ruff reported `All checks passed!`.

The 807 assertions include repeated transport and response checks. They are not 807 distinct business scenarios. The runner created synthetic requests and a course in this isolated database. It used real HTTP sessions, CSRF and PostgreSQL persistence. It did not exercise a browser, a live model, real 1C or real Documentolog.

## Reproduce

Set synthetic local configuration through `python3 scripts/dev.py prepare`, then run from the repository root:

```bash
docker compose -p janamen-runtime-baseline --profile test run --build --rm test
docker compose -p janamen-runtime-baseline up --build -d api worker
curl --fail http://127.0.0.1:8000/api/v1/ready/
docker compose -p janamen-runtime-baseline --profile test run --rm test uv run --frozen ruff check .
```

Use the [HTTP runner instructions](../../scripts/verification/README.md) with the credentials generated inside this project's runtime volume. Request export verification with `--wait-for-exports 60`.

## Raw evidence and cleanup

Evidence is retained in the runtime worktree at `.artifacts/runtime-baseline/`:

- `postgresql-suite.log` is the cancelled predecessor's incomplete image-pull log. It proves no tests.
- `postgresql-suite-retry.log` and its `.exit` file contain the complete fresh suite and zero exit status.
- `startup.log`, `startup.exit`, `release.log`, `api-ready.json` and `service-status.txt` cover startup and readiness.
- `workflow-smoke.json` and `workflow-smoke.log` cover the HTTP journey and mock receipts.
- `ruff.log`, `backend-image.txt` and `docker-version-current.txt` identify the check and runtime.

Generated demo credentials are private, untracked and excluded from the Docker build context. They are not report evidence.
The unrelated `hermes-searxng` container was left untouched.
Stop only this project's containers with `docker compose -p janamen-runtime-baseline down` after integration review. Keep its volumes and evidence until the integrator accepts the result. Reuse this project name when resuming; do not create another baseline database.

## Decisions and review boundary

The Make Operations Idempotent principle kept startup on the existing release command and preserved volumes on restart. Laziness Protocol reused the repository's HTTP runner instead of adding another workflow checker. Writing for Agents made resumption and cleanup conditional on this isolated project, rather than a broad Docker cleanup.

Author review found no baseline-report standards or specification findings. Independent review remains open and belongs to the integrator. Frontend serving has a separate implementation and verification report.
