import { existsSync } from "node:fs";
import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

if (existsSync(".env")) process.loadEnvFile(".env");

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
