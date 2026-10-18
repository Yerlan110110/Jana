import base from "./e2e.zoom-probe.config.js";

export default {
  ...base,
  projectId: "janamen-capture-regions",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/capture/regions.e2e.ts"],
};
