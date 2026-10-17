# Independent correction verification

Reviewed immutable revision: `4380f289c41b6c0d9bee6e1a045c1b32960b6427`.

Date: 17 October 2026. Reviewer: `/root/core_knowledge_review`, independent of the implementation authors.

## Verdict

**PASS for the assigned correction scope.** The four accepted findings R1–R4 in `/tmp/janamen-core-knowledge-review.md` are corrected in the inspected commit. The two assigned UUID relation filters and the revised-submission fixture also pass the targeted review. No blocking finding remains in this delta scope.

This verdict applies to the correction code and the executed checks below. It is not a certification of a Docker deployment, browser UI, live model provider, real external adapters, or the separately assigned Integrations/Workbench review. Root-owned documentation corrections remain a separate handoff task and were not re-audited here.

## Immutable source and method

The committed tree was exported with `git archive` into `/tmp/janamen-review-4380f2`. Source inspection and tests used that export, so concurrent changes in the main checkout could not alter the reviewed application code.

Inspected changes included the shared authentication class and selectors, CORS configuration, Compose environment forwarding, `.env.example`, request validation and command callers, request/employee FilterSets and their view wiring, request seed changes, and the corresponding committed regression tests.

Only temporary reviewer test files were created under the exported tree. No implementation or documentation file in the main repository was modified. PostgreSQL execution used the dedicated `janamen_review` database on the existing local PostgreSQL 16.15 server, with a fresh pytest-managed test database. The interpreter and dependencies came from the main backend's prepared virtual environment; imported application source came from the immutable export.

## Correction results

| Item | Result | Inspected implementation and executed evidence |
| --- | --- | --- |
| R1 — Active employee session boundary | **PASS** | `apps.identity.authentication.SessionAuthentication.authenticate` preserves DRF authentication/CSRF behavior, checks the active employee profile, calls Django `logout` on the underlying request, and raises authentication failure. The explicit technical-superuser exception remains. Five real-cookie committed cases pass for the three first-access paths (`me`, notification list, mark-read), missing profile and technical superuser. The existing login/CSRF/logout guard also passes. |
| R1 — Retained cookie after reactivation | **PASS** | An independent test retained the original raw session cookie before deactivation, observed a 401, verified that the corresponding `django_session` row was deleted, reactivated the employee, and sent the retained cookie from a new client. Both `auth/me` and notifications remained 401. This establishes server-side invalidation of the observed session, not merely removal of a cookie from the first test client. |
| R2 — CORS command and response headers | **PASS** | `config.settings` extends the library's `default_headers` with `idempotency-key` and exposes `Idempotency-Replayed` and `X-Request-ID`. Four committed HTTP tests pass: POST/PATCH preflights, rejection of an unknown origin, and exposure of response headers. The original independent preflight reproducer now passes. Explicit origins and credential handling are retained. |
| R3 — Provider selector through Compose | **PASS** | `.env.example` declares the safe `extractive` default. The shared Compose application environment forwards `KNOWLEDGE_GENERATION_PROVIDER`, inherited by API, release and worker. Actual Compose JSON rendering produced `extractive` for all three with the selector unset, and `openai` for all three with it set. Only synthetic required placeholders and empty model/key values were supplied; no model request occurred. |
| R4 — Computed leave-day overflow | **PASS** | `validate_details` calculates the day count and runs the existing `leave_days` model field validators before assigning the value. It maps a validation failure to an `end_date` field error. Both create and draft-edit callers use this common validation before persistence. The two committed rollback tests and the original oversized-date reproducer pass on PostgreSQL. |
| R4 — Adjacent representable bound | **PASS** | An independent API test accepted a draft of 99,999 whole days as `99999.00`, then rejected an edit to 100,000 days with 400 and an `end_date` error. Version, stored amount, event count and idempotency-receipt count remained unchanged after the rejected edit. This is a storage-boundary check, not an assertion that such a period is an approved business entitlement. |
| Request employee filter | **PASS** | `RequestFilter.employee` uses `UUIDFilter(field_name="employee_id")` over `visible_requests`, avoiding a global related-object existence validation. The committed scoped-filter case returns 200/empty for both another entity's employee UUID and a nonexistent UUID, and 400 for malformed UUID text. |
| Employee department filter | **PASS** | `EmployeeFilter.department` uses `UUIDFilter(field_name="department_id")` over `visible_employees`. The corresponding committed case returns 200/empty for both a hidden department and a nonexistent UUID, and 400 for malformed text. Existing employee/manager/HR list-scope tests also pass. |
| Revised-submission fixture | **PASS** | The primary returned leave example now performs return → draft correction → submission → second return through the actual services. The fresh-seed test verifies submission number 2, distinct immutable revision reasons, all seven statuses for both request types, 126 requests, and seed-rerun preservation of later user changes and event/revision/notification counts. |

The session finding is closed for the implemented request-time boundary: a request that encounters an inactive or missing employee profile rejects access and invalidates that observed session. This does not claim an eager sweep of every session at the moment of a source change.

## Executed test record

The first PostgreSQL command was:

```bash
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest -q \
  apps/identity/tests \
  apps/hr_requests/tests/test_date_bounds.py \
  apps/core/tests/test_scoped_filters.py \
  apps/core/tests/test_seeds.py \
  review_tests -k 'not academy'
```

Working directory: `/tmp/janamen-review-4380f2/backend`.

That invocation reported **29 passed, 2 failed, 2 deselected** in 27.80 seconds. All **26 repository tests** selected for this review passed: 16 identity/CORS/session tests, 2 date-bound tests, 2 assigned relation-filter cases and 6 seed tests. The two failures were additional reviewer tests at their login setup: preceding real-login tests had consumed the existing per-process 10/minute throttle, so login returned 429 before either independent assertion could run. No production setting or throttle was disabled to work around this.

The five independent tests were then run in a fresh pytest process using the same immutable source and dedicated PostgreSQL database:

```bash
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest -q review_tests
```

Result: **5 passed** in 3.64 seconds. These are the three original independent reproducers plus retained-cookie and adjacent-day-boundary checks. Therefore all **31 distinct assigned/reproducer checks** passed across the documented runs; this report does not present the first mixed invocation as an uninterrupted green run.

The only remaining warnings concerned the absent collected `staticfiles` directory in the temporary source export. No Docker image or collected-static serving claim relies on this test run. The two deselected cases are Academy's analogous employee filters, owned by the other reviewer.

## Reproducible reviewer artifacts

- `/tmp/janamen-review-4380f2/backend/review_tests/test_original_findings.py`: copied original HTTP reproducers, now passing.
- `/tmp/janamen-review-4380f2/backend/review_tests/test_delta_boundaries.py`: retained raw-cookie replay and adjacent representable leave-day boundary.
- `/tmp/janamen-core-knowledge-review.md`: original findings and broader first-pass scope/limitations.
- `/tmp/janamen-handoff-audit.md`: separate documentation coherence findings, not repeated in this delta.

No additional tests were added to product code, no optional full-suite rerun was performed after the concrete risks were resolved, and no new comments audit was claimed. The parent's final integrated verification and the other independent review remain separate evidence.
