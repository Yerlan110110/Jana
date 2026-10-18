import base from "./e2e.config.js";

export default {
  ...base,
  projectId: "janamen-repair-states",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/states/**/*.e2e.ts"],
};
