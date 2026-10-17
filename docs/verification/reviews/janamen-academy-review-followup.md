# Academy review correction verification

Review date is 17 October 2026. The verified commit is `4380f289c41b6c0d9bee6e1a045c1b32960b6427`.

The verdict is **Pass for the three findings in the independent Academy review and their directly implicated corrections**. No unresolved finding remains from `/tmp/janamen-academy-review.md` at this revision. This addendum closes that Academy review gate. It does not replace the separate review of other modules or the final integrated verification.

## Independence and scope

The same non-author reviewer inspected the correction. The source was exported with `git archive 4380f289c41b6c0d9bee6e1a045c1b32960b6427` to `/tmp/janamen-academy-review-4380f28`. No implementation edits were made by the reviewer.

The review covers the assignment scope correction, employee filter correction, directly related request and department filter corrections, TM-03 and TM-04 content changes, and the Academy serializer class renames. Other changes in the commit are outside this follow-up scope. The original Academy review remains the record of the earlier failing behavior.

## Finding closure

| Original finding | Verified correction | Independent evidence | Result |
| --- | --- | --- | --- |
| HIGH assignment race after source change | `assign` re-reads the target through `visible_employees`, locks that employee with `SELECT FOR UPDATE OF self`, applies active employee and user predicates, checks current HR authority, and compares the target entity to the course entity before any assignment write. | Both retained synchronized PostgreSQL reproducers pass. A transfer or deactivation committed after the inner precheck now rejects assignment. No enrollment or assignment notification is created. Ordinary assignment, retry, scope and concurrent duplicate-assignment checks also pass. | Closed |
| MEDIUM hidden employee existence through filters | Academy declares an explicit `UUIDFilter` over `employee_id`. Requests use the same approach, and employee lists declare a UUID filter over `department_id`. These filters operate on their existing scoped querysets without globally validating related-object existence. | Four endpoint regressions pass. A foreign valid UUID and an unknown valid UUID both return `200` with zero matching results. Malformed UUIDs return `400`. The endpoints are Academy list, Academy summary, requests list and employee list. | Closed |
| MEDIUM technical API vocabulary in a course for managers and HR | TM-03 teaches the reader to inspect the current request and history, distinguish changed data from an unknown network result, and use the portal's offered continuation. Its quiz no longer requires `payload` or `Idempotency-Key`. TM-04 now describes the HR assignment action in product terms. | The edited lessons and all changed questions were read. The curriculum validation passes for distinct material, size, lesson and question counts, valid answer choices, and the synthetic-content notice. | Closed |

`QuizAnswerSerializer` and `AcademyVersionCommandSerializer` are transport class renames. Inspection found no changed JSON fields in those classes. The focused content, progress, attempt and draft route checks pass. A full OpenAPI generation was not repeated by this reviewer, so the parent's schema verification remains separate evidence.

## Executed verification

The following command ran against the isolated local synthetic PostgreSQL 16.15 review database, using the corrected archived source.

```bash
cd /tmp/janamen-academy-review-4380f28/backend
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_academy_review /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest --reuse-db -q apps/academy/tests/test_assignment_source_race.py apps/core/tests/test_scoped_filters.py apps/academy/tests/test_seed.py::test_curriculum_contains_distinct_substantive_material_and_matching_questions apps/academy/tests/test_academy.py::test_assignments_scoped_retried_without_duplicates apps/academy/tests/test_academy.py::test_scope_applies_to_lists_details_and_progress apps/academy/tests/test_academy.py::test_learner_reads_key_free_published_revision_only apps/academy/tests/test_academy.py::test_failed_attempt_preserves_progress_then_success_records_result apps/academy/tests/test_academy.py::test_draft_validation_and_publish_require_complete_content apps/academy/tests/test_concurrency.py::test_concurrent_assignments_create_one_enrollment
```

Result was **13 passed**. Twelve warnings concern the missing `staticfiles` directory in the temporary source export. This focused backend verification did not run `collectstatic` or review a rendered interface.

This is a targeted correction check, not a second full baseline suite. The 25 earlier baseline passes and these 13 passes overlap. Do not sum them into 38 distinct Academy tests.

## Content evidence and retained behavior

Recalculation from the corrected curriculum gives 30 courses, 60 lessons, 90 questions and **12,702 words**. TM-03 contains 457 words and TM-04 contains 428 words. Exact documentation claims of 12,670 words refer to the earlier source and should be updated when describing this revision.

The implementation deliberately preserves existing published versions when seed runs again. The corrected source appears in a fresh seeded database or through a separately published course version. This review does not claim that an already seeded course snapshot was overwritten. Preserving that snapshot is the accepted history contract.

The prior Pstack domain and boundary review approach still applies. Fstack and the original Emil and Jakub skills informed the distinction between actual state evidence and a future UI claim. The content correction now describes a useful reader decision while the exact command recovery mechanism remains in developer code and documentation.

No new material defect was found in this bounded correction review. Final full-suite, container, browser, provider and other-module review gates remain with their designated owners.
