# Integrated source checkpoint

18 October 2026, Asia/Almaty. This is a completed integration checkpoint, not release approval. Current acceptance lives in [continuation-status.md](../continuation-status.md).

Requests, profiles, team, Academy, source-backed HR knowledge and integration operations use the generated client and the same Django session. Imported employee facts remain read-only. Both request types preserve submitted revisions and decisions. Integration reads expose a server capability for the existing mock recovery command.

The owner ran the following checks against the coordinating source and Docker application.

| Check | Observed evidence |
| --- | --- |
| Complete PostgreSQL behavior suite | 231 passed, 192 warnings, no failed or skipped tests. `.artifacts/postgresql-operator-capability-full.log`. |
| Ruff and migration drift | Passed. `.artifacts/backend-style-migrations-integrated.log`. |
| Generated API contract | Passed. `.artifacts/contracts-check-completed.log`. |
| Frontend build and generated-client types | Passed. `.artifacts/integrated-session-build.log` and `typecheck-completed-integration.log`. |
| Browser-suite types | Passed. `.artifacts/e2e-typecheck-completed.log`. |
| Pinned skill integrity and report safety | 297 pinned files, four sources, 95 skill names verified. Report-safety tests passed. `.artifacts/skills-verify-integrated.log` and `report-safety-integrated.log`. |
| Integrated three-role journeys | Three tests passed, including employee setup. Real UI login/logout, account switch, advance return/edit/resubmit, both manager and HR approvals, and employee result reads. `.artifacts/browser/integrated-roles-20261018-1/`. |
| Operator recovery | Real HR login and confirmations, restore mock adapter, repeat original export, second attempt and saved receipt. `.artifacts/browser/operator-recovery-20261017-1.json`. |

The role test found a logout defect first. The server ended the session, but `QueryClient.clear()` removed the active session query without updating its existing observer. The shell retained the old identity. The focused profile/logout reproduction failed with `ASSERTION_FAILED`. The repair preserves the session query, cancels reads, removes other account data and clears mutation history before setting the new session value. The same browser test now passes and opens the manager profile without the employee name. Both failing runs remain under `.artifacts/browser/logout-red-20261017-1/` and `integrated-requests-20261017-1/`.

The operator run used the preceding immutable frontend build. Later source edits adjust copy, invalid-view fallback, title metadata and technical receipt disclosure. Its result is reused only for the unchanged command flow. The rebuilt source-state page has the correct `Передача и источники · JanaMen` browser title. Complete visual acceptance is still open.

The main assumption is that synthetic integrations and extractive policy answers meet the brief. The material remaining risk is integrated role/state behavior outside the verified request paths. Author checks of Academy in an isolated SQLite feature entry are retained in [journeys-author.md](journeys-author.md); they are not final Docker or independent review evidence. Full layout, keyboard, zoom, source revocation, integrated learning, public demo and defense packaging remain open. No real 1C, Documentolog, payment, signature or generative-provider result is claimed.

Pstack's Sequence Verifiable Units rule separates source checkpoints from acceptance. Model the Domain keeps approval, delivery and source accounting independent. Fstack and the original Emil/Jakub skills retain native links and controls, stable pending labels, visible errors and reduced-motion behavior. SureForge keeps the coverage denominator and required independent review open. Research and authors ran on `codex/gpt-6.1-sol`; the earlier `claudeAgent/claude-opus-5-5` plan reviewer hit its rate limit before inspecting anything. This checkpoint has no independent release verdict.

## Integrated Academy continuation

`.artifacts/browser/academy-integrated-20261018-5/` passed the real HR create/publish/assign flow and employee prerequisite, lesson completion, failed assessment, passed assessment and archived-history checks. Scores were exactly `0.00%` and `100.00%`. Both earlier attempts remain visible after course archive. The course form retains generated internal identities and asks the author to edit material and question content.

Run 1 failed on an over-specific test locator for the course-code label. Run 2 expected a heading where publication uses a summary. Run 3 found a real lifecycle defect. Invalidation fetched completed enrollment state and unmounted the quiz form before its per-call mutation success handler could navigate to the saved attempt. The repair owns the mutation in `QuizPage`, which survives that form change. Run 4 reached the saved successful attempt but failed an incorrectly formatted expected score. Run 5 verifies the repaired complete path. All failed reports remain unchanged. The callback behavior is documented by [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/mutations). The repair does not alter the API, server score, retry identity or global command ordering.

## HR publication and revocation

`.artifacts/browser/knowledge-loop-20261018-1/` passed the complete loop through the actual employee and HR forms. The question about night taxi had no published basis. HR created and published a visibly synthetic rule, linked its immutable revision to the case, and closed the case. The employee opened that source and asked again. The new extractive answer cited the published rule. HR archived it. Fresh case-source and citation reads then withheld the rule text, and the prior answer displayed that its basis was unavailable. Case resolution is not model training.

The case command now carries the target ID together with its version and response inside the retry intent. The transport strips that ID from the strict request body and uses it in the generated path. Failed or changed-target commands cannot share the same intent fingerprint.

## Container browser checkpoint

The clean `janamen-ci` stack passed all eight browser tests with PostgreSQL, the worker and the built nginx frontend. This includes both request paths, account switch, Academy publication and assessment history, the HR publication loop, source revocation, and the presentation of a replayed 429 response. The run is `.artifacts/browser-container-run-ci-20261018-1.log` with traces in `.artifacts/browser/ci/results/`. The 429 replay proves UI copy only. The backend test independently checks actual throttling at its unchanged default of ten attempts per minute. Browser fixtures explicitly raise their own login limit to accommodate repeated role changes. The current PostgreSQL suite passed 231 tests in `.artifacts/postgresql-browser-fixture-20261018-1.log`.

API replacement exposed a real proxy defect. nginx retained the old API address after Docker assigned a new one, so direct readiness returned 200 while web readiness returned 502. The observed failure is `.artifacts/nginx-dns-observed-red-20261018.json`. nginx now resolves the API through Docker DNS with a shared upstream zone. Its health check reaches API readiness through the proxy.

`scripts/verification/nginx_replacement.py` replaces only the selected synthetic stack's stateless API, holds its old address and checks recovery. `.artifacts/nginx-api-replacement-green-ci-20261018-1.json` records different old and new API addresses, successful proxied readiness and identical frontend container identity and start time. This proves recovery without restarting nginx. Earlier fixture errors are retained separately and are not behavioral reproductions. The regression check and browser container run are now CI steps. Full visual acceptance and independent release review remain open.

GitHub run [39065129872](https://github.com/Yerlan110110/Jana/actions/runs/39065129872) passed the source job but failed the new container regression fixture. Its Docker daemon requires a user-configured subnet for the static reservation. The failure was in `hold_old_address`, before the browser suite. `compose.ci.yaml` now supplies a separate configurable test subnet; normal application networking keeps Docker defaults. [Docker's IPAM reference](https://docs.docker.com/reference/compose-file/networks/#ipam) and [Compose environment reference](https://docs.docker.com/compose/how-tos/environment-variables/envvars/#compose_file) document this configuration.

The complete local CI chain then passed 231 PostgreSQL tests, release startup, API replacement and eight browser tests with that explicit network. Evidence is `.artifacts/ci-postgresql-explicit-network-20261018-1.log`, `nginx-api-replacement-ci-explicit-network-20261018-1.json` and `ci-browser-explicit-network-20261018-1.log`. The previous browser artifacts were retained at `.artifacts/browser/ci-first-container-20261018-1/` before the new run wrote `.artifacts/browser/ci/`. This is local reproduction of the revised workflow; the next GitHub run remains a separate check.

GitHub run [39066151009](https://github.com/Yerlan110110/Jana/actions/runs/39066151009) passed application checks, including the browser suite, but failed artifact upload. The broad trace glob traversed the root-owned private `sessions` directory. The upload now starts under `results` and selects only `trace.md`. Private session permissions stay intact. Host-side reading of the eight existing scoped trace files succeeded; actual GitHub upload still needs the next run.

## Transport recovery and role boundaries

The expanded container suite passed 14 tests in `.artifacts/ci-browser-recovery-scope-20261018-1.log`. Its reports are `.artifacts/browser/ci/recovery-scope-20261018-1/results/`. The focused recovery run also passed at `.artifacts/browser/request-recovery-20261018-1/`.

The recovery test forwards the actual browser create command to the API, confirms the server's 201 response, then drops that response before the browser receives it. The form retains the amount and reason. Its explicit retry sends the same body and key, opens the original ID and leaves exactly one matching server record. A second authenticated API writer advances the version. The open form receives 409, retains its local reason, explicitly refreshes the version and saves. Reload and a fresh API read confirm the reason and version. This is one browser plus a real second API writer, not a claimed two-tab interaction.

The scope test checks both list payload and direct reads. A manager cannot read the known other-team or other-entity people and requests. HR can read the same other-team records but cannot read the other entity. The foreign employee then opens their own known record, proving that the earlier 404 was an access boundary. Switching back to the primary employee clears the prior identity and data. Separate UI checks show that manager and HR cannot approve their own pending requests. Backend permission tests remain the server-command evidence.

The first scope run used a response waiter before opening its page and failed in the fixture. The second run passed scope checks but invalidated a saved manager session through logout, so the later test correctly received 401. Identity-changing tests now sign into their own session instead of consuming a shared saved session. `.artifacts/browser/scope-20261018-3/` passed all seven selected scope and session checks. These fixture failures are retained and are not reported as product defects.

The generated client's type-only relative imports now use explicit `.js` specifiers. This mechanical ESM correction keeps NodeNext checks strict and lets the actual browser fixture reuse the existing API client. No second API contract or relaxed compiler setting was added. Test Behavior, Not Implementation selected real server commits and fresh reads as the oracles. Make Operations Idempotent selected the retained key, original record identity and single creation event as evidence.

The repeated container run at `.artifacts/browser/ci/recovery-scope-20261018-2/` also passed all 14 tests. It used `--no-deps` to attach to the already verified app without rerunning release or recreating services. Its retry assertion compares JSON values rather than property order. API and worker source manifests each matched all 166 checkout Python files in `.artifacts/ci-runtime-source-identity-20261018-1.json`.
