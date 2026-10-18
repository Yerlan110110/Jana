# Backend implementation contract

Status: accepted implementation baseline, 17 October 2026.
Changes require a documented reason and reconciliation with dependent modules.

## System shape

Use a Django 5.2 LTS modular monolith and Django REST framework. PostgreSQL is the deployment database. SQLite is allowed for a local smoke path, never as proof of PostgreSQL concurrency behavior.
Django supplies authentication, sessions, CSRF, ORM, migrations, transactions and trusted operator administration. DRF supplies parsing, serialization, API permissions and pagination. Generate OpenAPI with drf-spectacular.
The future frontend talks to /api/v1/ through the same origin in deployment. A development origin must be explicitly allowed.

The synthetic public Compose profile terminates HTTPS at Cloudflare and nginx. Proxy SSL trust is opt-in through `DJANGO_TRUST_PROXY_SSL_HEADER`, false by default. Only the controlled loopback origin enables it. Nginx validates the exact hostname, redirects HTTP and supplies the trusted HTTPS header to Django. It owns HSTS and response security headers. Django sessions and CSRF cookies remain secure when DEBUG is false. Public login throttling stays at 10/min. This is a temporary demonstration profile, not a production hosting commitment.

Modules live in backend/apps. They are core, identity, hr_requests, notifications, academy, knowledge, integrations and workbench. Workbench owns a read projection, not another mutable task database.
Use backend/config for settings, root URL configuration and WSGI.
Within a module, models.py owns persistence, services.py owns commands, selectors.py owns scoped reads, serializers.py and views.py own transport.
Use richer modules only when their responsibilities require them. Do not create repository interfaces around every ORM call.

## Shared shapes

All domain records use UUID primary keys and timestamp fields.
core.models.TimestampedModel is abstract with id, created_at and updated_at.
identity.User extends AbstractUser with UUID id and role choices employee, manager and hr. Superuser is a separate technical permission.
identity.LegalEntity has code and name. identity.Department has code, name and legal_entity.
identity.Employee has a one-to-one user, external_id, full_name, position, legal_entity, department, nullable manager pointing to Employee, hired_on, leave_balance, balance_as_of, locale and is_active.
Use Decimal for money and leave balances. API decimals are strings. Dates use ISO 8601. Store aware timestamps in UTC. Default display zone is Asia/Almaty.
An employee's department and manager must be in its legal entity. Manager chains must not be cyclic.
Profile data is read-only through business APIs, including HR. Integration commands and controlled seeding own these facts.

## Shared access API

identity.selectors.visible_employees(user) returns an Employee queryset.
An employee sees itself. A manager sees itself and direct reports in its legal entity. HR sees its legal entity. A technical superuser has administrative access.
identity.permissions.can_manage_employee(user, employee) returns true for a direct manager or HR in the same legal entity, excluding self. Technical administrator behavior must be explicit.
identity.permissions.require_hr(user, legal_entity=None) rejects unauthorized users.
List filters and detail lookups use the same scope. Deny outside-scope object reads without disclosing existence.
All mutations validate their own action permission. Frontend visibility does not confer permission.

## Events and notifications API

core.models.DomainEvent has event_type, aggregate_type, aggregate_id, payload and optional actor. Events are append-only through the application model/queryset and admin boundaries. This is not a claim of cryptographic tamper evidence or protection against a privileged database operator.
core.events.emit(event_type, aggregate_type, aggregate_id, payload, actor=None) creates and returns the event within the caller transaction.
core.models.OutboxMessage references an event and stores topic, status, attempt_count, available_at, last_error and processed_at. Its id or event id is the receiver's deduplication key.
notifications.services.notify(recipient, kind, title, body, target_type, target_id, event=None) creates a per-user message. recipient is a User instance.
Notification data includes read_at. Marking it read never changes a business object's state. Read operations only affect the owner.
Use unique event/recipient delivery keys where an event exists. Store no external secrets in event payloads.

## Request model and commands

hr_requests.HRRequest supports kind leave or advance.
Shared fields include employee, status, version, reason, submitted_at and immutable submitted snapshots. One HRRequest table holds the two validated field sets; database constraints prohibit mixed kinds. Separate LeaveDetails and AdvanceDetails tables from the early design sketch were not needed for the accepted aggregate.
Leave fields include start_date and end_date. Advance fields include amount, currency and requested_payment_date. Reject invalid kind/field combinations at both validation and database constraints where practical.
Salary advance means a request for an advance payment on compensation. Do not implement an expense ledger under the same name.
States are draft, pending_manager, pending_hr, approved, rejected, returned and cancelled.
The demonstration policy sends submission to the employee's direct manager, then HR. Without a manager it goes to HR. The actual company's process remains an integration configuration question.
A reviewer cannot approve its own request, even when the role is HR.
A returned request can be edited and resubmitted. Submitted revisions are immutable. Amendments create a new snapshot.
`RequestRevision.payload` has the generated `RequestSnapshot` schema for the existing sixteen snapshot fields. Person, dates, money, reason, assigned-manager ID and demonstration policy conventions remain the values saved at submission. `RequestRevisionSerializer` returns the stored JSON unchanged; schema annotation does not normalize decimal strings, replace historical names or alter old idempotency responses. The frontend derives its snapshot type from this schema and displays submitted facts separately from the current editable request.
A pending or draft request can be cancelled by its owner. Cancellation of an already approved request requires a separate future policy decision; never silently erase the approval.
Rejected or completed decisions remain in history.
Every write uses transaction.atomic and row locks around the shared invariant. Expected version is required for edits and transitions.
An Idempotency-Key replays the same command result for the same actor and payload. Reuse for another command or payload returns 409.
A decision writes the request, snapshot or history, event, notification and export outbox in one transaction.
Leave overlap checks must serialize per employee. Define the demonstration day-count convention explicitly. Official leave_balance is not mutated by portal approvals. Expose official and projected values separately.
Record the manager assigned to the submitted revision. Changes in organization do not silently transfer a pending approval to a different person.

Commands include create, update_draft, submit, approve, reject, return_for_changes and cancel.
Detail responses include allowed_actions, version and chronological history. The server computes allowed_actions.
Never allow generic PATCH status to bypass a command.

The request list accepts `needs_my_action=true` before pagination and uses `hr_requests.selectors.review_requests`, the same canonical selector as the workbench. False and omission add no restriction. Search, other filters and ordering compose with this queue. The owning selector retains current scope, stage, assigned reviewer, active employee and self-review rules.

The request list also accepts `waiting=true` for the two pending stages before pagination. It composes with existing employee scope and filters. The status group is shared with the workbench waiting count so its link opens the same population. False and omission add no restriction. Notification lists document the existing `unread=true` filter in OpenAPI; it remains restricted to the recipient.

### Request fulfillment evidence

`GET /api/v1/requests/{id}/fulfillment/` uses the normal request read scope, including the owner, current direct manager and scoped HR. It is read-only and grants no integration operator capability. Approval exposes the actual request status, current submitted revision ID and submission number. Delivery and source accounting remain independent of approval.

Delivery is `not_queued` without an export, `queued` during automatic delivery or retry, `needs_operator` after terminal failure, and `accepted` only with a saved receipt for the submitted revision. The response exposes the acceptance timestamp, not delivery keys, payloads, raw errors or retry controls. A processed message without that receipt is not accepted evidence. Receipt means document receipt, not payment or signature.

Source accounting is `not_applicable` for an advance, `not_confirmed` for leave without explicit source evidence, or the existing `incorporated` or `reversed` state. It exposes the source revision, confirmation timestamp and official balance date. A delivery receipt does not confirm source incorporation. The endpoint does not calculate a second balance or mutate employee facts. The existing balance projection remains authoritative. This read combines current records under ordinary database isolation and is not a frozen cross-module snapshot.

This scoped G3 implementation does not add the proposed paginated balance breakdown or a new execution state machine.

## Academy module

Separate catalogue availability, immutable course revision, enrollment, lesson progress and quiz attempt.
Course owns slug, legal entity, owner, a validated editable JSON draft, optimistic version, availability and the current published-version pointer.
A published CourseVersion owns title, title_kk, summary, summary_kk, category, content_language, assessment rules and immutable JSON snapshots of its ordered lessons and questions. An enrollment refers to a fixed version. Strict transport/content validation checks the complete snapshot before publication; JSON does not grant arbitrary learner writes.
Enrollment links employee and course version with assigned_by, required, due_at, started_at and completed_at. Duplicate enrollment identity is constrained.
Completion state and quiz success are distinct. An archived course can retain a historical completion.
Lesson completion and quiz scoring are server-owned. Learners cannot write scores, progress percentages, employee ids or completion flags.
Quiz answer keys must not appear in learner APIs. A submitted attempt stores question and answer snapshots for audit. Passing requires the published threshold and required material completion.
Support assigned, in-progress, completed, overdue and failed-attempt views as derived states. A failed attempt does not erase completed lessons.
HR can assign learning to permitted employees. A manager's learner-progress view is scoped to the team.
Provide callable seed_academy(employees) for integration with the main seed command. It creates 30 distinct courses with materials and matching questions, plus varied enrollments.
The module owns apps/academy and its tests. It may import the shared identity and event APIs but must not change them without coordination.

## Knowledge and AI module

Separate document, immutable published revision, scoped chunk, retrieval result, assistant answer and knowledge-gap case.
Documents support audience role, optional legal entity, optional department, language, topic, owner and effective status.
Publishing and editing belong to authorized HR. An employee conversation cannot insert knowledge.
Scope documents before retrieval. Recheck publication/access when opening a citation.
The retrieval layer returns actual chunk ids, revision ids, text, titles and locators. The server builds citation URLs from these ids.
Use mature local lexical retrieval for a reproducible no-key mode, with an optional configured embedding/reranking or LLM adapter. Do not describe extractive fallback as generated RAG.
A configured generation adapter receives only retrieved permitted excerpts, returns structured claims with chunk references, and rejects invalid references. The selected generated strategy is source_bound_selection: complete source sentences must equal the displayed claim and preserve numbers and negation. A valid reference alone does not prove an arbitrary paraphrase. Fluent synthesis remains a separate strategy requiring an entailment and quality evaluation. No retrieved support means a refusal with HR escalation.
Keep answer modes explicit: generated, extractive, insufficient_evidence, provider_unavailable. A provider failure cannot become a fabricated answer.
Implement HR knowledge-gap cases as internal application records when the employee explicitly escalates. Do not send external messages.
The assistant never makes HR decisions or changes requests.
Provide seed_knowledge() with substantive synthetic policies and a machine-readable evaluation set of answered, unanswered, restricted, ambiguous and injection-style questions.
The module owns apps/knowledge and its tests. It depends on the shared identity/event APIs.

### Knowledge case resolution

When resolving an HR case against a policy, the existing `POST /api/v1/knowledge/gaps/{id}/resolve/` accepts optional nullable `published_revision_id` alongside `expected_version` and `response`. The case stores a protected foreign key to that immutable `KnowledgeRevision`. Omission or null retains an individual answer. A link requires an effective published revision readable by both the resolver and the case owner. An inaccessible or unknown revision returns 404 without changing the case.

Read-only `resolution_kind` is derived from the link as `individual_answer` or `published_policy`. `policy_reference` is null without a link. Otherwise it includes `revision_id`, `state`, nullable `revision`, and `url`. The state is `current`, `superseded`, or `unavailable`. The explicit `GET /api/v1/knowledge/gaps/{id}/policy-reference/` resolver returns that same shape and returns 404 for an individual answer. Lists, details, the resolver and command replays recompute access. Unavailable references retain the revision ID but return no revision content. New publication preserves the old link and marks it superseded while it remains accessible.

Publication uses the existing document authoring and publish commands, followed by resolve with the published revision ID. These are two independent transactions. A failed resolve leaves the published policy intact and the case open. The successful resolution, its event, notification and idempotency receipt commit together. A repeated command keeps one resolution and refreshes the policy projection rather than returning cached source content.

The accepted G2 design uses one nullable FK and the complete permitted revision. It derives the resolution kind and does not require a new chunk-selection relation. Copying policy text into the case was rejected because it creates a second content owner and cannot follow access revocation. A generic linkage table and automatic publication were rejected because this relationship has one known target and requires human publication. The response text remains private to the case. Closing a case does not train AI. Only a separately published policy participates in ordinary retrieval.

## Integration module

1C is the owner of imported employee facts and official balances. Store source revision and synchronization status.
Documentolog accepts exported approved requests through an adapter. Approved does not mean paid, signed or legally archived.
Adapters have a mock implementation and explicit contracts. Do not guess real undocumented endpoints.
Outbox processing is retryable and idempotent. Retrying an export must not create duplicate remote requests.
Expose failed synchronization state to permitted operators. Business approval and delivery state remain separate.
Production connector credentials are supplied through environment or a secret manager.

Export reads expose `mock_fault_available` only when `INTEGRATIONS_ALLOW_MOCK_FAULTS` is enabled and the message is pending or failed. This capability describes the existing mock-fault command, not permission to operate real integrations. Operator and legal-entity checks remain mandatory. Compose defaults this flag to false. The generated local demonstration template explicitly enables it. The web interface uses the returned capability rather than guessing the deployment mode.

## Workbench read model

workbench_for(user) combines the caller's profile, leave projection, own learning summary, scoped request previews, knowledge cases and unread count. Each section retains its domain serializer and full count. Preview limits do not change aggregate counts. See workbench.md for ordering and scope.
The view does not change a task by marking an event read. Business writes remain in their owning application commands. A read view is not a transactionally frozen historical snapshot across all modules.

## API and error rules

Use /api/v1/, paginated lists, explicit search/filter ordering, stable enum strings, and generated OpenAPI.
Use DRF SessionAuthentication. Protect login and every unsafe request from CSRF, including anonymous login.
Return structured errors with code, message, field_errors where relevant, and request_id.
Validation failures use 400, unauthenticated requests 401 where supported, denied actions 403, hidden objects 404, stale/idempotency conflicts 409, rate limits 429, dependencies 503.
Reject mass assignment of role, employee ownership, scores, official balances and workflow status.
`LOGIN_THROTTLE_RATE` configures the existing DRF login throttle, default `10/min`. Isolated browser suites use `120/min` because they authenticate multiple roles rapidly. Backend behavior tests explicitly keep the default and prove the eleventh failed attempt is throttled. Public demonstrations keep the default unless their own documented traffic needs justify another rate.
The frontend sends credentials and X-CSRFToken, reads new CSRF after login, and handles stale version conflicts explicitly.
Server links use resource types and ids. The frontend owns route presentation.

## Verification contract

Prove own/team/other-department/other-entity boundaries at list, detail, command and retrieval levels.
Prove own-request approval denial, stale updates, repeat submissions, rollback, overlap handling and safe retry.
Prove enrollment ownership, hidden answer keys, server scoring, completed history after course archival and version stability.
Prove policy access before retrieval, valid citation resolution, unknown-answer refusal and generation failure handling.
Use PostgreSQL to verify row-lock/concurrency semantics. Record unavailable tool gates without claiming a pass.
All acceptance evidence belongs in docs/verification and HANDOFF.md.
