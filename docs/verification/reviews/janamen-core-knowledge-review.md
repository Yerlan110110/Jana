# Independent backend review

Reviewed revision `b3466929a59da620ff823d9cc237fde595545a9c` of JanaMen.
The reviewer did not author or modify the implementation. Source was exported with `git archive` to `/tmp/janamen-review-b346692` so concurrent work in the main checkout could not alter the reviewed artifact. Reproducer tests were written only in that temporary export.

## Verdict

Changes are required for four confirmed defects. The existing 90 tests in the reviewed modules pass on PostgreSQL 16.15. Three new HTTP boundary reproducers fail with the specific results below. The fourth finding is confirmed by rendering the committed Compose configuration.

The parent has accepted the session-revocation defect for repair. This report does not certify subsequent changes. A delta review remains necessary.

## Findings

| ID | Severity | Location | Trigger and observed result | Required correction |
| --- | --- | --- | --- | --- |
| R1 | High, access revocation | `backend/apps/identity/authentication.py:5`, `NotificationViewSet.get_queryset`, `notifications.services.mark_read` | Log in with real session cookies and CSRF, then set that employee's `is_active` to false while leaving the authentication user active. The existing session receives 200 from `auth/me`, receives 200 and the full private notification from `notifications`, and receives 200 from `notifications/{id}/read`. The read timestamp is persisted. `employee_for` protects most business selectors, but the authentication class never rejects the inactive employee. | Enforce active employee provisioning at the shared session-authentication boundary, with the explicit technical-superuser exception. Revoke the old session, not only the current response. Test deactivation, missing profile, and reactivation with the former cookie. |
| R2 | High, frontend command blocker | `backend/config/settings.py:93`, `compose.yaml:13`, `packages/api-client/src/index.ts` | The configured development frontend is cross-origin. An OPTIONS preflight from `http://localhost:3000` requests `content-type,x-csrftoken,idempotency-key`. The response permits the origin but advertises only `accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with`. It omits the mandatory command header, so a conforming browser cannot send these commands. | Extend the library's default CORS allow-list with `idempotency-key`. If the frontend consumes the response headers, expose `Idempotency-Replayed` and `X-Request-ID`. Preserve explicit allowed origins. |
| R3 | Medium, unavailable configured feature | `compose.yaml:8`, `.env.example`, `backend/apps/knowledge/provider.py:43` | Set `KNOWLEDGE_GENERATION_PROVIDER=openai` in the host environment or `.env` as instructed by the knowledge README. Compose forwards the key and model but never forwards the provider selector. Rendering the committed configuration shows `provider_forwarded=false` for API, worker, and release. `GenerationConfig` therefore remains `extractive` in the container. | Forward the provider selector with the safe `extractive` default and include it in `.env.example`. Do not change the default to a paid provider. |
| R4 | Medium, input validation | `backend/apps/hr_requests/services.py:84`, `HRRequest.leave_days` | POST a leave draft with valid ISO dates `2026-10-18` and `9999-12-31`. The serializer accepts the dates and `validate_details` computes a day count that exceeds `DecimalField(max_digits=7, decimal_places=2)`. PostgreSQL raises `NumericValueOutOfRange`, and the API returns HTML 500 instead of a structured validation 400. The same calculation is used when editing. | Validate the computed count against the model's representable bound before persistence. Apply the same rule to creation and editing and verify no request, event, or idempotency receipt is committed for the invalid command. |

The access defect is confined by the selectors already present. This review did not find that the deactivated employee can read another person's request or a restricted policy. The confirmed residual access is its existing authenticated session and its notification data and writes.

## Reproducible evidence

The temporary reproducer is `/tmp/janamen-review-b346692/backend/review_tests/test_findings.py`.

Run it from the temporary export's `backend` directory with the main environment's installed Python dependencies and a separate review database.

```sh
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python \
  -m pytest -q -s review_tests/test_findings.py --tb=short
```

This command uses the synthetic loopback PostgreSQL instance provisioned for this session. It is not a deployment configuration. Pytest creates a separate test database. No real credentials or employee data were used.

Observed revocation result:

```json
{
  "me": 200,
  "notifications": 200,
  "visible_notification_count": 1,
  "mark_read": 200,
  "read_timestamp_persisted": true
}
```

Observed preflight result:

```json
{
  "status": 200,
  "allow_origin": "http://localhost:3000",
  "allow_headers": "accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with"
}
```

Observed date-boundary result was HTTP 500 and `numeric field overflow`. PostgreSQL reported that precision 7 and scale 2 require an absolute value below 100000.

The Compose check used `/tmp/janamen-docker-compose -f compose.yaml config --format json` with synthetic placeholder secrets and `KNOWLEDGE_GENERATION_PROVIDER=openai`. Only the presence of relevant environment keys was printed. The provider key was absent from all three runtime services, while the OpenAI key was present.

The existing module suites were also executed from the immutable export:

```sh
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python \
  -m pytest -q apps/core apps/identity apps/hr_requests apps/notifications apps/knowledge
```

Result was **90 passed**. Warnings identify the absent `staticfiles` directory in the temporary export. They are unrelated to the failing reproducers. This count excludes future Academy, Integrations, and workbench code and excludes the new reproducer tests.

## Coverage and conclusions

| Area | Inspected evidence | Conclusion at this revision |
| --- | --- | --- |
| Authentication and identity | Authentication class, permission functions, selectors, models, serializers, views, admin, login and role tests | CSRF protects anonymous login and authenticated unsafe requests. Login rotates the token. Official employee facts have no business write API. R1 and R2 require repair. |
| Request scope and transitions | Request model, selectors, serializers, views, commands, history, revisions, seeds, concurrency and permission tests | Reads use the common employee scope. Commands lock the employee before the request. Self-approval is denied. Stale versions conflict. Return, edit, and resubmit preserve prior snapshots. R4 requires repair. |
| Idempotency | Shared command receipts and callers in requests and knowledge | Actor and key are unique. Concurrent identical commands converge to the stored response. Scope is checked before replaying record-specific commands. Request manager-scope revocation is covered. A replay intentionally retains the original response and requires a fresh read for current actions. |
| Transactions and notifications | Event emission, append-only model, notification delivery and read commands, rollback tests | Event emission checks for an active transaction. Request transitions record history, event, notification, and final export entry together. Notification reads are owner-scoped, but R1 leaves deactivated sessions active. |
| Knowledge authorization | Current and historical selectors, draft management, publication, citations, private answers and HR gaps | Retrieval uses only accessible effective current revisions. Citation and stored-answer presentation repeat authorization. Archiving or scope withdrawal removes saved claims from API output. Managers cannot read subordinate conversations or private HR cases. |
| Model output | Provider adapter, Pydantic schema, sentence validation, controlled SDK transport tests | Accepted generated claims must equal complete copied source sentences with valid chunk references. Invalid references, paraphrase, partial sentences, removed negation, and extra fields are rejected by the inspected validator and tests. R3 prevents activating this path through the current Compose configuration. |
| Rich fixtures | Identity, request and knowledge seeds, CLI, preservation and rollback tests | Synthetic records use stable identities. Re-runs preserve existing facts, edited requests and known passwords. Credential output is created through a private temporary file and replacement. Existing fixtures cover 58 employees and 126 requests. Learning fixtures are outside this first pass. |
| Runtime and client | Dockerfile, Compose, dev CLI, entrypoint, CI workflow, contract generator, API client factory and guide | The client sends cookies and the current CSRF token without automatic mutation retry. Container and native commands are represented in source. Compose and provider/CORS integration require the repairs above. This review did not run a Docker daemon. |

## Accepted choices and remaining verification limits

These are not findings:

- Manager reassignment does not silently transfer a pending review. The original manager loses scope, the new manager cannot review the old assignment, and the owner can cancel and resubmit. Tests encode that decision.
- Leave uses an explicitly synthetic inclusive-calendar convention. At this revision the projection subtracts active portal reservations from a fixed official baseline. The incoming integration module owns source reconciliation and was excluded from this review.
- An approved advance is not a confirmed payment. The outbox records export intent separately. The future worker is reviewed elsewhere.
- Historical records have ORM-level append-only protections. This is not a guarantee against a privileged database operator, direct SQL, or every possible future ORM upsert. No public write path bypassing the inspected commands was found.
- Source-bound output preserves quoted text. It does not prove policy truth, answer completeness, or semantic relevance for all questions. The lexical regression set is disclosed as the calibration set, not held-out accuracy.
- Concurrent identical new questions can invoke the model more than once before converging to one persisted answer. This limitation is documented. There was no real provider key or live provider invocation in this review.
- Per-process throttling is not a distributed production quota. The current local deployment and documentation do not claim otherwise.

Generated migrations were exercised during fresh PostgreSQL test database creation. They were not all line-reviewed independently of the owning model definitions. The next integration pass must regenerate OpenAPI and TypeScript after all modules are present. No claim is made that this intermediate generated contract already contains later modules.

Frontend rendering, browser accessibility, visual quality, Academy, Integrations, the uncommitted workbench, a Docker build, remote CI execution, and real 1C or Documentolog behavior are outside this first review. Their absence at the reviewed checkpoint is not a defect filed here.

## Review methods and skills

`poteto-mode` and its Codex mapping were read. The read-only investigation was performed sequentially inside the parent's parallel review partition, with no additional agent slots requested. This is one independent non-author review, not a claim of model diversity.

`principle-model-the-domain` focused the review on request states, ownership, snapshots, and source versions. `principle-make-operations-idempotent` focused it on retries, original responses, and revoked scope. `principle-prove-it-works` required the failing boundary reproducers rather than treating the 90 existing tests as complete proof. `technical-writing` and `unslop` separate observed defects from future deployment concerns.

`fstack`, the original `emil-design-eng`, and `better-interface` were read for their evidence and user-state requirements. Their application here was to validate that a separate frontend can issue the documented commands and to leave visual domains explicitly unreviewed. No rendered UI review is claimed.

The `no-comments` and `comment-sicko` instructions were read. The source scan found no correctness suppression or workaround comment in the reviewed application logic. Generated migration provenance, interpreter directives, and two module-level synthetic seed contract docstrings were left intact. No comments were deleted, no application fixes were authored, and there are no comment-driven blocking findings.
