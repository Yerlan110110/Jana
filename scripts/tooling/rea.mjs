#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = new URL('./rea-runtime/node_modules/rea-agents/scripts/rea.mjs', import.meta.url);
if (!existsSync(entry)) {
  console.error('REA is not installed. Run npm ci --prefix scripts/tooling/rea-runtime --ignore-scripts --no-audit --no-fund from the repository root.');
  process.exit(1);
}
process.argv[1] = fileURLToPath(entry);
await import(entry.href);
