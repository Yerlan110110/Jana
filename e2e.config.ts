import { existsSync } from "node:fs";
import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

const envFile = process.env.JANAMEN_ENV_FILE ?? ".env";
if (process.env.JANAMEN_ENV_FILE && !existsSync(envFile)) throw new Error("The selected synthetic environment file does not exist");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default {
  projectId: "janamen",
  tests: "tests/web/**/*.e2e.ts",
  targets: [
    {
      name: "chromium",
      engine: web({
        viewport: { width: 1280, height: 800 },
        locale: "ru-KZ",
        timezoneId: "Asia/Almaty",
      }),
      app: {
        url: process.env.JANAMEN_WEB_URL ?? "http://127.0.0.1:8080",
        environment: "test",
      },
    },
  ],
  workers: 1,
  retries: 0,
  timeout: 120_000,
  assertionTimeout: 10_000,
  credentials: {
    employee: {
      username: "employee.demo",
      password: () => process.env.DEMO_PASSWORD ?? "",
    },
    manager: {
      username: "manager.demo",
      password: () => process.env.DEMO_PASSWORD ?? "",
    },
    hr: {
      username: "hr.demo",
      password: () => process.env.DEMO_PASSWORD ?? "",
    },
    foreign: {
      username: "foreign.demo",
      password: () => process.env.DEMO_PASSWORD ?? "",
    },
  },
} satisfies E2EConfig;
