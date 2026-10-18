# JanaMen continuation contract

Current contract C2. Owner is the coordinating Codex agent. Updated 18 October 2026.

This file records the current delivery scope. Historical backend verification remains in `docs/verification/`. A passing source check does not establish browser or deployment acceptance.

### Latest owner direction: connect policy changes to employee learning

The owner selected the end-to-end policy-update flow as JanaMen's additional product idea. This current instruction supersedes the older 15:44 continuation below, which selected draft-policy rehearsal and described acknowledgement as unimplemented. HR publishes a changed policy revision with one practical question; only employees inside its audience receive assignments and notifications; employees see section-level before/after changes and answer; managers and HR see scoped completion status. Incorrect answers are retained as attempts and can be retried. A later text-changing revision or archive closes older pending assignments. Metadata-only publication does not assign training.

This source contains the implementation in the knowledge module, migrations, generated OpenAPI client and React routes. Ruff, Django system and migration consistency checks, OpenAPI consistency, frontend typecheck and production build passed after integrating the latest GitHub commits. Vite warned that the main JavaScript chunk exceeds 500 kB. The employee assignment, answer and manager-progress path has no browser run or deployed-staging acceptance yet; the integrated candidate notes below cover separate browser proof for pre-publication rehearsal only.

The application now runs at **https://jmhr.vercel.app** on Vercel Services, with a dedicated Supabase PostgreSQL database and a Vercel outbox Daemon. The deployment retains the implemented Django and React application. [Cloud verification](verification/vercel.md) records current checks and observed failures. [Deployment instructions](deployment/vercel.md) identify the existing cloud resources.

Complete acceptance remains **BLOCKED** by COV1, missing mandatory state/environment evidence. The [independent R3 review](verification/reviews/janamen-release-r3.md) retains its original scope and limitations. This is a synthetic demonstration, not an accepted production release. No fresh independent approval of the cloud configuration is claimed.

An earlier owner request on 18 October assigned the continuing agent planning and orchestration, with SWE 2 High implementation workers and Gemini 3.8 Flash for cheaper bounded work. The owner explicitly prioritized meeting the deadline over conserving AI usage. The current user direction above supersedes that work allocation for the selected feature. The team has two nontechnical presenters. Their latest timing is **3 minutes, 1 minute speaking and 2 minutes demonstrating**. Older five-minute material requires revision. The exact official speaking limit remains unconfirmed.

### Integrated candidate checkpoint (historical; later owner direction applies)

The owner reiterated that the supplied Crextio archive must drive the actual screen structure, not only colors. The coordinator has now replaced the sidebar with pill navigation, rebuilt the home composition from the archive's four-column dashboard, and converted People rows to directory columns. [Port scope and limitations](design/crextio-source-port.md) records actual source paths and captures. The earlier palette-only result is not accepted. The structural change is local and undergoing a fresh role/browser run; it is not yet on the public site. Intro source is prepared but unwired pending the Astra film artifact.

Latest review update: the Gemini 3.8 Flash Medium independent review has completed. [Coordinator disposition](verification/reviews/integrated-rehearsal-r1.md) records accepted UI findings and distinguishes the documented HR-scope behavior from a permission defect. The findings are not yet fixed. The owner rejected policy rehearsal as the flagship differentiator; keep it as a supporting capability. The owner explicitly requested a second `codex/gpt-6-astra` worker at medium effort for a ten-second pre-login film using Cinetic and Earshot. That artifact-only worker is running in `.artifacts/films/janamen-intro`; no finished video, integration or deployment is claimed yet.

The owner moved the completion deadline to **16:45 on 18 October 2026** and requested frequent pushes of checked changes. The owner subsequently confirmed submission by 17:00 and the pitch at 18:00. Keep 16:45 as the internal completion target, leaving 15 minutes for owner submission. Baseline `f0b316e` precedes this checkpoint. Documentation checkpoint `27bdaba` is published on `origin/main`.

Both SWE 2 High implementation branches are integrated in the coordinator checkout through `1ee510e`. The coordinator replaced the temporary frontend API declaration with the generated contract and corrected preview invalidation and audience wording. The integrated PostgreSQL suite passes 255 tests in 175.93 seconds; evidence is `.artifacts/verification/checkpoint-1545/postgres-new.log`. The updated isolated application starts successfully. The expanded knowledge loop passes in the browser (17.36 seconds total run); all 22 role-suite tests pass in 102.72 seconds. A keyboard run overlapped the coordinator API-replacement check and recorded a 502; its isolated repeat passes all 10 checks in 39.67 seconds. Independent review is running on Gemini 3.8 Flash Medium against `89f8af9`. Public deployment `dpl_DPMnaw2pV4e3BTsoUXhhb1pRgFQ7` is READY at https://jmhr.vercel.app. Three clean browser sessions verified passwordless employee, manager and HR login. The new three-page PDF is locally rendered and inspected; that PDF was authored after this deployment and is not yet on the public site. Earlier 245-test and browser results describe the baseline only.

At this integrated candidate checkpoint, the selected addition was read-only rehearsal of a draft policy against bounded employee questions before publication. It compares source excerpts from the current corpus and the proposed revision, with existing permissions and version checks. A changed answer is not proof that the draft is legally correct. The current owner direction above adds a separate post-publication flow: employees see changed sections, answer a practical question and report completion to their manager. The rehearsal remains available as the HR pre-publication step; no claim is made that the combined journey has been rehearsed on the public stand.

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

### 16:30. Уточнения владельца и параллельная проверка

Коммиты команды до `92ea844` объединены с локальным переносом интерфейса. Владелец заменил жёлтый акцент на зелёный Jana Post. Использованы существующие подтверждённые токены `#008c00` и `#007a00`. Пустой портрет заменён рабочим маршрутом из трёх настоящих ссылок, декоративные слои следующего шага удалены. Фильтры выровнены по нижнему краю, фокус области страницы отделён от фокуса интерактивных элементов. Помощник получил карточки примеров, которые заполняют форму, но не подделывают историю ответов.

Эти изменения ещё не опубликованы. Предыдущий браузерный прогон прошёл 20/22: две проверки потеряли видимую ссылку «Обучение команды». Ссылка возвращена, повторная проверка обязательна. Контракты и типы проходят после объединения. PostgreSQL и сборка интегрированной версии проверяются отдельно.

Новая параллельная группа по прямому запросу владельца: Space Bunny Free через OpenCode исследует одно отличие сверх ТЗ; Gemini 3.8 Flash medium независимо проверяет diff; второй Gemini готовит точный состав сдачи и сценарий на 180 секунд. SWE 2 High не начал работу из-за исчерпанной суточной квоты Devin. Astra medium продолжает Cinetic/Earshot фильм; ему передано изменение акцента на зелёный. Итогов этой группы пока нет. Подтверждённая флагманская уникальность остаётся открытой, существующие rehearsal и обновления правил не объявлены принятыми владельцем.

Emil применён к коротким переходам и уменьшенному движению; Jakub к обратимым CSS переходам, размерам управления и стабильным цифрам. Laziness Protocol сохранил существующие API и браузерные переходы без новой анимационной зависимости. Последний визуальный проход ещё не завершён.

## Checkpoint 16:39 Almaty

Current local checks: PostgreSQL 255/255; role browser journeys 22/22; corrected keyboard journeys 10/10; type checks, build, contract generation and migration drift passed. Browser captures show no horizontal overflow at 1440 and 320 pixels for the checked pages. Film playback and skip passed. Cloud knowledge migration 0004 applied after a private PostgreSQL backup. Three deterministic sample answers were added for each demo role; two runs retained the same total of 27 answers. Native date/select popups remain browser controls; custom replacement is not accepted. Public frontend deployment is pending.

Independent Gemini review: desktop routes remain reachable through the visible Menu button; contrary claim rejected. Tab order and text contrast corrected. Main-region outline suppression is intentional; interactive focus indicators remain. Space Bunny found focus-induced scrolling and supplied a minimal accepted correction. Fixture expansion proposal was rejected for unverified service assumptions; only existing ask_question service populated demo accounts. No claim of a winning or enterprise-certified feature.

## Public acceptance, 16:44 Almaty

Release 1cee5a7 deployed at https://jmhr-7bi4k6fg0-yqecea-6175s-projects.vercel.app and aliased to https://jmhr.vercel.app. Public readiness, HR one-click login, assistant screen and rehearsal button passed. Synthetic rehearsal document 5adf82de-9cbc-4c2d-9fd8-90de77117814 reports audience 29 to 3, 26 changed accesses and 3 lost sources. Draft remains unpublished. Public PDF matched SHA256 a5bfcc5dcba68dafbdd7890f54e5ecf5194de68a300c6475abde32db92055a4d. Two independent Space Bunny source audits confirmed business route coverage; attempt history is embedded in enrollment data, not missing. Policy revision history is the final frontend addition under verification. Production imports remain operator API; no import UI exists. Expansion plan is explicitly future work in docs/product/expansion-roadmap.md.

Policy revision history now passes source type/build checks and the Docker browser check: expanding a persisted revision displays its saved sections. Development-server login was not accepted as proof; the release Docker origin was used. The main site was already deployed before this final additive history panel. Final publication follows its independent review.
