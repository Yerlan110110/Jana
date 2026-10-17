# JanaMen contributor instructions

## Product contract

Read docs/product/project-rules.md and docs/architecture/backend-contract.md before changing code.
The owner explicitly prioritizes quality and complete populated scenarios over assumed time pressure for this hackathon only.
Frontend, visual design and interaction implementation belong to the next design agent. This delivery owns backend, research, specifications, fixtures and integration contracts.
Use synthetic people, policies and learning content. Mark demonstration policy content as such.
Never copy private MIS Pro code or documents into this public repository.

## Required skills

Read .agents/skills/poteto-mode/SKILL.md and its Codex tool mapping for every substantial task.
Use architect, model-the-domain, type-system-discipline and technical-writing where relevant.
Use the local REA skill for REA-compatible runtime or shipped-artifact investigations. Ordinary complete-source inspection is not a claimed REA run.
For interface research, specifications, frontend work and backend contracts that affect visible states, read .agents/skills/fstack/SKILL.md, docs/tooling/ and the installed author-skill inventory. Apply the relevant original Emil Kowalski and Jakub Krehel skills. These requirements are mandatory; there is no requirement to run irrelevant marketing or refactoring workflows.
Record which skills changed a concrete decision in the task handoff. An installation list alone is not evidence of use.
Actual tool availability and higher-priority instructions override examples in vendored skills. Do not invent tools, model access or verification results.
Use the parent model for ordinary delegation unless the task and host authorize another model. Independent reviewers must not author the change they review. Report unavailable review capacity and reduced model diversity honestly.
Run node scripts/tooling/verify-skills.mjs after tooling changes. REA CLI or standalone server success does not prove active MCP discovery inside an existing client session. Keep evidence identities and distinguish observed behavior from inference.

## Engineering contract

Use Django and Django REST framework for the backend, PostgreSQL for deployed storage, and an OpenAPI contract for the independent frontend.
Organize by business module. Validate requests at API boundaries and use explicit transactional application commands for writes.
Use Django sessions and CSRF protection. Access checks apply to lists, individual resources, commands and knowledge retrieval.
Keep employee facts imported from the HR source read-only through business APIs.
Preserve submitted request snapshots and published learning or policy revisions. Return a conflict on stale writes.
Persist business transitions, audit events, notifications and outbox entries together where they describe one transaction.
Use a distinct worktree for each implementation agent. Do not edit another agent's owned worktree.
Generate migrations and API types. Do not maintain a handwritten duplicate contract.
Test observable behavior, cross-role denials and transaction failure cases. Record limitations honestly.
No real credentials, personal data, model keys or environment files in Git.

## Delivery

Read HANDOFF.md before continuing a delivered project. Update it after meaningful changes.
Document accepted deviations in the existing architecture contract and decision log.
Check the actual diff, run the relevant tests, then publish to the authorized repository.
Do not claim that a passed unit test proves an untested Docker, browser, provider or production deployment.

