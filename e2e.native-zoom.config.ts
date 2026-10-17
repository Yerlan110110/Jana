import base from "./e2e.zoom-probe.config.js";

export default {
  ...base,
  projectId: "janamen-native-zoom",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/visual/snapshots.e2e.ts", "tests/zoom/**/*.e2e.ts", "tests/keyboard/inventory.e2e.ts"],
};
