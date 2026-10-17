# Contract correction: independent closing check

Reviewed immutable commit: `310ecbc1b5e6a09ffe205ffe77ed410d35dd23b6`.

Reviewer: `/root/core_knowledge_review`, non-author. Date: 17 October 2026.

## Verdict

**PASS — F1 is closed at this commit.** The PostgreSQL/SQLite contract-generation mismatch recorded in `/tmp/janamen-final-foundation-review.md` is resolved. That original report is preserved unchanged as evidence of the earlier `90eace` state.

The implementation delta consists of `read_only_fields = fields` in `RequestHistorySerializer.Meta` and `RequestRevisionSerializer.Meta`, plus regenerated OpenAPI and TypeScript artifacts. These serializers describe immutable response evidence. Their output fields no longer inherit inappropriate database-dependent input-validation metadata.

## Executed closing checks

The source was exported with `git archive` into `/tmp/janamen-review-310ecbc`. No application code or generated artifact in the main repository was edited.

For each database configuration, the reviewer independently executed the generator's bounded steps: `manage.py spectacular --validate --fail-on-warn`, the pinned `openapi-typescript` CLI, and a byte comparison with both committed artifacts. Generation used SQLite in memory and PostgreSQL configured with the separate `janamen_review` DSN.

| Check | SQLite | PostgreSQL |
| --- | --- | --- |
| OpenAPI validation | PASS, exit 0 | PASS, exit 0 |
| TypeScript generation | PASS, exit 0 | PASS, exit 0 |
| OpenAPI equals committed bytes | PASS | PASS |
| TypeScript equals committed bytes | PASS | PASS |
| Both serializers retain fixture JSON output | PASS | PASS |
| Every declared evidence field is read-only | PASS | PASS |

The identical hashes under both configurations are:

- OpenAPI SHA-256: `d52b129ad8978bf6c9893e4c6861592447d15fb48aa70f8f2c821fe2ed8df284`.
- TypeScript SHA-256: `96b8b34ffd0f791c48eaa60a6ae213c7de7e527423cc419174fb07c7105e1620`.

The serializer assertions constructed unsaved history/revision instances with fixed UUIDs, an aware timestamp, counters, an actor, a manager reference and a Unicode payload/comment. They compared JSON output with the preceding `ModelSerializer` model/field contract, checked every output key, and asserted read-only flags. No database records were written. This comparison verifies response preservation; it does not introduce a new public write path or rely on one.

## Scope and retained limits

No full test suite, seed performance run, Docker build, live provider call or browser flow was repeated. The parent's subsequently reported combined-suite seed-query performance problem is a separate finding and is not closed by this contract verdict. Remote GitHub CI was not executed by this reviewer; its formerly failing artifact comparison is independently reproduced as passing here.

Temporary evidence is stored under `/tmp/janamen-310ecbc-{sqlite,postgresql}-{openapi.yaml,schema.d.ts}`. The serializer checker is `/tmp/janamen-310ecbc-serializer-check.py`.
