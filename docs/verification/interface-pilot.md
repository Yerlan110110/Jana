# Entry-view interface pilot

18 October 2026. This check covers the loaded employee home, profile and new advance form at 1280×800 and 320×800 in Chromium. It does not establish complete page, state, keyboard, screen-reader, zoom or 31-view acceptance.

Fstack routed the work through the original Emil design-engineering skill and Jakub's accessibility and color skills. The inspected conventions are `AGENTS.md`, `docs/design/`, the existing Jana theme and the licensed Pace components. Fix Root Causes changes the shared input token and the consumer adapter. Sequence Work into Verifiable Units retains each failure before its repair.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `frontend/src/themes/jana.css`, light `--input` | The advance amount boundary measures 1.3444:1 on its solid background. | Increase the existing input-role ink opacity from 14% to 50%. All three enabled input/textarea boundaries pass the browser's 3:1 assertion. | WCAG 1.4.11. The white fields need a visible boundary. Separators keep their separate token. |
| HIGH | Accessibility | `frontend/src/application.css`, Pace textarea consumer adapter | Pointer hover replaces the repaired boundary with 20% ink. The measured ratio is 1.5413:1. | Preserve the input-role border on hover, behind the existing fine-pointer media condition. The settled hover passes 3:1. | Fix the reachable state while preserving the pinned upstream component. |
| HIGH | Accessibility | `frontend/src/application.css`, next-step eyebrow | `#557b48` on `#eff7eb` measures 4.44:1 in axe. | Reuse `--foreground`. Both rendered widths pass the text-contrast rule. | WCAG 1.4.3 requires 4.5:1 for this small text. |

The raw failures are `.artifacts/input-boundary-red-20261018-1.log`, `.artifacts/input-hover-red-20261018-1.log` and `.artifacts/input-boundary-green-20261018-1.log`. The latter passed the boundary check but found the next-step caption after the readiness check was corrected. An earlier capture could observe the loading layout and is not counted as loaded-home acceptance.

The repaired run is `.artifacts/input-boundary-green-20261018-2.log`, run `01a14bb1-b9c4-70f0-a272-382db1b2663d`. It passed four tests including session setup. Raw audit observations are `.artifacts/visual/audit-pilot-1792271306313.json`. The six saved viewport screenshots under `.artifacts/browser/input-boundary-green-20261018-2/results/` were opened individually. None has document-width overflow. Content extends below the viewport, so these images do not establish complete below-fold inspection.

## Manual adjudication retained in the audit

Axe 4.14.0 reports `label-content-name-mismatch` on the brand link in all six captures. The visible wordmark is JanaMen. Its accessible name is `JanaMen, главная`. A separate decorative J monogram is `aria-hidden="true"`. Chrome's accessibility tree exposes the intended link name.

The [W3C explanation of 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html#symbolic-text-characters) distinguishes symbolic characters from a spoken label. The coordinator interprets this monogram as a symbol. This is a manual interpretation, not an explicit W3C logo ruling or an independent accessibility verdict. The test accepts only this exact link, wordmark and hidden monogram combination. It retains the raw finding and fails other unmatched nodes. It also positively checks that one visible link has the intended name.

The three narrow captures retain an incomplete `color-contrast` result for the monogram. Logos have a contrast exception, but the incomplete raw result remains recorded. No report claims zero raw axe findings or formal WCAG conformance. A real screen-reader and speech-input run remain unverified.

The home caption now says `Заявку нужно исправить`. Its link opens the actual returned request. This is a wording repair, not a new server capability.

Verdict is Approve for the measured repaired pairs and the six inspected viewport regions. Full interface acceptance remains open in `continuation-coverage.csv`.

The later inventory baseline separately found the login's desktop caption at 4.22:1, `#66795e` on `#edf5e9`. Reusing `--muted-foreground` repairs that pair. The S01 audit passes in `.artifacts/browser/inventory-green-20261018-1/`, and its desktop screenshot was opened. The password rectangle is the runner's redaction, not the application's paint.

## Separate manual two-tab check

Two actual Chrome tabs also exercised stale-write recovery on request `132134d4-297a-40a8-8a3d-746b17e4f83d`. The first retained a local edit based on version 1 while the second saved version 2. The first displayed a conflict, kept its fields, refreshed explicitly and saved version 3. A fresh read in both tabs showed the same correction and history versions 1, 2 and 3. The observation note is `.artifacts/manual-two-tabs-20261018.json`. Native screenshots were displayed inline without a durable file path. This manual observation and the separately retained automated HTTP 409 trace are distinct evidence.
