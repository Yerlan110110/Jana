import base from "./e2e.config.js";

export default {
  ...base,
  projectId: "janamen-public",
  tests: "tests/public/**/*.e2e.ts",
};
