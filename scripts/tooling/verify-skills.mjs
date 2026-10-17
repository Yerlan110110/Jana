#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..'));
const lock = JSON.parse(await readFile(join(root, 'docs/tooling/sources.lock.json'), 'utf8'));
const failures = [];
const names = new Set();
const expectedSkills = new Set(lock.sources.flatMap(source => source.skills));
for (const source of lock.sources) {
  for (const [path, expected] of Object.entries(source.files)) {
    try {
      const data = await readFile(join(root, path));
      const actual = createHash('sha256').update(data).digest('hex');
      if (actual !== expected) failures.push(`Changed file: ${path}`);
    } catch (error) {
      failures.push(`Unreadable file: ${path}: ${error.code ?? error.message}`);
    }
  }
}
const entries = await readdir(join(root, '.agents/skills'), { withFileTypes: true });
for (const entry of entries.filter(item => item.isDirectory())) {
  const path = join(root, '.agents/skills', entry.name, 'SKILL.md');
  const content = await readFile(path, 'utf8');
  const name = content.match(/^name:\s*["']?([^\n"']+)/m)?.[1]?.trim();
  const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) failures.push(`Missing skill metadata: ${entry.name}`);
  if (names.has(name)) failures.push(`Duplicate skill name: ${name}`);
  names.add(name);
  expectedSkills.delete(entry.name);
}
for (const name of expectedSkills) failures.push(`Missing skill directory: ${name}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  const files = lock.sources.reduce((sum, source) => sum + Object.keys(source.files).length, 0);
  console.log(`Verified ${files} pinned files, ${lock.sources.length} sources, and ${names.size} unique skill names.`);
}
