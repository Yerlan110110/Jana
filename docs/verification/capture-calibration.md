# Calibrate the screenshot observation

18 October 2026. The calibration distinguishes native browser zoom, ordinary viewport rendering, scroll completion and the image viewer's presentation. It is a diagnostic, not complete visual acceptance.

The installed versions are e2e 0.21.2, `@e2e-dev/web` 0.15.2 and Playwright 1.64.0. Playwright's own browser manifest specifies Chrome for Testing 156.0.8078.4, revision 1248, matching the binary used here. A browser/package mismatch is not established.

The ordinary license captures initially looked empty when repeated in the tool display. Direct PNG analysis refutes an empty-file diagnosis. The wide files each contain 30,088 non-white pixels. The narrow files each contain 28,282. Top and bottom are byte-identical at each width, recorded at `.artifacts/license-original-capture-hashes-20261018.json`. The test had not completed its keyboard scroll before capture. Its final version scrolls instantly to the actual document end and checks the final paragraph's bounds. See [packaging.md](packaging.md). No global replacement of ordinary capture is justified by that observation.

The earlier native-200% defect is different. The first six retained S02 screenshots in `.artifacts/browser/native-zoom-inventory-2-20261018/` are 640×328. Four of those lower captures contain zero non-white pixels. The native window's actual viewport is 1280 physical pixels wide. The existing clip-free CDP method addresses that reproduced native case. Ordinary image duplication does not validate those older native files.

`e2e.capture.config.ts` records ordinary and owned clip-free captures on the same legal page at 1280 and 320 pixels. It records geometry before and after capture because a native keyboard scroll can still be moving between observations. The generic helper is now named `captureOwnedViewport`. Its dimension check uses actual inner viewport, device pixel ratio and fractional visual height. This supports both the native-zoom inventory and explicitly emulated viewport calibration. Native-200% identity still has separate outer-width, DPR and zoom assertions. No legacy export alias remains.

Run the diagnostic through the existing owned-profile launcher.

```bash
JANAMEN_WEB_URL=http://127.0.0.1:8090 python3 scripts/verification/native_zoom.py \
  --chrome /home/yqecea/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
  --factor 1 --config e2e.capture.config.ts \
  --output .artifacts/browser/capture-calibration-<unique-run>
```

The final run at `.artifacts/license-capture-calibration-20261018-final-2.log` passes two tests. One records the capture comparison. The other populates a password field with a public synthetic canary and verifies that owned capture refuses and writes no PNG. The launcher records exit 0 and stopped Chrome. This helper is limited to the owned visual fixtures. It is not a way to bypass Secret-filled functional-session restrictions.

A temporary all-owned normal inventory was also exercised. It passes fourteen tests, 155 cells and 602 segments at `.artifacts/owned-normal-matrix-20261018-1.log`. The exact temporary harness source is retained at `.artifacts/probes/viewport-capture-20261018/`. The mandatory normal-path replacement was withdrawn after the PNG probe refuted its premise. The regular viewport runner remains in place and now asserts actual viewport width, DPR 1, root CSS zoom 1 and visual scale 1. The separate native run passes fourteen tests, 31 cells and 315 segments at `.artifacts/owned-native-matrix-20261018-1.log`.

These matrices bind to the forty-file application artifact at `.artifacts/packaging-build-identity-20261018.json`. They verify their recorded loaded states, geometry and audit assertions. Selected legal and native images were inspected. Full visual and reachable-state acceptance remains open.

Fix Root Causes and Prove It Works changed the observation before changing the application. The calibration retains the failed hypothesis and limits. Boundary Discipline restricts raw capture to its owned loopback browser and rejects populated password fields. This is protocol calibration and complete-source inspection, not a claimed REA run.

## Two incomplete repair images

The owner found a white strip in the S24 ordinary320 segment at offset1400 and an undrawn header in the first S08 native200 segment. Both original images remain excluded as complete rendering evidence. The repeat diagnostic is `e2e.regions.config.ts`, run through the same owned launcher at factors1 and2. Its two outputs are `.artifacts/browser/repair-capture-regions-factor1-20261018-1/` and `repair-capture-regions-factor2-20261018-1/`.

Each run compares an immediate capture with a capture after two animation frames. Each also compares the ordinary engine path with the owned visible-viewport path. At320, both immediate paths are byte-identical and both painted paths are byte-identical. All four owned images were opened at full size. The missing notifications region and native header are present in both phases. Header geometry reports visible, opacity1 and the expected64CSS-pixel height.

The old incomplete image remains a real capture failure. The cause did not reproduce in the fresh owned profiles. This result supports replacing those two observations with the new bounded region evidence. It does not establish a compositor root cause, justify an application delay or certify every earlier image. No rendering or capture implementation changed for this diagnostic.
