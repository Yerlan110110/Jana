import base from "./e2e.config.js";

export default {
  ...base,
  projectId: "janamen-keyboard",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/keyboard/**/*.e2e.ts"],
};
