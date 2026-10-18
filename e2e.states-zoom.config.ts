import base from "./e2e.zoom-probe.config.js";

export default {
  ...base,
  projectId: "janamen-repair-states-zoom",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/states/**/*.e2e.ts"],
};
