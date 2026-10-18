# JanaMen continuation contract

Current contract C2. Owner is the coordinating Codex agent. Updated 18 October 2026.

This file records the current delivery scope. Historical backend verification remains in `docs/verification/`. A passing source check does not establish browser or deployment acceptance.

The application now runs at **https://jmhr.vercel.app** on Vercel Services, with a dedicated Supabase PostgreSQL database and a Vercel outbox Daemon. The deployment retains the implemented Django and React application. [Cloud verification](verification/vercel.md) records current checks and observed failures. [Deployment instructions](deployment/vercel.md) identify the existing cloud resources.

Complete acceptance remains **BLOCKED** by COV1, missing mandatory state/environment evidence. The [independent R3 review](verification/reviews/janamen-release-r3.md) retains its original scope and limitations. This is a synthetic demonstration, not an accepted production release. No fresh independent approval of the cloud configuration is claimed.

The latest owner request on 18 October assigns the continuing agent planning and orchestration, with SWE 2 High implementation workers and Gemini 3.8 Flash for cheaper bounded work. The owner explicitly prioritizes meeting the deadline over conserving AI usage. Continue the existing differentiation plan rather than restart discovery. Keep specifications current with each behavior change. The team has two nontechnical presenters. Their latest timing is **3 minutes, 1 minute speaking and 2 minutes demonstrating**. Older five-minute material requires revision. The exact official speaking limit remains unconfirmed.

### Active continuation, integrated candidate

The owner moved the completion deadline to **16:45 on 18 October 2026** and requested frequent pushes of checked changes. The owner subsequently confirmed submission by 17:00 and the pitch at 18:00. Keep 16:45 as the internal completion target, leaving 15 minutes for owner submission. Baseline `f0b316e` precedes this checkpoint. Documentation checkpoint `27bdaba` is published on `origin/main`.

Both SWE 2 High implementation branches are integrated in the coordinator checkout through `1ee510e`. The coordinator replaced the temporary frontend API declaration with the generated contract and corrected preview invalidation and audience wording. The integrated PostgreSQL suite passes 255 tests in 175.93 seconds; evidence is `.artifacts/verification/checkpoint-1545/postgres-new.log`. The updated isolated application starts successfully. New browser acceptance, independent review, cloud deployment and the revised defense package remain pending. Earlier 245-test and browser results describe the baseline only.

The selected additional implementation is a read-only rehearsal of a draft policy against bounded employee questions before publication. It compares source excerpts from the current corpus and the proposed revision, with existing permissions and version checks. A changed answer is not proof that the draft is legally correct. The previous acknowledgement/readiness proposal remains an unimplemented candidate. The owner rejected presenting country routing or ordinary notification-and-quiz workflows as sufficient differentiation.

The owner's supplied archive contains ten Crextio HTML screen sections, design tokens and reusable blueprints. It is unpacked at `.artifacts/design-import/crextio-rea-reverse-engineered/`. Its pixel parity and runtime have not yet been verified by this coordinator. Importing its source does not establish application acceptance.

Preserve both request types, all 30 base courses, and the three-role request journey. Source, browser and cloud evidence remain distinct. Existing COV1 and R3 limitations remain open. The submission requirements and packaging check are recorded in [submission checklist](product/submission-checklist.md).

## Outcome and authority

Deliver a working Digital HR product that maximizes first-place readiness through the published scoring criteria. The jury's decision is external. The user authorizes autonomous implementation until 16:45 Asia/Almaty, meaningful frequent commits, regular push to `Yerlan110110/Jana`, a public synthetic demo, and defense materials. Preserve all restored history and inspect new remote commits before publication. No force-push, paid infrastructure, private MIS Pro material, real personnel data, or real external HR writes.

SureForge tier is Standard. This is substantive multi-step work in an isolated synthetic environment with reversible code changes. Public delivery still requires privacy, license, actual launch, and independent review checks. There are four gates with at most three rounds each. Required missing checks remain open.

## Authoritative inputs

The latest attachments match the previously inspected PDFs byte for byte.

| Input | SHA-256 | Local evidence |
| --- | --- | --- |
| Digital HR brief, 3 pages | `3dde2945d417a63b2af5cea48697adabc7db8f8be1f4d069d697e47db256f65b` | `.artifacts/hackathon/source/digital-hr-brief.pdf` |
| Hackathon deck, 20 pages | `f6b1a82bd9043e8ccd12330fe30e61f091f3dfb54f60c7fb1655e6350a133c6a` | `.artifacts/hackathon/source/event-deck.pdf` |

All three brief pages and the deck's company, values, Digital HR, scoring, and rules pages were rendered and inspected. Other-track content is not a Digital HR requirement. The JanaAddress offline and address-throughput rules do not apply to this track.

The [official event page](https://terricon.kz/ru/hackathon) lists 16–18 October, online and offline participation, two cases, and closed registration. The [organizer announcement](https://terricon.kz/tpost/gsi7uyn7k1-v-karagande-proidet-hakaton-s-prizovim-f) gives the same dates and the Karaganda venue. The supplied deck identifies 2026. Exact submission and defense hours, this jury's membership, and the competitor count remain unverified. The user's reference to 100 people is an ambition, not a verified team count.

The official event page was opened again on 18 October. It places 14:00 beside the date range, without identifying a submission or defense deadline. That time is not used as the final deadline.

## Score and product choices

| Criterion | Weight | Demonstration and acceptance unit |
| --- | --- | --- |
| End-to-end process | 30% | Employee submits, manager decides, HR completes, employee sees the confirmed result |
| Functionality and UX | 20% | Read-only profile, recoverable forms, scoped queues, notifications, keyboard and narrow screens |
| Architecture and engineering | 20% | Existing Django/PostgreSQL source, generated contract, transactions, permissions, Docker and reproducible checks |
| HR assistant | 15% | Grounded answer with a fresh accessible citation; refusal and explicit HR escalation |
| Academy | 10% | Assigned material, persisted progress, server-scored attempt and retained history |
| Presentation | 5% | Live role journey, clear boundaries and evidence-backed explanation |

The owner's scope exceeds the minimum brief. Both leave and salary advance remain required. Preserve 30 substantive courses and varied synthetic employees and states. The core product promise is that a person understands the next action, its responsible role, and the confirmed outcome.

Use the existing backend and session authentication. Reuse real professional mechanisms and licensed primitives. Custom code is justified for JanaMen's domain composition and generated API integration, not for replacing established controls or inventing a second backend.

## Ordered implementation and ownership

1. Restore the bundle and verify the original PostgreSQL baseline. This is complete. Remote was empty on restoration. The restored history and integrated source checkpoints are now published without rewriting history.
2. Resolve Pace deployment/source/license differences and close server gaps G1, G2 and the G3 fulfillment projection. The source changes are integrated. Independent and browser verification remain required. G3 balance breakdown and G4 reviewer reassignment are not selected. UI must not imply either capability.
3. Freeze the shared frontend foundation. Coordinator owns router, session/cache boundary, generated types, global tokens, lockfiles, Knowledge, home, notifications and operations. A separate implementation worktree owns requests, Academy, team/profile views and its feature CSS. It first records professional-source research and reuse decisions.
4. Integrate full journeys. Commands use generated types, server permissions, version checks and stable keys for uncertain retries. No client-only approval, payment, course completion or policy publication.
5. Run the real product in Docker and the browser. Inspect the inventory below on the current snapshot. Create and prove `verify-janamen` before trusting browser acceptance.
6. Freeze a candidate for independent correctness, security and interface review. Investigate findings, repair confirmed defects, and recheck affected units. Then run CI-equivalent checks and publish finished green units through the verified GitHub connection.
7. Publish a synthetic live demo and finish launch instructions, defense script, architecture explanation and evidence report. Keep mocked integrations and extractive assistant mode explicit.

Each implementation writer gets a distinct checkout. At most two auxiliary active worktrees. Completed worktrees are archived with recoverable commits and retained evidence before reuse. The coordinator integrates serially. Independent reviewers do not author the changes they review.

## Coverage and finish conditions

`docs/verification/continuation-coverage.csv` enumerates S01–S31 from the existing screen contract plus cross-cutting journeys and packaging. It starts unverified. A row passes only with an applicable evidence reference. Content coverage and rendering coverage are separate. No sampled screenshot set may be described as complete visual coverage.

All specified views need their reachable data, loading, empty, error, pending, unavailable and permission states. State combinations that cannot occur under the API are recorded as inapplicable with a reason. Required render environments are desktop 1280 and 1440 pixels, narrow 390 and 320 pixels, and intermediate 768 pixels. Inspect keyboard focus/order, 200% zoom, reduced motion, Russian and Kazakh glyphs. Chromium is the primary automated browser. Other engines and physical devices remain separate unverified environments unless actually exercised.

Required end-to-end checks include both request types across three roles, return/edit/resubmit, stale writes, uncertain retry without duplication, foreign team and entity denial, account-cache isolation, failed then passed assessment, persistent progress/history, course publication/archive history, known/unknown HR questions, HR resolution tied to a published revision, source-access revocation, delivery failure/recovery and independent approval/delivery/accounting semantics.

Final entry points are a clean Docker launch, the actual web application, the public source repository and the permitted public demo. Source checks, unit results, provider tests, browser checks and live external integrations are separate claims. Mock 1C and Documentolog are permitted by the brief. A receipt is not payment, signature or official source accounting. Synthetic policies stay visibly marked.

## Risks, recovery and stops

The main assumption is that a source-bound assistant and mocked integrations meet the brief; both are expressly permitted. Optional live-model quality still needs a separate held-out check before a model claim.

The material implementation risks are wrong role scope, stale or duplicate commands, source revocation, inconsistent history, and license contamination. Evidence must target these behaviors, not only build success. The frozen Pace audit excludes uncertain Oxygen dependencies even where registry labels say MIT.

Stop accepted-release publication for unresolved material findings, failing required checks, absent independent review, missing deployment authority, exposed secrets, or unknown licensing. The owner explicitly authorizes source checkpoint pushes of completed green units. Such a checkpoint must keep incomplete acceptance visible and is not release approval. Continue independent reversible work. Preserve the branch, raw failed evidence and recovery references. Do not delete databases or rewrite shared history to obtain a green result. If tools or time prevent complete delivery, keep missing rows and name the strongest proved layer.

## Skills that changed decisions

Pstack sequences verifiable commits and separates authors from review. SureForge supplies the contract, coverage denominator and gate records. Fstack routes to the original authors. Emil's rules remove decorative page-entry motion from frequently used work screens and keep pending action labels stable. Jakub's accessibility rules require opaque visible focus, semantic status text and complete narrow-screen actions. Model the Domain keeps approval, delivery and accounting separate. Type System Discipline uses generated API models instead of duplicate DTOs. Boundary Discipline centralizes command errors. Separate Before Serializing Shared State assigns router and lockfiles to one integrator. REA records live Pace evidence without calling ordinary source inspection runtime capture.

## Gate record

| Gate | Snapshot | Round | State | Evidence or remaining condition |
| --- | --- | --- | --- | --- |
| Research | C2 inputs, Pace audit and journeys-reuse.md | 1 | READY | Supplied brief, official event, source/license audit and first-party Frappe/Moodle mechanisms are mapped to actual forms, queue, completion and version history. Authenticated third-party LMS behavior is not claimed. |
| Plan | C2 and coverage inventory | 1 | READY, self-review-only | Requirement traceability and an environment/dependency walk-through completed. Fresh Claude plan review could not run due to `Claude API rate limit reached. Try again later.` Independent release review remains required and is not waived. |
| Execute | Application `228e15c`, docs `a8c3a15` and later | 0 | PARTIAL | All eleven source checks and234 PostgreSQL tests pass. The fresh isolated `janamen-browser` build/start/readiness/nginx checks pass, followed by22 roles and ten keyboard checks. Its services stop successfully without deleting volumes. Raw reused-stack21PASS/1FAIL after projected leave balance0 and the separate driver argument failure remain retained. These functional results do not close complete visual/state acceptance. |
| Deliver | Frozen repaired application `228e15c` | 3 of 3 | BLOCKED | Independent R3 Standards PASS is bounded. Spec FAIL concerns mandatory C2 coverage. F1-F6, ST1 and W1 exact repair criteria pass or retain qualified prior evidence. The reviewer independently builds Docker and matches all45 public resources, checks the public entry and completes its assigned image queues. Concrete missing compositions and exclusions remain explicit. No fourth round or accepted-release claim is authorized by this record. |
