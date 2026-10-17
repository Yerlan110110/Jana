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
