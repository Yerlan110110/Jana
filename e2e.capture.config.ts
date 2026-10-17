import base from "./e2e.zoom-probe.config.js";

export default { ...base, projectId: "janamen-capture-calibration", tests: ["tests/capture/**/*.e2e.ts"] };
