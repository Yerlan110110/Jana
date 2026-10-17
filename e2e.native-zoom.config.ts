import base from "./e2e.zoom-probe.config.js";

export default {
  ...base,
  projectId: "janamen-native-zoom",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/zoom/**/*.e2e.ts"],
};
