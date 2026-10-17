# Native browser zoom checkpoint

18 October 2026. This verifies the zoom and capture method against the synthetic Docker application. It does not complete visual or state acceptance.

`scripts/verification/native_zoom.py` starts an owned Chrome for Testing 156.0.8078.4 profile. It writes that profile's native default zoom preference before launch. The existing e2e engine connects through its supported CDP option with `viewport: null`. No CSS zoom, device-scale override or pinch emulation supplies the result. The launcher closes its exact Chrome process in `finally` and records the browser and test exit codes separately.

The first-party [Chromium zoom implementation](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc) explains the preference key. This source is current main, not a claimed source match for the installed binary. Actual runtime measurements calibrate the binary. [Chromium's coordinate guide](https://www.chromium.org/developers/design-documents/blink-coordinate-spaces/) distinguishes browser zoom, pinch scale and CSS coordinates.

At 100%, the owned 1280px window reports `devicePixelRatio=1`, `innerWidth=1280`, `outerWidth=1280`, visual scale 1 and root CSS zoom 1. At 200%, it reports `devicePixelRatio=2`, `innerWidth=640`, `outerWidth=1280`, visual scale 1 and root CSS zoom 1. The body font remains 15 CSS pixels. Inventory tests assert these conditions on every view before accepting a cell.

## Capture defect and repair

Opening the original e2e screenshots revealed clipped top segments and empty lower segments at native 200%. DOM and zoom assertions had passed. Those images do not establish visual coverage. Failed capture evidence remains in `.artifacts/browser/native-zoom-inventory-2-20261018/` and `.artifacts/visual/inventory-1792274857308-S01/`.

The installed Playwright screenshot implementation constructs an explicit clip from layout metrics. A bounded experiment on the same scrolled login page found that the official [Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot) command without a clip captures the actual viewport. Both `fromSurface` variants produced the complete lower login region. These images were opened at `.artifacts/visual/native-capture-1792275286387/`. The username, empty password field, sign-in action and synthetic-data notice are readable.

`tests/zoom/capture.ts` uses that one command for native inventory images. All navigation, authentication and assertions still use the installed e2e engine. It requires the owned loopback debugger, exactly one matching page, no populated password field, a PNG and dimensions covering the actual native viewport. It neither connects to the user's Chrome nor captures Secret-filled functional sessions. Native images retain physical pixels. Ordinary viewport tests retain the existing masked screenshot path.

The capture loop uses the actual visual viewport height. At this zoom it can be 328.5 CSS pixels while `innerHeight` rounds to 328. Using the rounded value repeated the final scroll position and correctly failed the exclusive file write. That failed run is retained at `.artifacts/native-zoom-capture-20261018-3.log`.

## Evidence and limits

The final negative control is `.artifacts/native-zoom-control-20261018-final.log`. At 100%, all four inventory groups fail their required 200% assertion. This is an expected verification control, not a product defect. The final positive run is `.artifacts/native-zoom-20261018-final.log`, with nine passed tests, 31 cell records and 309 overlapping native images. Its capture records, images and e2e report are together under `.artifacts/browser/native-zoom-20261018-final/`. The paired test results and stopped-process records are `.artifacts/native-zoom-calibration-final.json`.

The final bottom images of S01, S18 and S31 were opened. They respectively show the complete sign-in action, assessment submission action and operator pagination. This verifies selected images after the repair, not all 309. The old empty captures remain invalid for visual acceptance.

The current normal-width capture also waits for the real loaded heading, no loading indicators, no error alerts and loaded fonts. `.artifacts/inventory-settled-20261018-2.log` passes seven tests covering the 31 views at five widths. This guards against counting a heading above a failed API load as a normal state. It does not prove every internal control fits.

Automated zoom, document-width and axe checks cover the selected normal state of each view. Full inspection of every saved image, other reachable states, keyboard behavior, reduced motion, other engines and physical devices remain separate. Raw axe findings and manually adjudicated brand findings remain retained. No complete WCAG conformance claim follows.

The fresh unchanged-business PostgreSQL suite passes 231 tests with 192 retained warnings at `.artifacts/native-zoom-postgresql-20261018-1.log`. Contract generation, both type checks, frontend build, pinned skills, report safety, backend style and migration checks pass in the `native-zoom-*` logs. Both GitHub jobs on the preceding application checkpoint `8abc4f5` pass at https://github.com/Yerlan110110/Jana/actions/runs/39072604583. That CI run predates the zoom tooling and is not its remote verification.

Build the Lever changed the verification mechanism into a repeatable launcher. Prove It Works required the 100% negative control and opening actual images, which exposed the capture defect. Boundary Discipline limits the raw screenshot command to its owned browser and rejects populated password fields. This is source inspection and protocol calibration, not a claimed REA run.
