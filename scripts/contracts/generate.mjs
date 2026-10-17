import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const check = process.argv.includes("--check");
const temporary = check ? await mkdtemp(join(tmpdir(), "janamen-contracts-")) : null;
const schema = temporary ? join(temporary, "openapi.yaml") : join(root, "contracts/openapi.yaml");
const types = temporary ? join(temporary, "schema.d.ts") : join(root, "packages/api-client/src/schema.d.ts");

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

try {
  await mkdir(dirname(schema), { recursive: true });
  await mkdir(dirname(types), { recursive: true });
  run("uv", ["run", "--frozen", "python", "manage.py", "spectacular", "--file", schema, "--validate", "--fail-on-warn"], join(root, "backend"));
  run(process.execPath, [join(root, "node_modules/openapi-typescript/bin/cli.js"), schema, "--output", types]);
  if (check) {
    for (const [generated, tracked] of [
      [schema, join(root, "contracts/openapi.yaml")],
      [types, join(root, "packages/api-client/src/schema.d.ts")],
    ]) {
      const [actual, expected] = await Promise.all([readFile(generated), readFile(tracked)]);
      if (!actual.equals(expected)) throw new Error(`Stale API contract: ${tracked}. Run npm run contracts:generate.`);
    }
    console.log("OpenAPI and TypeScript contracts match the backend.");
  }
  run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "packages/api-client/tsconfig.json"]);
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
