import { web } from "@e2e-dev/web";
import base from "./e2e.config.js";

const endpoint = process.env.JANAMEN_ZOOM_CDP;
if (!endpoint) throw new Error("An owned zoom-probe Chrome endpoint is required");

export default {
  ...base,
  projectId: "janamen-zoom-probe",
  tests: ["tests/zoom/probe.e2e.ts", "tests/zoom/capture.e2e.ts"],
  targets: [{
    name: "chromium-native-zoom",
    engine: web({ viewport: null, connect: { cdpEndpoint: () => endpoint } }),
    app: base.targets[0].app,
  }],
};
