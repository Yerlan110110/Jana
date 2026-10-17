# Implementation execution plan

Reconciled with implemented code through `f779305` on 17 October 2026.
The current delivery contains the backend, research, generated API contracts, populated synthetic data, and frontend specifications.
The frontend is a separate implementation. Backend verification does not close its interaction or visual checks.

## Pstack architecture phases

1. Ground. Organizer requirements, the user's prior architectural context, and public professional implementations informed the [backend research](../research/backend-rea.md), [product research](../research/product-rea.md), and [Jana Post context](../research/janapost-context.md). Private MIS Pro source is not redistributed in this repository.
2. Sketch. The [reuse decision](reuse-decision.md) compares a full Frappe suite, Payload, and the selected modular Django backend. These are structural comparisons, not benchmarks of three deployed products.
3. Agree. The user authorized autonomous implementation and quality before assumed time savings. The selected design keeps official personnel facts under 1C ownership and provides a generated contract to the independent frontend.
4. Implement. Identity, requests, Academy, knowledge, notifications, integrations, and workbench are implemented. The [backend contract](backend-contract.md), [integration contract](integration-contract.md), and [decision log](decisions.tsv) record the accepted shapes and corrections.
5. Scrap. No replacement of the selected system structure was required. Reconsider the ownership model if later requirements require an ERP replacement, a different LMS owner, or another documented change described in the reuse decision.

## Throughput checkpoint

- Blocking first steps. Shared identity, event, error, and command contracts were established before module implementation. The final combined PostgreSQL gate is closed by the recorded 191-test run at `f779305`.
- Independent workstreams. Module authors used separate worktrees. Research, implementation, and independent review had distinct owners. Final documentation edits have explicit file ownership.
- Shared mutable state. The integration owner merges modules and owns shared settings, generated contracts, and the final verification record. Documentation contributors do not alter another owner's files.
- Smallest safe decomposition. One author owns each transactional aggregate. Independent reviewers assess the implementation separately. Exploratory work used a labelled sequential comparison when all agent slots were occupied; that comparison is not presented as a multi-model review.

## Delivery checks

- [x] Public-source research and source/version inventory. The research documents distinguish documented behavior, observed artifacts, and proposed JanaMen behavior.
- [x] Pinned Codex skill packs and applied Pstack/Fstack instructions. The [tooling setup](../tooling/codex-setup.md) records installation and client discovery as separate checks.
- [x] Available REA evidence retained with its limits. The [evidence index](../design/evidence/README.md) records a successful local replay of a public article and unsuccessful live captures. It does not claim an authenticated professional LMS journey.
- [x] Competing architecture sketches and a justified selection in the reuse decision.
- [x] Core authentication, employee scopes, read-only official facts, and both leave and advance request commands.
- [x] Academy authoring, publication, assignment, materials, server scoring, and immutable result history. The fresh baseline has 30 distinct courses, 60 lessons, 90 questions, and 12,702 material words.
- [x] Knowledge publication, scoped retrieval, resolvable citations, refusal, and internal HR escalation. Live generation with a real model is a separate unverified capability.
- [x] Notifications, normalized mock 1C imports, explicit leave reconciliation, and retryable mock Documentolog delivery through the outbox worker.
- [x] Scoped workbench with complete counts, limited previews, and current server-computed actions. It is a read projection over the owning modules.
- [x] OpenAPI and frontend types generated from the implementation. `310ecbc` makes request history and revision evidence explicitly read-only in the schema and TypeScript. The [API guide](api-contract-guide.md) and [design handoff](../design/README.md) describe the next frontend delivery.
- [x] Module verification recorded in the [Academy](../verification/academy.md), [knowledge](../verification/knowledge.md), and [integration](../verification/integrations.md) reports. Their separate test totals must not be added as a unique combined count.
- [x] Independent review produced corrections integrated in `4380f28` and `310ecbc`. This records the review and fixes, not a substitute for the final combined run.
- [x] Real HTTP leave, advance, Academy, workbench, and mock export journeys passed twice through independent cookie sessions and CSRF. The [first run](../verification/evidence/workflow-smoke-first.json) and [repeat run](../verification/evidence/workflow-smoke-repeat.json) each recorded 807 assertions through the [workflow runner](../../scripts/verification/smoke_workflows.py). These are repeated scenario assertions, not 807 distinct unit tests.
- [x] The fresh complete seed was captured before additive HTTP probes in [demo-baseline.json](../verification/evidence/demo-baseline.json). The [demo data contract](../product/demo-data-contract.md) identifies its counts and timing.
- [x] Final combined PostgreSQL suite: 191 tests passed, with zero failures, errors, or skips, in 145.92 seconds at `f779305`. The [JSON report](../verification/evidence/postgresql-suite.json) and [JUnit result](../verification/evidence/postgresql-suite.xml) identify native PostgreSQL 16.15 and Python 3.12.14. This is a local backend result, independent of Docker and GitHub CI.
- [x] Retain the combined test result, fresh baseline, and sanitized HTTP evidence under `docs/verification/evidence/`, with links from the delivery documents. Historical module reports retain their original scope and counts.
- [ ] Publish the final reviewed implementation and documentation to the authorized repository and record the published commit.
- [ ] Observe and record GitHub CI for that published commit. A workflow file is not an executed CI result.

## Environment verification

The [acceptance plan](../verification/acceptance-plan.md) defines the required environment for each check.

| Check | Current evidence | Remaining work |
| --- | --- | --- |
| Native API and worker | Two recorded loopback HTTP journeys reached persisted decisions, learning results, and mock receipts | Retain both sanitized run reports with the published handoff |
| PostgreSQL concurrency and rollback | The final combined suite passed all 191 tests at `f779305`, with no skips | Keep the tested commit and native environment explicit in the published handoff |
| Docker deployment | Compose configuration and deployment files exist | Execute the image build, clean migration, seed, health, persistence, and worker checks in a Docker-capable environment |
| AI generation | Scoped extractive mode and configured adapter behavior are implemented and covered by recorded checks | Run a real selected model with credentials or local compute and a separate evaluation dataset |
| Company integrations | Normalized mock 1C and mock Documentolog behavior is implemented | Obtain actual provider contracts and authorization before claiming real compatibility |
| Rendered frontend | Screen, state, curriculum, accessibility, and interaction specifications exist | The next design agent implements and verifies the actual employee, manager, and HR interfaces |

Real company integrations are outside the required hackathon mock boundary. Their absence does not turn a mock receipt into proof of payment or signature.
The future frontend must preserve the complete populated scope and use actual API counts. It must not replace 30 courses with one or hardcode baseline numbers into cards.

