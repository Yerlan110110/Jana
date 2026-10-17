# Demonstration data contract

Reconciled with implemented code through `f779305` on 17 October 2026.

## Purpose

All demonstration people, source imports, regulations, learning materials, and provider records are synthetic.
They exercise product decisions and are not descriptions of actual Jana Post employment policies or personnel.
Requests, notifications, course results, and profiles reference the same provisioned people and domain records.

The dataset contains substantive material for 30 distinct courses. Catalogue count, learning progress, due status, and assessment history remain separate quantities.
The frontend reads these quantities from the API. This document does not supply constants for interface cards.

## Recorded fresh baseline

[demo-baseline.json](../verification/evidence/demo-baseline.json) records the complete seed at `2026-10-17T14:31:09.449Z`.
Its stage is `fresh_complete_seed_before_http_smoke` and its `synthetic` marker is true.
The snapshot precedes the additive workflow probes and the worker's export processing.

| Recorded quantity | Value | Evidence field |
| --- | ---: | --- |
| Employees | 58 | `employees` |
| Legal entities | 2 | `legal_entities` |
| Departments | 6 | `departments` |
| Leave and advance requests together | 126 | `requests` |
| Submitted request revisions | 109 | `request_revisions` |
| Requests with a second submission | 1 | `requests_with_second_submission` |
| Distinct courses | 30 | `academy.course_count` |
| Published courses | 30 | `academy.published_course_count` |
| Archived courses | 0 | `academy.archived_course_count` |
| Published course revisions | 30 | `academy.published_revision_count` |
| Lessons | 60 | `academy.lesson_count` |
| Questions | 90 | `academy.question_count` |
| Material words | 12,702 | `academy.material_words_total` |
| Enrollments | 189 | `academy.enrollment_count` |
| Employees with enrollments | 29 | `academy.learner_count` |
| Quiz attempts | 94 | `academy.quiz_attempt_count` |
| Knowledge documents | 36 | `knowledge_documents` |
| Knowledge cases | 6 | `knowledge_cases` |
| Accepted mock source batches | 2 | `source_imports.accepted` |
| Rejected mock source batches | 2 | `source_imports.rejected` |
| Pending exports before the worker runs | 18 | `exports.pending` |

The material count uses `body_markdown.split()` for the recorded lessons. It measures text volume, not reading time or learning effectiveness.
These combined baseline counts supersede earlier isolated fixture counts for this delivery. They do not overwrite the historical results recorded in earlier module reports.

## Organization

The baseline has 58 employees across two legal entities and six departments. The business roles are `employee`, `manager`, and `hr`.
The primary scenario uses `employee.demo`, direct manager `manager.demo`, and `hr.demo`. A second HR account, `hr.alt.demo`, supports decisions that the first HR cannot make on its own request.
`otherteam.demo` belongs to another team. `foreign.demo` belongs to the other legal entity. `new.demo` supplies a new-employee scenario.

The integration seed grants the explicit `integrations.operate_integrations` permission to synthetic HR operators. A permission grant does not replace the HR and entity checks.
Technical superuser creation is a separate administrative operation, not a fourth business role or an automatically provisioned demo login.

The identity seed uses deterministic UUIDs and `SYN-<username>` source identifiers. It preserves existing accounts and official facts on rerun.
The complete seed subsequently imports a normalized snapshot through mock 1C. Its initial accepted source label is `mock_1c:1`; the identity bootstrap alone is not proof of a completed integration import.

`seed_demo` writes generated credentials to a private local JSON file. Its terminal output reports counts and the file location without printing passwords.
Reruns preserve changed passwords and known credentials. An existing password that cannot be recovered is reported as unavailable instead of being silently reset.
Credentials and runtime environment files remain outside Git.

## Requests

Both leave and salary advance are implemented request kinds. The recorded fresh distribution is as follows.

| Business status | Requests |
| --- | ---: |
| `draft` | 18 |
| `pending_manager` | 15 |
| `pending_hr` | 21 |
| `approved` | 18 |
| `rejected` | 19 |
| `returned` | 17 |
| `cancelled` | 18 |

These counts sum to 126. There are 109 submitted revisions and one request with a second submission in the recorded seed.
The API preserves the snapshot, assigned reviewer, reason, chronological history, and version for each submission. A returned request can be edited and resubmitted through the existing commands.

The demonstration leave convention counts calendar days inclusively. It is explicitly synthetic and is not an assertion about Jana Post's legal leave calculation.
Portal approval reserves leave in the projection without changing the official imported balance. Explicit source incorporation and reversal determine when a reservation is already reflected in that balance.
Approval of an advance is a human workflow result. It does not establish payment.

The [HTTP workflow runner](../../scripts/verification/smoke_workflows.py) creates its own leave, advance, and access-probe records.
It chooses future leave dates from the existing API records and uses a new run identifier, course code, and command keys on every run.
Its return, edit, resubmit, approval, and cancellation checks add evidence without modifying the seed requests.

## Academy

The recorded seed revision is `academy-synthetic-v1`. It contains 30 courses, 60 lessons, 90 matching questions, and 12,702 material words.
The six implemented categories cover HR actions, logistics data, communication, information security, team work, and knowledge use.
All 30 initial courses are published. The initial snapshot contains no archived course and one published version per course.

The catalogue belongs to the first synthetic legal entity. Its 189 enrollments belong to 29 employees in that entity.
The second entity does not inherit this content. Its HR can create and assign separate courses through the same scoped APIs.
The first entity's course count must not be displayed as a shared catalogue available to all 58 employees.

The primary employee has the following recorded distribution.

| Quantity | Baseline |
| --- | ---: |
| Assigned courses | 24 |
| Completed | 8 |
| In progress | 6 |
| Not started | 10 |
| Overdue and incomplete | 5 |
| Required | 18 |
| Recommended | 6 |
| Required and incomplete | 10 |
| Due in the next seven days at capture | 4 |
| Enrollments with a failed attempt in their history | 5 |

Completion states sum to 24. Due status, requirement, and failed-attempt history are independent dimensions and must not be added to that total.
A completed enrollment can retain an earlier failed attempt. Completing material alone does not mean that the assessment passed.
The whole seed contains 94 stored quiz attempts.

Due dates are based on the first initialization. Reseeding does not move them to preserve an attractive overdue count.
The API's current summary is authoritative after time passes or people complete work. Estimated course minutes describe content, not measured study time.

Course material, summaries, and questions are Russian. Kazakh course titles are present; the baseline records `titles_only; summaries_and_lessons_not_translated`.
A full Kazakh translation and its editorial review are not complete. A title or locale field must not imply that the entire course is available in Kazakh.

HR publishes immutable course versions and assigns the current published version. Learners own their progress commands; the server calculates assessment results.
Learner responses exclude answer keys. The public synthetic seed contains its demonstration keys and is not a secure examination system for real personnel.

The workflow runner creates a uniquely coded additional course, tests failed and successful attempts, publishes a second version, and archives that course.
Its completed enrollment retains the first version and its result. These additional records are not part of the 30-course fresh baseline.

## Knowledge

The baseline contains 36 synthetic knowledge documents and six knowledge cases.
Published revisions, language, owner, audience, and source identity determine which material is available to a caller.
Restricted HR material and another entity's material support access checks before retrieval and when a citation is opened.

Supported and unsupported questions have distinct expected results. Missing evidence must produce refusal and an available HR escalation path.
The recorded no-key HTTP journey uses explicit extractive retrieval. A configured generation adapter does not establish live model quality without an actual provider run.
The assistant neither publishes employee messages as regulations nor makes HR decisions.

The [knowledge verification report](../verification/knowledge.md) and its recorded evidence distinguish retrieval, citation, refusal, provider simulation, and actual HTTP behavior.

## Events and integrations

Notifications belong to recipients and reference the corresponding domain records. Reading a notification does not change a request, enrollment, or workbench task.
Decision history and published evidence remain under their owning modules. The workbench combines current scoped records instead of maintaining a second task database.

The initial source audit contains two accepted and two rejected normalized mock 1C batches. Rejection preserves official facts and retains validation evidence.
These are synthetic source snapshots, not a verified real 1C wire format.

At baseline capture, 18 exports are pending and none is processing, processed, or failed. Worker execution changes these counts.
The seed prepares deterministic delivery-failure scenarios for later processing; a failure is not already present in the captured outbox state.
Mock receipts confirm document acceptance only. A failed export remains separate from human approval, and a receipt does not confirm payroll, signature, or leave incorporation.

## Validation and readiness

The seed command, `academy_report`, module tests, and the HTTP runner provide different evidence.
The complete seed and baseline establish initial counts. Module tests exercise scope, consistency, failure, and concurrency behavior.
The HTTP runner proves persisted workflows through real sessions and CSRF without using the Django test client.
Its sanitized report records newly created resources and the observed worker outcome.

A seed rerun preserves existing requests, published evidence, progress, source audits, operator changes, and consumed mock failure budgets.
Live counts after workflow checks must not be compared with the fresh baseline as if both described the same database stage.
Use the actual run's stage and capture time when publishing a count.

The implemented API and populated data are ready for the separate frontend author to consume.
Rendered UX, browser accessibility, live model quality, real company integrations, Docker runtime, final publication, and published-commit CI are not established by this baseline.
The [final combined PostgreSQL report](../verification/evidence/postgresql-suite.json) records 191 tests passed with zero failures, errors, or skips in 145.92 seconds at `f779305`, including the complete seed and rerun checks.
That suite ran on native PostgreSQL 16.15. It verifies backend behavior separately from the baseline's measured counts; the [execution plan](../architecture/execution-plan.md) keeps publication, CI, and the remaining environment checks explicit.

