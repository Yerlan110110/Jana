import base from "./e2e.config.js";

export default {
  ...base,
  projectId: "janamen-defense",
  tests: ["tests/visual/auth.setup.e2e.ts", "tests/public/screens.e2e.ts"],
};
