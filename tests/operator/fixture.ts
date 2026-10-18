import { execFileSync } from "node:child_process";

export function compose(...args: string[]) {
  return execFileSync("docker", ["compose", "-p", "janamen-ci", ...args], {
    encoding: "utf8",
    env: { ...process.env, COMPOSE_FILE: "compose.yaml:compose.ci.yaml", API_PORT: "8010", FRONTEND_PORT: "8090", LOGIN_THROTTLE_RATE: "120/min" },
    stdio: "pipe",
    timeout: 30_000,
  }).trim();
}
