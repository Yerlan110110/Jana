# Acceptance verification plan

## Current scope

This delivery implements backend and prepares frontend specifications.
A check is closed only when its matching command or interaction has been executed and recorded.
A generated Docker file, CI workflow or model adapter is not itself a passed runtime check.

## Backend checks

| Area | Behavior to prove | Required environment |
| --- | --- | --- |
| Authentication | Login requires CSRF, invalid credentials fail, logout invalidates the session | Django HTTP test client with CSRF enforcement; real HTTP smoke |
| Scope | Employee, manager, HR and other company see only allowed data | API tests with distinct users |
| Profile | Official facts cannot be mass-assigned through a client payload | API tests |
| Request workflow | Create, submit, review, return, resubmit, reject and cancel obey the state model | API and database |
| Decision authority | No self-approval or substitute manager approval | API and domain services |
| Concurrency | Stale writes and overlapping leave commands cannot silently win | PostgreSQL transaction tests |
| Idempotency | A retry has one business effect; a changed payload with the key conflicts | API and database |
| Transaction | Failed command writes no partial decision, history or notification | Failure-injection test |
| Academy | Question keys hidden, scores computed by server, progress owned by learner | API tests |
| Learning history | Revised/archived courses preserve previous evidence | API and database |
| RAG | Scope precedes retrieval, citations resolve, unsupported questions refuse | Evaluation fixture and API |
| Model adapter | Configured real generation produces supported cited answers | Actual provider credentials or local model |
| Notifications | Read state belongs to recipient and is separate from business state | API tests |
| Outbox | Retry is safe and failed export remains visible | Mock adapter and worker |
| OpenAPI | Generated schema validates; frontend types compile | Schema generator and TypeScript |
| Deployment | Clean Compose start, health, persistence and worker | Docker-capable environment |

## Independent review

Review changes separately from their author.
Inspect concrete permission paths, state commands, database constraints and failure handling.
A reviewer records all demonstrated findings, not only the first.
Fix high-impact findings, rerun the affected behavior and retain remaining limits in docs/continuation-status.md.

## Frontend checks for the next agent

Read the design specifications and original author skills.
Build the real employee and manager journey against this API.
Check keyboard-only completion, focus placement, all form errors, mobile reflow, high content density, color-independent states, reduced motion and 200% zoom.
Use a screen reader for labels and announcements.
Run account switching and an unauthorized request in the browser.
Show source revisions and recovery when a record changed.

## Evaluation claims

Report the dataset, command and observed result for every claimed metric.
Do not infer production latency from the local test environment.
Do not call an extractive retrieval mode a generative model evaluation.
Do not advertise unseen competitor weaknesses or claim a guaranteed hackathon outcome.

