# Independent Academy review

Review date is 17 October 2026. The reviewed commit is `1aac8e187ba948360333b74c0bd5ff0297697afd`.

The verdict for this commit is **Block**. One authorization race permits an invalid new assignment after an employee transfer or deactivation. A second defect reveals whether an otherwise hidden employee UUID exists. A curriculum correction is also needed for the intended manager and HR audience.

## Scope and independence

The reviewer did not author the Academy implementation. The reviewed source was exported with `git archive 1aac8e1` to `/tmp/janamen-academy-review-1aac8e1`. Product files in the shared Jana working tree were not changed.

The review covered `apps/academy/models.py`, `content.py`, `services.py`, `selectors.py`, `filters.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `seed.py`, curriculum assembly, existing Academy tests, and `docs/verification/academy.md`. Shared identity permissions, selectors and idempotency code were read to understand the boundary. All course titles and questions were inspected. The curriculum word and item counts were recalculated from the exported source.

Parent working-tree authentication, CORS, settings and Workbench changes are excluded. The later Integrations implementation is excluded. This report does not claim a rendered frontend, a browser review, a live provider check, or a full independent translation edit. The reviewer uses the parent model family. This is an independent author boundary, not a diverse-model panel.

Throughput checkpoint is not applicable to this read-only investigation. Temporary reproducer files are the only code authored by this reviewer.

## Findings

| Severity | Location | Current behavior | Required correction | Evidence and effect |
| --- | --- | --- | --- | --- |
| HIGH | `backend/apps/academy/services.py:145`, `:153` | `assignment_scope` validates the target before its row lock. `assign` then fetches the current locked target but does not validate its new entity or activity. | Validate the current protected employee after the lock, including active employee, active user, current permitted entity and course entity. Use a lock order consistent with the source import contract. Reject the command before creating an enrollment, event or notification when its target is no longer permitted. | Two PostgreSQL reproducers return `201` after another transaction has already committed a valid entity transfer or deactivation. The first persists a cross-entity enrollment. The second persists an enrollment for an inactive employee. Each creates an assignment notification. |
| MEDIUM | `backend/apps/academy/filters.py:39` | The implicit `employee` ModelChoiceFilter validates against all employees before it filters the already scoped enrollment queryset. | Declare a UUID filter over `employee_id`, or give the choice filter a scoped queryset. A hidden valid UUID and an unknown valid UUID must have the same observable result. | An ordinary employee receives `200` for a foreign entity employee UUID and `400` for a nonexistent UUID. Both list and summary endpoints reproduce the distinction. This reveals existence, not the employee's name or the hidden learning records. |
| MEDIUM | `backend/apps/academy/curriculum/team.py:139`, `:152` | TM-03 asks managers and HR to inspect the API and select an answer that requires the terms `payload` and `Idempotency-Key`. The same lesson says users do not manage these identifiers. | Keep the implementation rule in developer documentation. Ask the learner to check the saved result or use the portal's offered recovery action before creating a new request. Preserve the distinction between a stale version and an unknown network result. | Source inspection of TM-03 and the intended audience in `docs/design/curriculum-and-fixtures.md:65`. The technical vocabulary does not help the nontechnical learner make a permitted product decision. |

### Assignment race reproduction

The reproducer calls the real `POST /api/v1/academy/enrollments/` route through DRF's test client. A synchronization wrapper calls the original `assignment_scope` without changing its result. It pauses after the second scope check, which is the check inside `assign`. Another database connection locks and updates the employee, then commits. The request resumes and runs the unchanged assignment implementation.

For the transfer, the second transaction changes the employee's legal entity and department together and clears the manager through the validated model save. For deactivation, it changes `Employee.is_active` to false. These are controlled employee source changes. The test does not call or claim verification of a real 1C connector.

Observed output was as follows.

```json
{"source_change":"entity_transfer","http_status":201,"employee_active":true,"cross_entity_enrollment":true,"assignment_notifications":1}
{"source_change":"deactivate","http_status":201,"employee_active":false,"cross_entity_enrollment":false,"assignment_notifications":1}
```

The reproducer is `/tmp/janamen-academy-review-1aac8e1/backend/apps/academy/tests/test_independent_assignment_race.py`.
Its SHA-256 is `f955e322a8f6ed123b077290d1f8d32f070a39abb8b9c683995808a38af74242`.

### Employee filter reproduction

The reproducer authenticates the ordinary employee, then compares a foreign employee UUID with a fresh valid UUID absent from the database. No foreign employee details are read.

Observed output was as follows.

```json
{"endpoint":"list","foreign_status":200,"unknown_status":400}
{"endpoint":"summary/","foreign_status":200,"unknown_status":400}
```

The reproducer is `/tmp/janamen-academy-review-1aac8e1/backend/apps/academy/tests/test_independent_employee_filter.py`.
Its SHA-256 is `b0c564d372ae5da9213026f5f3fe2b23ffcb4e02474ab4eb35e33ae81353028a`.

## Independent verification

The test commands used the installed locked Python environment, the immutable exported application source and a separate local PostgreSQL 16.15 database. The DSN points only to synthetic local review data.

```bash
cd /tmp/janamen-academy-review-1aac8e1/backend
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_academy_review /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest apps/academy -q -s
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_academy_review /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest apps/academy/tests/test_independent_employee_filter.py --reuse-db -q -s
```

The first run finished with **25 passed and 2 failed**. All 25 existing Academy tests passed. The two failures are the new desired-behavior assignment race checks. The second targeted run finished with **2 failed**, both new desired-behavior employee filter checks. These are four distinct reproducer cases across two command executions. Their counts must not be added to another author's test count and presented as additional independent baseline coverage.

The suite reports a missing `staticfiles` warning because this backend source review did not run `collectstatic`. The first run also reported a test database teardown warning about five still-open connections. The Python test process subsequently exited. The targeted second run used the isolated review database with `--reuse-db`. Neither warning explains the observed authorization results.

The baseline suite and source inspection support these narrower conclusions.

| Area | Evidence and conclusion |
| --- | --- |
| Ordinary scope | Existing API tests pass for employee ownership, manager team visibility, HR authorship, foreign entity denial, and denied progress by a manager. The two findings above qualify any broader claim about all scope behavior. |
| Published snapshots | CourseVersion and QuizAttempt use the shared append-only application model. Existing tests prove rejected ORM overwrite and preserved old title, questions and result after new publication. This does not prove privileged SQL tamper resistance. |
| Answer keys | Learner content uses QuestionSerializer rather than AuthorQuestionSerializer. Existing tests recursively inspect catalogue, content, result and attempts responses for keys, explanations and question snapshots. They pass. Public synthetic seed keys are intentionally visible in source, as documented. |
| Scoring | The server requires all mandatory material, validates the complete question and option set, calculates an unrounded pass comparison, and records a separate rounded display score. Existing exact-threshold and forged-field tests pass. |
| Stale commands and replay | Existing tests pass for stale progress rejection, same-command result replay, changed author scope before replay, duplicate assignments and concurrent attempts. They do not cover the target change after the assignment precheck, which this review reproduces. |
| Archive and version behavior | Current course availability controls progress and new assignment. Fixed enrollments retain their version. Archived material remains readable by its permitted owner and saved history remains available. The existing archive tests and documentation agree. |
| Progress summaries | Existing tests pass for filtered denominators, null percentage on an empty set, material versus final completion, failure history, and independent overdue state. |
| Curriculum fixtures | Recalculation produces 30 courses, 60 lessons, 90 questions and 12,670 words. All 30 courses have Kazakh titles. No Kazakh summaries are present. Existing seed tests independently pass for 189 enrollments, 29 learners, Dana's varied states and repeat preservation. |

No other material defect was confirmed in the reviewed Academy code. This is bounded evidence, not proof that every concurrent identity or integration change is safe.

## Skills that changed the review

`poteto-mode` and its Codex mapping established the immutable snapshot and the independent author boundary. `principle-model-the-domain` directed inspection toward the separate course availability, published version, enrollment and attempt invariants. `principle-type-system-discipline` directed inspection toward strict nested JSON validation and the implicit model-choice filter at an external boundary.

The project Fstack router, Emil's `emil-design-eng`, and Jakub's `better-interface` constrained the review to evidenced backend states. They do not support a claim that future rendered screens have passed design review. `better-writing` identified the TM-03 audience problem and preserved useful recovery behavior while moving implementation vocabulary to developer documentation. `technical-writing` and `unslop` shaped the report's concrete scope and qualifications.

The `no-comments` workflow was read. This reviewer did not run a separate comment-audit child or claim that gate passed. The parent is coordinating the independent comment audit for the complete project. This Academy review supplies its own non-author correctness verdict.

## Closure condition

The Academy authorization race must be fixed and independently rerun on the changed implementation. The employee filter distinction should be removed in both list and summary responses. The TM-03 correction needs a source review and the existing curriculum validation after any content change. A later report must name the new commit or exact changed source before replacing this Block verdict.
