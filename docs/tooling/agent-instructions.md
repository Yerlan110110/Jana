# Required Codex workflow

This block belongs in the root `AGENTS.md`. It applies only to JanaMen.

```text
Read .agents/skills/poteto-mode/SKILL.md and its references/codex-tools.md before nontrivial work. Read the actual leaf skills the selected playbook invokes. Use architect before changing module boundaries or shared contracts. Compare structurally distinct alternatives, record the chosen data shape, and verify observable behavior.

Read .agents/skills/fstack/SKILL.md for interface research, specifications, frontend work, and backend contract decisions that affect user-visible states. Use the original Emil Kowalski and Jakub Krehel skills it routes to. Record the skills read, the decisions changed, and the evidence. Installing skills is not proof of using them.

Keep the complete hackathon scope and quality bar. Do not shrink required course, request, organization, AI, or notification scenarios to save time. Keep authorization, realistic data, alternate states, and failure recovery in the contracts. Frontend design and implementation belong to the designated frontend agent.

The host's actual tools, permissions, and model parameters govern execution. Translate Pstack's examples to those tools. User authorization and higher-priority instructions govern external actions. Repo instructions do not authorize unrelated messages, global configuration changes, or deployments.

Use the parent model for ordinary delegated work unless the host and task authorize a different model. Full-history forks may not accept overrides. Independent reviewers must not author the change they review. Report reduced model diversity or unavailable review capacity honestly. Parallelize disjoint artifacts and serialize shared writes.

Run node scripts/tooling/verify-skills.mjs after tooling changes. Use the REA skill only for its actual artifact/runtime scope, retain evidence IDs, and separate observed facts from inferences. Do not claim active MCP discovery until /mcp or equivalent reports it in that session.
```

Project instructions make these workflows mandatory for the agent. Automated checks verify file integrity and application behavior. They cannot guarantee a language model's internal compliance.
