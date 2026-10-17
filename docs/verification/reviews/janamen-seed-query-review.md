# Independent seed-query correction review

Reviewed immutable commit: `f779305cd298d7ed83a7d651d6b53c840f909668`, compared with `310ecbc1b5e6a09ffe205ffe77ed410d35dd23b6`.

Reviewer: `/root/core_knowledge_review`, non-author. Date: 17 October 2026.

## Verdict

**PASS for the bounded seed-query correction.** The deep export/employee join has been removed, the intended fault targets are preserved, and existing fault state survives a seed rerun. The full all-module seed/rerun regression passes with the PostgreSQL per-statement timeout enabled. No blocking finding was identified in this delta.

The source was exported with `git archive` into `/tmp/janamen-review-f779305`. Tests used only the dedicated `janamen_review` configuration and its pytest-managed `test_janamen_review` database. The parent's `test_janamen` database was not accessed or dropped. No product code or root documentation was edited.

## Inspected behavior

`backend/apps/integrations/seed.py` now identifies the primary demo employee from the supplied employee collection, obtains that employee's approved request IDs and kinds, obtains final-approved history event IDs for those requests, and retrieves export messages by those event IDs and the existing export topic.

These are separate single-table selections joined in memory through UUID dictionaries. Query construction no longer asks PostgreSQL to plan the six-table reverse-relation join. Only the fields needed for selection and the fault kind are fetched in the first two stages. If there is no primary employee or no matching approved request, the empty ID sets produce no fault candidates.

The event/request keys preserve the relationship to the actual final approval. No business transition or new approval is manufactured by the lookup. `MockDeliveryFault.get_or_create` retains its original defaults and leaves existing fault records untouched. Approval history and the export topic still determine the candidate messages; unrelated employees' exports are excluded.

The added `SET LOCAL statement_timeout = '10s'` is inside the PostgreSQL test transaction. It bounds each individual SQL statement in that test, including both seed invocations. It is not a ten-second total test/seed budget or a runtime setting applied to the application.

## Executed checks

| Check | Observed result |
| --- | --- |
| Full all-module seed and rerun | Passed with the committed 10-second per-statement guard. Existing manifest, counts, private-output and rerun assertions remain intact. |
| Integration bootstrap and permission revocation | Passed; initial source/grant setup and preservation of later operator-permission revocation remain correct. |
| Integration setup through the seed command | Passed with the other optional modules skipped. |
| Existing operator fault changes on rerun | Passed; a cleared permanent failure stays cleared, and source audits are not duplicated. |
| Independent exact target and both fault-state changes | Passed; exactly two faults point to the primary employee's final approved requests and the document export topic. Fresh leave has one transient failure and no permanent failure; fresh advance has no transient failure and one permanent failure. After setting the transient budget to zero and clearing the permanent flag, rerun preserves both fault IDs, associations and values, plus request/outbox/source-audit counts. |

The independent test follows the stored fault → outbox → approval history → request references with direct identifier lookups. It asserts the externally meaningful fixture behavior rather than requiring the implementation's dictionary structure.

## Reproducible command and timing

Working directory: `/tmp/janamen-review-f779305/backend`.

```bash
DATABASE_URL=postgresql://nobody@127.0.0.1:55432/janamen_review \
  /workspace/scratch/8e3181f15557/Jana/backend/.venv/bin/python -m pytest -q \
  apps/core/tests/test_seeds.py::test_complete_seed_serializes_module_manifests_and_preserves_combined_records \
  apps/integrations/tests/test_seed.py \
  review_tests/test_seed_fault_targets.py \
  --durations=5
```

Result: **5 passed in 54.27 seconds** on the local PostgreSQL 16.15 review database. Four checks are repository regressions; the fifth is a temporary independent check at `/tmp/janamen-review-f779305/backend/review_tests/test_seed_fault_targets.py`.

The full all-module seed/rerun test call took **29.01 seconds** in total. The existing fault-preservation test took 10.81 seconds and the independent target/preservation test took 10.47 seconds; each includes multiple operations and seed invocations. Those complete-test durations are compatible with a ten-second limit on each separate SQL statement.

## Limits

This reviewer did not rerun the previous pathological query or independently reproduce its reported 897.67-second combined-suite timing. No speedup ratio, exhaustive optimizer-plan guarantee or total seed-duration limit is claimed. The evidence is the inspected removal of the multi-table join, the executed per-statement timeout regression and the preserved fixture behavior.

The parent's final whole-suite run remains separate evidence. No whole-suite repeat, Docker execution, real integration request, provider call or browser flow was performed for this bounded correction.
