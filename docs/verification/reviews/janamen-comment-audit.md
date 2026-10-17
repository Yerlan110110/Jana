# JanaMen comment audit

The bounded comment audit passed. No actionable misleading, stale, redundant, or rationale-missing comment was found.

The inspected checkout was `/workspace/scratch/8e3181f15557/Jana` at `4380f289c41b6c0d9bee6e1a045c1b32960b6427`, including the working tree present during inspection. This was an independent comment-only review. It makes no claim about runtime correctness or the separate runtime reviews.

The scope covered 171 first-party source files under `backend`, `scripts`, and `packages/api-client/src`. The inventory contained 166 Python files, three JavaScript modules, one shell script, and one TypeScript file. Python comments and docstrings were extracted with tokenization and AST inspection. JavaScript, TypeScript, shell, and configuration comments and suppression markers were inspected with scoped text searches. No tests or application commands ran.

Two module docstrings were retained after checking their source context.

- `backend/apps/identity/seed.py`, module docstring at line 1, states the synthetic-data constraint. The repository's product contract requires synthetic people, and the seed uses synthetic identifiers and demonstration records. This comment preserves a real caller constraint.
- `backend/apps/hr_requests/seed.py`, module docstring at line 1, states that seed transitions use the API's application commands. `seed_requests` calls `services.create`, `services.submit`, `services.decide`, `services.update_draft`, and `services.cancel`. The corresponding request views call those same symbols. The description is current and communicates the seed entry point's intended contract.

The remaining comment tokens were 13 generated Django migration headers and five executable shebangs. No commented-out code, standalone comment-like Python strings outside docstrings, or inline lint and TypeScript suppression directives were found. The configuration's `E501` exception is a style exception. Its migration-wide exception applies to generated migrations. Neither yielded an actionable comment finding.

No source or documentation file was touched. The only written file is this report. The deletion count is zero. There are no `MUST KILL` flags, refactor targets, restored comments, or open comment findings.

The audit skipped vendored skills, legal and license notices, generated `contracts/openapi.yaml` and `packages/api-client/src/schema.d.ts`, dependency and runtime directories, and prose documentation. Generated migration header metadata and shebangs were inspected and preserved. Runtime logic was read only where needed to assess the two docstrings.

The `poteto-mode` Codex mapping and `comment-sicko` guidance determined the independent, scoped, report-only workflow. The `no-comments` exception for API contract documentation and the caller's instruction to preserve real constraints kept the two module docstrings. The `unslop` guidance kept this report factual and omitted cosmetic rewrite suggestions.
