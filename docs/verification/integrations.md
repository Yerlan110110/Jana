# Integration implementation and verification

The integration module implements the normalized demonstration contracts for 1C and Documentolog. It does not call either real service. The backend owns durable source audits, balance reconciliation, export receipts, worker claims, and operator commands.

## Implementation boundaries

`apps.integrations.imports.import_snapshot` accepts an `ImportSnapshot`. The API constructs this frozen data shape through strict DRF serializers. It rejects unknown input fields, duplicate employee identities, duplicate balance identities, future capture times, and contradictory incorporation and reversal entries.

The source protocol is `mock_1c`. A batch contains a legal entity, a positive integer source revision, a capture timestamp, and at most 1,000 employee records. The revision maximum is `2^53 - 1`, so a JavaScript client can represent every accepted value exactly. Each record contains complete employment facts for that employee. A batch may update part of an entity, but it cannot create accounts, change account roles, move an employee to another entity, or create a department.

The importer locks the legal entity before it locks that entity's employees in UUID order. It validates the complete intended manager graph before writing any official fact. This allows a valid manager rearrangement whose intermediate update order would otherwise look cyclic. Concurrent partial imports use the same entity lock. Request commands continue to serialize leave reservations through the employee lock.

Accepted and rejected normalized batches are append-only `SourceImportBatch` records. A rejected batch preserves the last accepted employment facts. Its audit includes the source payload hash, capture time, operator, safe error, and field paths when a specific record failed. Input that fails transport validation does not create a source audit.

An accepted revision identifies one canonical payload. Record ordering and balance-id ordering do not change that identity. Repeating the same accepted revision returns its original audit without importing it again. An exact replay of an older accepted revision does not replace a newer state. Reusing an accepted revision with different data, supplying an unaccepted stale revision, or moving capture and balance dates backwards returns a conflict.

`EntitySyncState` stores the last accepted source revision and audit. `EmployeeImportState` links an employee to the accepted batch that last changed its official facts. `Employee.source_revision` and `Employee.synced_at` remain available through the profile contract.

## Leave balance accounting

`official_balance` remains the imported source value. `portal_reserved_days` counts pending and approved portal leave that the source has not confirmed as incorporated. `source_incorporated_days` reports approved leave already included by the source. `projected_balance` equals `official_balance - portal_reserved_days`.

An employee snapshot supplies `incorporated_request_ids`. In this normalized protocol, each id confirms the final approved revision and its complete recorded leave-day amount. The importer verifies that the request is approved leave, belongs to the source employee and entity, and agrees with its immutable submitted revision. Partial incorporation is not supported.

`LeaveBalanceIncorporation` is the current accounting projection for one request. It records the request revision, confirmed days, source batch, source revision, capture time, and either `incorporated` or `reversed`. It is a mutable projection backed by append-only source batches.

Every later snapshot of that employee must reaffirm all currently incorporated ids. Removing an id requires an explicit `balance_reversals` entry with a reason. A reversal restores the portal reservation while leaving the HR approval intact. A later source snapshot may explicitly incorporate the same final request again. The earlier confirmation and reversal remain in source audit history.

The importer never infers incorporation from an export receipt, matching date, employee name, or amount. A real source adapter must provide equivalent correlation semantics before it can use this accounting protocol. A source correction may leave the projected balance negative. The portal displays that conflict instead of changing the official balance or erasing an approval.

## Document export

Final HR approval already writes `documentolog.export_request` to the outbox in the approval transaction. `build_export` reads the immutable submitted revision and final approval history. It includes request identity, revision identity, submitted employee facts, dates or decimal money, and immutable decision metadata.

New request revisions include `employee_external_id`. Older revisions retain their original payload and can still export with the portal employee id. A real adapter must define the mapping for old revisions if its remote protocol requires the external id.

The receiver key is `janamen-documentolog-<outbox UUID>`. Attempts, retries, leases, and process restarts do not change it. The mock receiver stores one immutable `MockDocumentReceipt` per key and rejects a different payload under that key. It returns the same document identity and acceptance time on a retry.

`DocumentExportReceipt` is the local acknowledgment of a receiver response. It remains separate from the receiver's own mock record. `delivery_status=processed` means that the adapter accepted this document and the worker recorded its receipt. `acceptance_meaning=document_received_only` makes the boundary explicit in the API. Approval and receipt do not mean payment, signature, or legal archive.

The mock receiver uses a separate SQL transaction in the same PostgreSQL database. The worker does not wrap delivery in the approval transaction. This permits a test of a receiver acceptance that survives a failed local acknowledgment. It does not prove network partition behavior or a remote provider's durability.

## Worker recovery

The worker claims due messages with PostgreSQL `SELECT FOR UPDATE SKIP LOCKED`. A claim contains a fresh token and a 60-second lease. The claim transaction ends before the adapter runs. The next worker can reclaim an expired lease and record the abandoned attempt.

Acknowledgment and failure recording require the current token, the processing state, and an unexpired lease. An old worker cannot acknowledge, fail, or overwrite a newer claim. Each claim and its result have append-only audit records. A claim without a result records work whose completion is not yet known.

Each automatic retry cycle permits five attempts. Transient failures wait 5, 10, 20, and 40 seconds before the remaining attempts. A permanent failure or an exhausted cycle requires an operator. Repeated worker crashes also exhaust the cycle. Manual retry starts a new bounded cycle while retaining the total attempt count and all earlier evidence.

An unexpected adapter exception produces a safe failure message. The worker does not copy the exception text into the API or source audit. A typed adapter failure must already contain a safe code and recovery message. A future real transport must map provider errors into this contract and bound its request timeout below the lease duration.

Only the current claim can commit a receipt, delivery outcome, event, and notification. If that transaction fails, the receiver may already have accepted the document. After lease expiry, the worker uses the same receiver key and recovers the receipt.

## Operator API

An operator needs both scoped HR access and Django permission `integrations.operate_integrations`. A technical superuser has explicit administrative access. Granting the integration permission to an employee or manager does not grant operator access. Out-of-scope records return 404. Lists and detail commands use the same scope. Idempotency replays repeat the scope check.

The implemented routes are under `/api/v1/`.

| Method and path | Behavior |
| --- | --- |
| `POST integrations/mock-1c/imports/` | Validate and import a normalized employee snapshot. |
| `GET integrations/imports/` | Paginated accepted and rejected source audits in scope. |
| `GET integrations/imports/{id}/` | Source audit and normalized payload. |
| `GET integrations/sources/` | Accepted source revision and capture time per permitted entity. |
| `GET integrations/sources/{id}/` | One source synchronization state. |
| `GET integrations/exports/` | Paginated Documentolog delivery records in scope. |
| `GET integrations/exports/{id}/` | Delivery state, receipt, claim history, and allowed actions. |
| `POST integrations/exports/{id}/retry/` | Start another bounded delivery cycle after a failure. |
| `POST integrations/exports/{id}/mock-fault/` | Configure a controlled transient or permanent demo fault. |

Every mutation requires `Idempotency-Key`. Export retry and fault configuration require `expected_version`. A worker claim or result changes the version, so a stale operator command returns 409. Import consistency uses the source revision and canonical hash instead of an unrelated portal version number.

The export API uses `delivery_status` to distinguish transport state from HR status. Query filtering uses `status`. The source audit API uses `import_status`; its filter is also `status`. `allowed_actions` currently contains `retry` only when a delivery failed or a transient failure is waiting. Mock fault controls are a separate demonstration capability. They default to disabled when Django `DEBUG` is false and can be controlled through Django setting `INTEGRATIONS_ALLOW_MOCK_FAULTS`.

The source audit response contains `error_fields`. Import rejection responses return those paths in the standard `field_errors` envelope and add `integration_audit_id`. A frontend can link the error to the preserved audit and highlight the offending employee record.

Integration evidence is read-only in Django admin. Worker retries and source changes use application commands. There is no arbitrary remote URL field and no business profile-edit endpoint for official facts.

## Populated demonstration states

`seed_integrations(employees)` runs from the shared `seed_demo` command. It grants integration permission once to the four synthetic HR accounts. `DemoOperatorGrant` records that initial setup, so rerunning the seed preserves a permission that an administrator later revokes.

Each newly seeded legal entity receives an accepted mock source snapshot at revision 1 and a rejected revision-2 example with an unmapped department. The accepted import preserves names, roles, balances, and organization. It changes the profile source label to `mock_1c:1`. Existing source states and operator changes survive a seed rerun.

Dana's approved leave receives one transient mock delivery failure. Her approved salary advance receives a permanent mock rejection. The worker can then demonstrate a scheduled retry and an operator recovery path alongside successful exports. The faults do not change either approval. Rerunning the seed preserves a fault that the operator cleared and a transient budget that the worker consumed.

The core identity-only seed still uses `synthetic-seed-v1`. The complete seed uses the real normalized mock import and therefore exposes `mock_1c:1` after integration setup.

## Executed verification

The complete identity, request, notification, seed, and integration suite passed 97 tests on PostgreSQL 16.15. After adding the JavaScript-safe revision boundary and typed source-audit payload, all 23 source-import tests passed. Ruff passed, `makemigrations --check --dry-run` reported no changes, and `spectacular --validate --fail-on-warn` completed with zero warnings and errors.

The native command path applied every migration, seeded 58 employees and 126 requests, created accepted and rejected source histories, and attempted 18 exports with `process_outbox`. Those commands used an isolated synthetic database. Generated credentials were written to a private temporary file and were not printed or committed.

The next worker run recovered the scheduled transient export. Persistent state then contained 17 processed exports, one failed export, 17 receiver receipts, and 17 local acknowledgments. There were two accepted and two rejected source audits. All 58 profiles carried source revision `mock_1c:1`. A second real `seed_demo` run reported zero new requests and zero new integration setups. Counts, delivery states, receipts, audit history, and the 359 domain events were unchanged.

The recorded commands are `uv run pytest -q`, `uv run pytest apps/integrations/tests/test_imports.py -q`, `uv run ruff check .`, `uv run python manage.py makemigrations --check --dry-run`, and `uv run python manage.py spectacular --file <temporary-path> --validate --fail-on-warn`. Runtime verification used `manage.py migrate --noinput`, `manage.py seed_demo --skip-academy --skip-knowledge --credentials-file <private-path>`, and `manage.py process_outbox` with the isolated PostgreSQL `DATABASE_URL` supplied through the process environment.

The executed checks include these observable outcomes.

- Simultaneous partial manager changes admit one valid graph and reject a cycle or stale revision.
- Two workers deliver one outbox message once.
- A worker skips a message locked by another transaction and claims another due message.
- Two receiver calls with the same key return one document identity.
- A crash after receiver acceptance preserves one receiver receipt and recovers one local acknowledgment.
- An expired or replaced claim cannot overwrite the current result.
- Transient and permanent failures preserve final HR approval.
- Automatic retries stop after the configured cycle. Manual retry preserves the previous attempt history.
- Source replay and conflict rules preserve the accepted facts and audit identity.
- A malformed later employee record rolls back the whole source batch.
- A local transaction failure rolls back accepted facts, source state, and its acceptance audit together.
- Source-confirmed leave avoids double subtraction. Explicit reversal restores the portal reservation.
- Another employee's request, an advance, a pending request, and an unknown id cannot be incorporated as approved leave.
- Ordinary employee, manager, revoked-operator, and other-entity access are denied.
- Real `seed_demo` and `process_outbox` command entry points are exercised in tests, including a bounded watch run.

PostgreSQL transaction tests use separate database connections and actual concurrent workers. SQLite cannot substitute for these checks. Docker image execution, a remote 1C transport, a remote Documentolog transport, and rendered operator screens are outside this agent's executed evidence.

## Design and skill decisions

The implementation compared two worker shapes before writing the pipeline. Holding a database lock during delivery would tie the request latency to the database transaction and still would not prevent a duplicate remote acceptance after a process crash. The selected claim, external delivery, and fenced acknowledgment shape keeps that failure explicit and recoverable through receiver idempotency.

Balance accounting also compared permanent incorporation flags with current source projections. A permanent flag could become stale after a source correction. The selected projection requires reaffirmation or an explicit reversal and retains immutable source audit evidence.

Pstack `how` grounded the change in existing employee-before-request locks and immutable request revisions. `architect` compared the shapes sequentially because the parent had already assigned every agent slot to independent modules. `principle-model-the-domain` changed the persistence model to claims, attempt results, receipts, source batches, and accounting states. `principle-type-system-discipline` produced frozen normalized input, export, receipt, and claim types at the module boundary.

Fstack routed the visible-state contract through Emil Kowalski's `emil-design-eng` and Jakub Krehel's `better-writing`. Those rules changed recovery messages and added distinct import, delivery, approval, and acceptance-meaning fields. No rendered UI review is claimed. `technical-writing`, `unslop`, and `deslop` shaped this report and the checked code diff.

The throughput checkpoint had four parts. Shared core and HR changes were reserved with the parent before implementation. Other feature agents retained their isolated worktrees. Real shared database state is serialized only at the legal entity, employee, or outbox record that owns the invariant. One implementation agent owned the import and export pipeline because its models, commands, and recovery tests change together.

Independent code and comment review belongs to the parent's final review stage. This agent authored the change and does not count its own checks as an independent verdict.

## Primary technical references

[Django QuerySet documentation](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update) defines the row-lock API and backend differences used by the implementation. [Django transaction documentation](https://docs.djangoproject.com/en/5.2/topics/db/transactions/) defines the atomic blocks and savepoints used for batch validation and commit. [PostgreSQL 16 SELECT documentation](https://www.postgresql.org/docs/16/sql-select.html) describes `SKIP LOCKED` as a queue-consumer mechanism. These sources were consulted on 17 October 2026. The repository tests establish the behavior of this implementation.
