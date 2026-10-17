# Interface inventory checkpoint

18 October 2026. This is automated normal-state coverage, not complete interface acceptance. The required state, keyboard, zoom and reduced-motion rows remain open in `continuation-coverage.csv`.

## Repaired direct-entry defect

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility and layout | `frontend/src/index.css`; former feature imports of `journeys.css` | The router imports Academy's learner and authoring modules directly. Their old aggregate module owned the shared stylesheet, so a direct Academy entry missed it. Course metadata and outline links ran together. Axe measured outline links only 19px high with insufficient separation. | Import the existing shared stylesheet once from the global CSS entry. Remove the eight feature-level imports. Direct course, lesson, assessment and authoring entries now receive the same styles. | Fix Root Causes changes style ownership rather than patching one small link. The existing stylesheet already provides the intended spacing and controls. |

The failed captures are `.artifacts/browser/inventory-baseline-20261018-1/` and `.artifacts/browser/inventory-employee-baseline-20261018-2/`. The first also found the login caption contrast recorded in `interface-pilot.md`. Its employee run stopped at an ambiguous course-title locator. The repaired locator waits for the loaded `О курсе` section rather than either repeated title. This was a fixture error, not a product defect.

The two-width repair run is `.artifacts/browser/inventory-green-20261018-1/`, with ten passed tests including setup and the pilot. The direct lesson's top and middle screenshots and the assessment's top and bottom screenshots were opened. The lesson now has separate metadata, a usable outline and capped reading text. This is selected visual inspection, not inspection of every saved image.

## Five-width automated coverage

After the action-label repair below, `.artifacts/browser/action-wrap-matrix-20261018-1/` passes eleven tests, including three role setups, four inventory tests and the focused action and contrast checks. It exercises all 31 specified views at 1280, 1440, 768, 390 and 320 pixels. There are 155 recorded view/width cells and 585 overlapping viewport screenshots. These are capture counts, not 155 separate tests or 585 inspected images. The earlier seven-test checkpoint remains at `.artifacts/browser/inventory-five-widths-20261018-1/`.

Current raw output is `.artifacts/action-wrap-matrix-20261018-1.log`. Cell records are in these directories.

- `.artifacts/visual/inventory-1792272709620-S01`
- `.artifacts/visual/inventory-1792272711016-S02`
- `.artifacts/visual/inventory-1792272773913-S09`
- `.artifacts/visual/inventory-1792272789412-S25`

Every cell waits for its real loaded landmark, no loading indicators and loaded fonts. The manifest selects actual permitted requests, employees, enrollments and publication identities through the generated API. It refuses missing prerequisites or a catalog below 30 courses. Only two ordinary assistant questions create new fixture records. It does not invent learner state, scores, permissions or request transitions.

All 155 cells pass the document-width assertion and have no unresolved automated violations after the narrowly checked symbolic-brand adjudication. All 155 retain that raw name finding. Ninety cells retain an incomplete contrast result for the decorative mobile monogram. One additional node concerns the narrow lesson material. The assessment label's previous incomplete finding led to the actual clipping defect below. A passing automated assertion does not resolve an incomplete finding. See `interface-pilot.md` for the brand interpretation and its limits.

## Narrow action and manual contrast adjudication

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Typography and layout | `frontend/src/application.css`, shared action wrapper | The upstream button's fixed height and no-wrap text carry into long JanaMen action labels. At 320px, the assessment label starts at x=31 while its content area starts at x=45. The rounded control clips both ends. | Let the existing wrapper grow, constrain it to its container and wrap its label. Keep a 36px minimum. Remove the narrower suggested-question-only workaround. The complete label now occupies two lines inside its content box. | A real label must remain readable. Fix the shared adapter rather than shortening one meaningful action. |

Native Chrome inspection found the clipped control. The focused regression then failed at `.artifacts/browser/action-wrap-red-20261018-1/`. It passes at `.artifacts/browser/action-wrap-green-20261018-1/`. The repaired screenshot was opened. Its label bounds x=45–275 and y=596.28–636.28 exactly match the available content box. The test opens a real eligible assessment but does not submit answers.

The remaining material node was also inspected in native Chrome at 320px. Computed text is `rgb(18, 21, 26)` on its actual white card, at 16px with 26.4px line height. The measured pair is 18.2942:1. All five S16-320 segments in the current matrix, from offset 0 through 2343, were opened. They cover the material, its next action and the result-history area with overlap. The text remains readable as the page scrolls. This manually resolves that contrast uncertainty for this material state. The raw incomplete node remains retained; no claim of zero raw findings or screen-reader acceptance follows.

The scope includes one selected state per view. S17 and S18 use different real enrollment prerequisites on the same assessment route. It does not cover every request status or every loading, empty, error, pending and denied state. The document-width assertion does not prove that no internal element clips. The 585 saved screenshots still require their applicable visual inspection.

## Build and regression evidence

`scripts/verification/web_build.py` compared all 30 files in the current local compiled frontend with the running nginx build. Every SHA-256 matched. The record is `.artifacts/action-wrap-web-build-identity-20261018-1.json`. Deliberately incorrect content and a missing HTTP asset both return 1. A missing local index returns 2. Controls are retained in `.artifacts/verification-fixtures/web-build-20261018-1/controls.json`.

The current full Docker role suite passes 14 tests at `.artifacts/ci-browser-action-wrap-20261018-1.log`. This includes the extracted shared session-client helper. The proxy replacement check passed at `.artifacts/nginx-interface-pilot-20261018-1.json` on the preceding immutable frontend container. It is retained as regression evidence for unchanged nginx configuration, not a replacement performed on the current container. Contract generation, frontend and test types, build, pinned skills and report-safety checks pass in the `action-wrap-*` logs. Backend style and migration checks pass in `.artifacts/thread-cleanup-backend-checks-20261018-1.log`.

The initial PostgreSQL checkpoint passed 231 tests with a teardown-session warning. The complete strict run then reproduced that failure. [Test-thread cleanup](test-thread-cleanup.md) records the fixture repair and its fresh full result, 231 passed with 192 retained warnings and no teardown error. This does not establish a production connection leak or change business commands.

The [native zoom checkpoint](native-zoom.md) records actual 200% browser zoom and the repair of a screenshot-coordinate defect. Its selected normal-state coverage is separate from complete visual inspection.

Verdict is REPAIR for complete interface acceptance. Normal-state automated coverage and the narrow-action repair are recorded. Full visual inspection, reachable states, keyboard, reduced motion and independent review remain open.
