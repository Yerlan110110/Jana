# Skills applied during foundation work

The tooling implementation read the original instructions below. These are recorded applications, not a claim that every installed skill ran.

| Skill | Decision affected | Evidence |
| --- | --- | --- |
| `poteto-mode` and its Codex mapping | Use the Codex port's explicit tool translation and keep routing in repo instructions. | `.agents/skills/poteto-mode/references/codex-tools.md`, `.codex/config.toml` |
| `architect` | Compare original Cursor-only integration with the Codex port before selecting the repository skill layout. | `README.md`, `sources.lock.json` in this directory |
| `principle-model-the-domain` | Represent upstream identities, source groups, skills, and file digests in one structured manifest. | `sources.lock.json` |
| `principle-boundary-discipline` | Keep tool dependencies outside application dependencies and validate installed source files at the boundary. | `scripts/tooling/rea-runtime/package-lock.json`, `scripts/tooling/verify-skills.mjs` |
| `principle-make-operations-idempotent` | Use a pinned npm lock and read-only verifier. Repeated verification leaves files unchanged. | `codex-setup.md`, verifier run |
| `principle-prove-it-works` | Execute the CLI and standalone MCP request flow. Keep the failed restricted run and successful approved run distinct. | `verification.json` |
| `technical-writing` and `unslop` | Separate setup instructions, source reference, and research explanation into short purpose-specific documents. | Documents in this directory |
| `pick-ui-library` | Route component decisions through the author's actual list and inspect existing dependencies before adding new ones. | `.agents/skills/fstack/SKILL.md` |
| `better-interface` | Require domain-specific evidence and mark uninspected states instead of treating a broad skill inventory as a design review. | `.agents/skills/fstack/SKILL.md`, frontend handoff |
| `reverse-engineer-anything` | Use ordinary tools for complete-source architecture, and retain REA evidence for the separate public artifact investigation. | `research-method.md`, design research artifacts |

The design research agent separately read Emil's design engineering, library selection, and UI stress skills; Jakub's complete six-domain interface review; and the reference explanation and component state skills. Its design handoff records the resulting requirements. The root implementation agent read Pstack architecture and domain principles before backend implementation.

## Backend and frontend-contract applications

| Applied workflow | Concrete effect |
| --- | --- |
| Pstack architect, domain modeling, type discipline | One transactional backend owns requests, course evidence and source-scoped knowledge; serializers generate the committed TypeScript contract. |
| Pstack how, prove-it-works, show-me-the-work | Verification uses actual PostgreSQL races and real session/CSRF HTTP journeys. Docker config, mocked provider transport and live provider calls retain separate gates. |
| Pstack swarm and review routing | Independent aggregates use separate worktrees. A later non-author reviewer inspects the merged implementation before delivery. Review findings and fixes belong to the verification report. |
| Fstack, Emil pick-ui-library | Base UI is selected for primitives, Sonner for toasts, conditional Motion/clsx/cva/Virtuoso for their actual tasks. Router/query/form choices are explicitly outside that curated list and have primary-source research. |
| Jakub state and interface principles | The workbench preserves separate notification, request, learning and knowledge states. It reuses domain serializers instead of fabricating a second generic task state machine. |
| REA evidence discipline | Failed Mon School live attempts are recorded with hashes as failures. The successful documentation replay is not described as authenticated product behavior. |
