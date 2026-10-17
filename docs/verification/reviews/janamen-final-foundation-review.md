# Final foundation delta review

Reviewed commit: `90eace197e322ccb30302845b37f0a339192c20a`, compared with independently reviewed `4380f289c41b6c0d9bee6e1a045c1b32960b6427`.

Date: 17 October 2026. Reviewer: `/root/core_knowledge_review`, a non-author of the implementation.

## Verdict at this commit

**Seed and authentication changes: PASS.** All eight selected repository checks passed on PostgreSQL.

**Committed contract consistency: BLOCKED by one confirmed generation-environment mismatch.** The committed schema reproduces exactly under SQLite, while the configured PostgreSQL CI regeneration produces different integer bounds and rejects the committed artifacts. This is a contract verification defect, not a failing seed or authentication behavior.

Root was notified with the exact discrepancy. No product code, generated contract or root documentation was edited by this reviewer.

## Scope and isolation

The commit was exported with `git archive` into `/tmp/janamen-review-90eace`. All source reads and checks used that export. The application interpreter/dependencies and pinned JavaScript generator were reused from the prepared main workspace; source and committed comparison artifacts came from the immutable export.

The bounded review covered:

- `seed_demo` JSON serialization of module manifests to the private credentials report and stdout.
- The new all-module seed/rerun regression.
- Test-only cache isolation and the real-CSRF login-throttle regression.
- `LoginView.get_authenticate_header`, its interaction with failed authentication, and preservation of CSRF/session behavior.
- Regeneration of the two refreshed contract artifacts.

The separate Academy/Integrations/Workbench reviews and the parent's full-suite gate were not repeated. Root's pending final documentation and native baseline-count artifact were not certified by this review.

## Passed source and behavior checks

### Complete module-manifest serialization

`backend/apps/core/management/commands/seed_demo.py` now passes `cls=DjangoJSONEncoder` to both the private-file `json.dump` and the stdout module-summary `json.dumps`. The Academy manifest's aware `computed_at` datetime therefore has a JSON representation in both output paths.

The file still uses a fresh exclusive temporary file with mode `0600` and atomic replacement. The stdout path still prints the module report, not the account password list. The surrounding seed transaction and existing-record preservation logic were not replaced by this correction.

The new full-seed regression executed all installed modules, parsed the written JSON, verified a timezone-aware serialized Academy timestamp, and confirmed 58 employees, 126 requests, 30 courses, 189 enrollments, 60 lessons, 90 questions, more than 20 policies and two accepted source-import batches. A second full seed preserved record counts across the listed domain/audit models and reported `preserved_existing`. The test also verified private file mode and absence of the demo password from stdout.

Those are the assertions this reviewer executed. The exact 36-policy native baseline count is separately owned by the parent's baseline evidence, rather than inferred from this test's `> 20` assertion.

### Test cache isolation preserves the actual request limit

`backend/conftest.py` clears Django's default cache before and after each test. It does not clear the cache between HTTP requests, alter the production rate, disable the throttle class or change a runtime view. This removes state accumulation between independent tests while leaving the same-test sequence intact.

`test_login_attempt_limit_remains_active_within_a_session` acquired a real CSRF token and submitted 11 incorrect logins from one client. It observed ten `401` results followed by `429`, the structured `throttled` code and a positive `Retry-After` value. That test passed together with the other login/session tests in the same process.

### Login response semantics and CSRF

`LoginView.get_authenticate_header` now returns `Session`. DRF can preserve an authentication failure as `401` even though this endpoint deliberately has an empty authenticator list. This change does not turn the login endpoint into an already-authenticated route or remove its `csrf_protect` decorator.

The existing real-CSRF test still rejected missing-CSRF login/logout with `403`, accepted a valid login, verified token rotation, logged out with the rotated token and denied the resulting anonymous session. The five active-profile/session regressions also passed.

## F1 — Medium, contract gate: generated integer metadata depends on database backend

**Evidence:** The current `RequestHistorySerializer` and `RequestRevisionSerializer` expose model-generated `PositiveIntegerField` metadata without explicit read-only field declarations or portable integer bounds. Under SQLite the three fields below have a 64-bit upper bound; under PostgreSQL they have a 32-bit upper bound.

| OpenAPI component field | Committed / reproduced SQLite schema | Regenerated PostgreSQL schema |
| --- | --- | --- |
| `RequestHistory.version` | maximum `9223372036854775807`, `format: int64` | maximum `2147483647`, no int64 annotation |
| `RequestHistory.submission_number` | maximum `9223372036854775807`, `format: int64` | maximum `2147483647`, no int64 annotation |
| `RequestRevision.number` | maximum `9223372036854775807`, `format: int64` | maximum `2147483647`, no int64 annotation |

**Trigger and consequence:** `.github/workflows/ci.yml:33` sets a PostgreSQL `DATABASE_URL` for the job. Its contract step runs `npm run contracts:check` at line 65. `scripts/contracts/generate.mjs:22–30` inherits that environment, generates the schema/types, and rejects any byte mismatch. Therefore the configured gate rejects this commit's SQLite-derived artifacts. The affected fields are response history/revision evidence; this finding does not assert a reachable write privilege or a practical overflow in ordinary request use.

**Executed confirmation:** OpenAPI validation with `--validate --fail-on-warn` and TypeScript generation both succeeded from the immutable commit. Comparison with the committed artifacts failed. There were only 33 unified OpenAPI diff lines and 21 TypeScript diff lines; the TypeScript changes remove three `Format: int64` comments. No endpoint/field-name or unrelated generated difference was observed.

- Committed OpenAPI SHA-256: `5a08a89873fa9c1c2559621a616fef616219b4c4de58b4b217172a57d5e341d9`.
- PostgreSQL regenerated OpenAPI SHA-256: `0d0a68dababa48064eccd96bd7de80fc84cc186429c6bfdb27839525b5a57b79`.
- A separate generation with `DATABASE_URL=sqlite:///:memory:` exactly matched the committed OpenAPI bytes and hash.

**Required correction:** Establish a database-independent public response contract or explicitly enforce one canonical generation backend across the script, committed artifacts and CI. Declaring the immutable evidence serializers read-only may also avoid backend-derived input validators; explicit portable bounds are another option. Regenerate the committed artifacts and verify them with the configured PostgreSQL CI environment. A SQLite-only successful contract check does not close this finding.

Remote GitHub CI was not run by this reviewer. The rejection follows from executed regeneration/comparison plus the inspected exact-match gate, not from an invented remote job result.

## Executed PostgreSQL test command

Working directory: `/tmp/janamen-review-90eace/backend`.

```bash
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest -q \
  apps/identity/tests/test_identity.py::test_login_requires_csrf_and_rotates_token \
  apps/identity/tests/test_session_revocation.py \
  apps/identity/tests/test_login_throttle.py \
  apps/core/tests/test_seeds.py::test_complete_seed_serializes_module_manifests_and_preserves_combined_records
```

Result: **8 passed, 7 warnings in 30.56 seconds**, using a fresh pytest-managed database on the dedicated local PostgreSQL 16.15 review instance. Warnings concerned absent collected static files in the temporary export. They are not evidence of a failed application request and do not certify static serving or Docker readiness.

## Temporary evidence

- `/tmp/janamen-review-90eace`: immutable source export.
- `/tmp/janamen-review-90eace-openapi.yaml`: PostgreSQL regeneration.
- `/tmp/janamen-review-90eace-schema.d.ts`: TypeScript generated from that PostgreSQL schema.
- `/tmp/janamen-review-90eace-sqlite-openapi.yaml`: exact SQLite reproduction of the committed schema.

Earlier accepted correction evidence remains in `/tmp/janamen-core-knowledge-review-followup.md`. No new comment audit or full application review is claimed here. A later correction can close F1 without changing the passed seed/authentication findings recorded for this commit.
