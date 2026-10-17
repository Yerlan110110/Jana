# Use the JanaMen tools in Codex

## Install the pinned REA runtime

Use Node.js 22.19 or newer in the 22 series, 24.11 or newer in the 24 series, or 26 and later. This repository's verification used Node.js 24.19.0.

From the repository root, run:

```sh
npm ci --prefix scripts/tooling/rea-runtime --ignore-scripts --no-audit --no-fund
node scripts/tooling/rea.mjs --version
node scripts/tooling/verify-skills.mjs
node scripts/tooling/rea.mjs mcp doctor --json
```

The version command prints `6.5.0`. The integrity command verifies 297 pinned files and 94 unique skill names. The MCP doctor reports `healthy: true`, matching package and catalog identities, and a successful `binary_session` request.

The dependency install uses the committed lock. It disables package lifecycle scripts. Browser and static JavaScript analysis do not require a native decompiler. Native analysis engines are separate prerequisites and are not installed by these commands.

## Open Codex

Start Codex from the repository root:

```sh
codex
```

The committed `.codex/config.toml` registers the repo-local REA launcher. Its relative command path assumes this repository root as the launch directory. The project must be trusted by the user's Codex installation before project MCP configuration loads.

Use `/skills` to inspect discovered skills and `/mcp` to inspect the active REA connection. Codex can discover changed skills automatically. Restart it if a new skill or server does not appear. A successful CLI doctor cannot prove the connection state inside an already-running agent.

Example requests:

```text
Use $poteto-mode and $architect to implement this JanaMen backend change.
Use $fstack to prepare the Academy frontend from the design handoff and API contracts.
Use $reverse-engineer-anything to inspect this named public website artifact and keep the evidence limitations.
```

## Run REA directly

Use the CLI when the current client cannot load a new MCP server:

```sh
node scripts/tooling/rea.mjs capture-browser-scenario --schema
node scripts/tooling/rea.mjs capture-browser-scenario /absolute/path/to/scenario.json --json
node scripts/tooling/rea.mjs analyze-javascript-application /absolute/path/to/shipped-app --json
```

Read the actual command schema before constructing a scenario. Declare the browser executable, exact target, allowed origins, and actions. Keep the JSON output with the investigation record.

If the browser cannot navigate to a public source, retain that failure. A downloaded documentation mirror can establish facts about the captured artifact. Label its source and digest. It does not establish authenticated product behavior.

## Upgrade a source

Inspect its new skill instructions, scripts, licenses, and runtime mapping. Preserve the current source revision until that review finishes. Copy the complete selected skill folders with their references. Update the source lock, npm lock when applicable, and hashes. Run the integrity check, validate the changed workflow, and commit the update.

Do not run a floating remote installer to update this project. The repository keeps all source identities reviewable.
