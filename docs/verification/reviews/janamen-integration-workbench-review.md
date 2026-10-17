# Independent integration and workbench review

## Verdict

Approve the reviewed source at `4380f289c41b6c0d9bee6e1a045c1b32960b6427` within the scope below. I found no confirmed correctness, authorization, or privacy defect that requires a product change before publication.

An independent run of the integration and workbench suite passed all 57 tests on PostgreSQL 16.15. The standalone Docker Compose parser also accepted the actual configuration. A container build, a rendered frontend, a live model provider, and real 1C or Documentolog services were not exercised by this review.

This reviewer did not author the reviewed code and made no product edits. Review execution used a `git archive` of the named commit at `/tmp/janamen-integration-review-4380f2`. The working tree at the project root was not used as the executable review target.

## Scope and coverage

| Area | Coverage | Evidence |
| --- | --- | --- |
| Normalized source import | Inspected and tested | `backend/apps/integrations/imports.py`, transport serializers, operator permissions, source audit and state models, import and concurrency tests |
| Leave balance reconciliation | Inspected and tested | `backend/apps/integrations/imports.py:64`, `backend/apps/hr_requests/models.py:130`, `backend/apps/hr_requests/selectors.py:24` |
| Outbox delivery | Inspected and tested | `backend/apps/integrations/worker.py`, `adapters.py`, delivery models, core outbox fields and migration, worker and concurrency tests |
| Integration API access | Inspected and tested | `backend/apps/integrations/views.py`, `permissions.py`, `selectors.py`, list, detail, command, and revoked-permission tests |
| Workbench counts and previews | Inspected and tested | `backend/apps/workbench/selectors.py`, `serializers.py`, `views.py`, and all eight workbench tests |
| Installation and runtime boundaries | Source inspection and Compose configuration validation | `Dockerfile`, `compose.yaml`, `.env.example`, `.dockerignore`, `scripts/dev.py`, `scripts/deploy/entrypoint.sh`, `backend/config/settings.py`, `backend/config/urls.py`, `.github/workflows/ci.yml` |
| TypeScript client transport | Source inspection | `packages/api-client/src/index.ts`. Root owns the final generated-schema and TypeScript checks. |
| Core identity and request workflow | Only integration dependencies traced | Separate independent reviewer owns the baseline audit. I inspected request locks, submitted snapshots, review actions, and shared idempotency call sites where this scope depends on them. |
| Academy and knowledge | Only workbench serializers and scope dependencies traced | Separate reviewers own these modules. No claim of a second full Academy or knowledge review. |
| Frontend visual, keyboard, layout, motion, and accessibility behavior | Not reviewed | No product frontend is included in the review target. These remain the frontend agent's runtime gates. |

Root's uncommitted documentation reconciliation was excluded from defect findings. No incomplete documentation status was reported as a runtime defect.

## Findings

No confirmed findings were accepted. No reproducer or product patch was needed.

The following properties informed the verdict. They are code and test observations, not claims about unconnected production systems.

### Source revisions converge without overwriting newer facts

`import_snapshot` locks the legal entity before it reads or creates synchronization state. `_apply_snapshot` checks a previously accepted revision's payload hash, requires a newer revision for a new import, and rejects capture-time regression. An identical old accepted revision returns its original audit without writing older employee facts over a newer import. Canonical identity sorts employee records and reconciliation identities so record order does not change the logical source payload.

The import locks the entity's employee rows in a consistent order. It validates the intended complete manager graph after all supplied changes have been applied in memory. This covers partial batches that would otherwise create a cycle when two importers run concurrently. Official fact changes, accepted audit, employee import pointers, reconciliation state, and the event persist together. A rejected valid transport payload receives a separate immutable rejection audit after the attempted fact changes roll back.

Evidence includes `test_replay_of_old_accepted_snapshot_does_not_regress_a_newer_import`, `test_database_failure_rolls_back_facts_state_and_acceptance_audit`, and `test_concurrent_partial_manager_updates_cannot_create_a_cycle`.

### Portal approval and official balance incorporation remain separate

`_balance_changes` accepts incorporation only for an approved leave request owned by the imported employee. It compares the submitted revision, recorded leave days, employee identity, legal entity, and request kind. The next snapshot for that employee must reaffirm each active incorporation or provide an explicit reversal with a reason. A reversal changes source accounting state without erasing the portal's approval history.

`leave_projection` removes only confirmed incorporated approvals from portal reservations. A Documentolog receipt alone does not remove a reservation. Immutable source batch payloads retain the confirmations and reversal reasons even though the current incorporation projection is updated.

Evidence includes `test_confirmed_approved_leave_is_not_subtracted_twice` and `test_new_snapshot_must_reaffirm_incorporation_or_explicitly_reverse_it`.

### Worker recovery preserves one logical document identity

`build_export` constructs the document from the immutable submitted revision and final approval history. The receiver key is based on the outbox identity. Current profile edits do not rewrite an already submitted document.

`claim_next` uses PostgreSQL row locking with `skip_locked`, records each lease attempt, and assigns a new claim token. Acknowledgment and failure recording require the current unexpired claim. An older worker cannot overwrite a later worker's result. The receiver persists its own deduplicated receipt outside the application acknowledgment transaction, so an accepted document can be recovered after a local acknowledgment failure.

Automatic retry cycles are bounded. Manual retries preserve the lifetime attempt count and append-only attempt history. Invalid receipt identity is not accepted as delivery. Approval remains a distinct business fact from delivery failure and receiver acceptance.

Evidence includes the two-worker test, the concurrent receiver-key test, stale-claim tests, and `test_local_acknowledgment_failure_rolls_back_but_receiver_receipt_survives`.

### Authorization precedes command replay

Imports require the explicit integration permission and an eligible HR actor in the requested legal entity before the shared idempotency executor is called. The import service repeats entity authorization at its transaction boundary. Export commands check scoped visibility before replay and use a scoped locked lookup for a new mutation.

Integration lists and details use the same operator entity restriction. Raw source payloads are available only through the scoped detail endpoint. The tests cover employee and manager denial, foreign entity hiding, and import replay after permission revocation.

### Workbench aggregates retain their original access boundaries

The workbench requires an active employee profile. Personal requests and learning are restricted to that employee even for a manager. Review previews use the current review scope and assigned manager. A manager change does not silently transfer a pending approval. HR previews respect the request stage and exclude self-review.

Counts are computed on the full scoped queryset before the bounded preview is materialized. Archived learning remains part of learning history and is counted separately when unavailable. The enrollment serializer exposes course summaries and attempt summaries, not answer keys. Private HR knowledge-gap cases use the knowledge module's scoped selector and do not become a manager's team inbox. Reading the workbench does not mark notifications read or change business events.

Evidence includes all eight `apps/workbench/tests/test_workbench.py` cases. The populated learning test distinguishes overdue, available, and archived states. The privacy test checks that a manager receives neither a subordinate's private HR case nor a foreign entity case.

### Runtime configuration names concrete applications

All delivered applications and URL includes are explicit in Django configuration. A missing module does not silently disappear through an optional import loop. Compose starts the release command after PostgreSQL health, then starts API and worker after a successful release. The release command performs migrations, static collection, and optional synthetic seeding. The API readiness endpoint proves database connectivity; it is not a worker heartbeat or proof of external service readiness.

The reviewed Compose environment forwards `KNOWLEDGE_GENERATION_PROVIDER`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. Source inspection of the generated-client wrapper confirmed credential inclusion and an unsafe-method CSRF header callback. The wrapper does not add automatic mutation retries.

## Executed checks

The review used its own database name, `janamen_integration_review`, on the temporary loopback PostgreSQL instance. Django created and destroyed its separate test database. No other reviewer's test database was reused.

```sh
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_integration_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest -q \
  apps/integrations/tests apps/workbench/tests
```

The command ran from the archived backend directory. Its result was `57 passed, 36 warnings in 46.28s`. The warnings were WhiteNoise reports that the temporary review archive had no collected `staticfiles` directory. No warning was treated as a container or frontend pass.

```sh
python scripts/dev.py prepare
/tmp/janamen-docker-compose config --quiet
```

Both commands exited with code 0 in the archive. `prepare` created synthetic local configuration without printing generated credentials. Compose validation checks the actual service configuration. It does not build an image or start a daemon.

## Remaining gates and limits

The root agent still owns the full merged suite, migration drift check, final OpenAPI generation, client type check, application smoke flow, publication, and any available CI results. Those checks must be reported from their actual executions.

There is no local Docker daemon in this review environment. Actual image build, volume initialization, release ordering, API startup, and worker startup therefore remain unverified here. The CI container job can supply that evidence after publication if available.

The integrations under review use synthetic normalized source data and a mock document receiver. This review does not establish compatibility with real 1C or Documentolog APIs, production identity providers, payroll rules, or legally significant signatures. The generated model adapter and a rendered frontend were outside this review.

## Applied skills

Pstack's `poteto-mode`, Codex mapping, Investigation guidance, and `how` informed the dependency trace and the separation between source inspection and executed evidence. This was one independently delegated review within the parent's concurrent review partition. It was not a new multi-model `how` panel.

`principle-model-the-domain` focused the review on import revision state, immutable evidence, lease ownership, and the difference between business approval and document delivery. `principle-type-system-discipline` focused it on strict transport parsing and reuse of authoritative serializers and generated client types.

The Fstack router, original `emil-design-eng`, and `better-interface` informed the checks for recoverable API states, full counts beside limited previews, availability distinct from completion, and persistent outcomes that do not depend on notification read state. No rendered-interface review is claimed. The six visual and accessibility domains remain unreviewed here because the frontend does not exist in this delivery.

`unslop` and `technical-writing` informed this report. The `no-comments` instruction was read, and its separate fresh comment audit was explicitly handed to the parent coordinator. This report is not that separate audit.
