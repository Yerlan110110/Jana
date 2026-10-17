import base from "./e2e.config.js";

export default {
  ...base,
  projectId: "janamen-operator",
  tests: ["tests/operator/**/*.e2e.ts"],
};
