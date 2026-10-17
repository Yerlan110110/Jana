# Interface inventory checkpoint

18 October 2026. This is automated normal-state coverage, not complete interface acceptance. The required state, keyboard, zoom and reduced-motion rows remain open in `continuation-coverage.csv`.

## Repaired direct-entry defect

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility and layout | `frontend/src/index.css`; former feature imports of `journeys.css` | The router imports Academy's learner and authoring modules directly. Their old aggregate module owned the shared stylesheet, so a direct Academy entry missed it. Course metadata and outline links ran together. Axe measured outline links only 19px high with insufficient separation. | Import the existing shared stylesheet once from the global CSS entry. Remove the eight feature-level imports. Direct course, lesson, assessment and authoring entries now receive the same styles. | Fix Root Causes changes style ownership rather than patching one small link. The existing stylesheet already provides the intended spacing and controls. |

The failed captures are `.artifacts/browser/inventory-baseline-20261018-1/` and `.artifacts/browser/inventory-employee-baseline-20261018-2/`. The first also found the login caption contrast recorded in `interface-pilot.md`. Its employee run stopped at an ambiguous course-title locator. The repaired locator waits for the loaded `О курсе` section rather than either repeated title. This was a fixture error, not a product defect.

The two-width repair run is `.artifacts/browser/inventory-green-20261018-1/`, with ten passed tests including setup and the pilot. The direct lesson's top and middle screenshots and the assessment's top and bottom screenshots were opened. The lesson now has separate metadata, a usable outline and capped reading text. This is selected visual inspection, not inspection of every saved image.

## Five-width automated coverage

Run `01a14bba-c25a-72c6-a2ec-b38cbcc070ca` passed seven tests, including three role setups and four inventory tests. It exercised all 31 specified views at 1280, 1440, 768, 390 and 320 pixels. There are 155 recorded view/width cells and 585 overlapping viewport screenshots. These are capture counts, not 155 separate tests or 585 inspected images.

Raw output is `.artifacts/inventory-five-widths-20261018-1.log`. The browser report is `.artifacts/browser/inventory-five-widths-20261018-1/`. Cell records are in these directories.

- `.artifacts/visual/inventory-1792271895488-S01`
- `.artifacts/visual/inventory-1792271897036-S02`
- `.artifacts/visual/inventory-1792271966456-S09`
- `.artifacts/visual/inventory-1792271982929-S25`

Every cell waits for its real loaded landmark, no loading indicators and loaded fonts. The manifest selects actual permitted requests, employees, enrollments and publication identities through the generated API. It refuses missing prerequisites or a catalog below 30 courses. Only two ordinary assistant questions create new fixture records. It does not invent learner state, scores, permissions or request transitions.

All 155 cells pass the document-width assertion and have no unresolved automated violations after the narrowly checked symbolic-brand adjudication. All 155 retain that raw name finding. Ninety cells retain an incomplete contrast result. Ninety incomplete nodes concern the decorative mobile monogram; two additional nodes concern the narrow lesson material and assessment submit label being obscured at the audit's scroll position. Those two need explicit manual inspection and measurement. A passing automated assertion does not resolve an incomplete finding. See `interface-pilot.md` for the brand interpretation and its limits.

The scope includes one selected state per view. S17 and S18 use different real enrollment prerequisites on the same assessment route. It does not cover every request status or every loading, empty, error, pending and denied state. The document-width assertion does not prove that no internal element clips. The 585 saved screenshots still require their applicable visual inspection.

## Build and regression evidence

`scripts/verification/web_build.py` compared all 30 files in the local compiled frontend with the running nginx build. Every SHA-256 matched. The record is `.artifacts/inventory-web-build-identity-20261018-1.json`. Deliberately incorrect content and a missing HTTP asset both return 1. A missing local index returns 2. Controls are retained in `.artifacts/verification-fixtures/web-build-20261018-1/controls.json`.

The current full Docker role suite passes 14 tests at `.artifacts/ci-browser-interface-matrix-20261018-1.log`. This includes the extracted shared session-client helper. The proxy replacement check passes at `.artifacts/nginx-interface-pilot-20261018-1.json` without changing the frontend identity or start time. Contract generation, frontend and test types, build, pinned skills, report-safety checks, backend style and migration checks pass in the matching `interface-matrix-*` and `interface-pilot-backend-checks-*` logs.

The fresh PostgreSQL run passes 231 tests with 193 warnings at `.artifacts/interface-pilot-postgresql-20261018-1.log`. One warning says test-database teardown found two remaining sessions. The isolated four Academy concurrency tests pass with PytestWarning treated as an error, so that isolated attempt did not reproduce the teardown warning. Finding `PG-TEST-CLEANUP` remains under investigation. It is not evidence of a production database or business transition failure.

Verdict is REPAIR for complete interface acceptance. Normal-state automated coverage is recorded. Full visual inspection, reachable states, keyboard, real 200% zoom, reduced motion and independent review remain open.
