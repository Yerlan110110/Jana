# Codex tools for JanaMen

JanaMen keeps the requested engineering and interface skills in the repository. Codex discovers `.agents/skills` when it opens this project. Read the [setup guide](codex-setup.md) for the separate REA runtime.

## Installed sources

| Package | Source | Pinned identity | Installed skills |
| --- | --- | --- | ---: |
| Pstack Codex port | [Michael Denyer](https://github.com/michael-denyer/pstack-claude) | `7bad1ebc26faa268806bfbb84e5af55d178b68e4` | 63 |
| Emil Kowalski | [Original author repository](https://github.com/emilkowalski/skills) | `2d228630ba1446365f614a108cb8252f1feda202` | 15 |
| Jakub Krehel | [Original author repository](https://github.com/jakubkrehel/skills) | `4c66b1fa86e9ab70187b43d7da9b6fdb29f2ef63` | 14 |
| REA | [morluto/rea](https://github.com/morluto/rea) | npm `rea-agents@6.5.0`, integrity in lock | 1 |
| JanaMen Fstack | This repository | Tracked with the application commit | 1 |

The original 93 skill directories are copied without content changes. Their local references remain intact. The complete [skill inventory](skill-inventory.md) includes all 29 skills in the two author repositories at the pinned revisions, including platform-specific skills.

Fstack is this project's name for the combined interface workflow. The additional `fstack` skill routes to the original authors' instructions. It is a JanaMen wrapper, with no claim of author endorsement or an official Fstack release.

## Why the Pstack port

[Lauren Tan's original Pstack](https://github.com/cursor/plugins/tree/main/pstack) uses Cursor agent types, controls, rules, and automation conventions. Those conventions do not all run in Codex.

Michael Denyer's port includes an explicit [Codex tool mapping](../../.agents/skills/poteto-mode/references/codex-tools.md). It preserves the engineering workflows and translates their runtime operations. The port is a community adaptation. It is not an OpenAI or Cursor release for Codex.

The port declares its [policy changes](https://github.com/michael-denyer/pstack-claude/blob/7bad1ebc26faa268806bfbb84e5af55d178b68e4/tools/forks.json) and imported upstream revisions. [sources.lock.json](sources.lock.json) records those identities. The original, port, imported Cursor components, and design skill licenses remain in [licenses](licenses).

This repository uses the port's documented skills-only mode. The root `AGENTS.md` supplies the mandatory routing instruction. No user-level plugin hooks or global configuration were installed. Optional Pstack scripts that require Bun, `gh`, or another service remain separate from the application runtime.

## What is enforced

The root instructions require agents to read Pstack before nontrivial work and Fstack before interface research, specifications, or implementation. The [instruction block](agent-instructions.md) states the workflow and evidence rules.

`node scripts/tooling/verify-skills.mjs` checks source hashes, required skill directories, and duplicate names. It does not prove that a model followed a skill. [skill-use.md](skill-use.md) records the skills used during this implementation and the resulting decisions.

## REA boundary

REA's own skill directs complete-source architecture research to ordinary repository tools. Use REA for shipped JavaScript, packages, or runtime observations that source inspection alone cannot establish. Read [research-method.md](research-method.md) before recording competitor findings.

The pinned CLI and standalone MCP startup have been executed. The MCP startup check observed 207 tools and 6 prompts, with matching catalog identities. The restricted executor first closed the subprocess transport. The same check passed in the approved local execution context. This is a standalone server check, not proof that this ChatGPT session automatically loaded a new MCP server.

## Primary documentation

- [Codex skill discovery and explicit invocation](https://learn.chatgpt.com/docs/build-skills).
- [Codex project MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
- [REA installation and project scope](https://github.com/morluto/rea/blob/main/docs/installation.md).
- [REA browser evidence](https://github.com/morluto/rea/blob/main/docs/browser-observation.md).

The local identities and verification records describe the state checked on 17 October 2026. Future upstream changes require a reviewed lock update.
