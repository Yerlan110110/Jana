# Primary action contrast

18 October 2026. Scope is the employee home page's primary navigation actions, at rest and on pointer hover, at 1280×800 in Chromium. This is not the complete interface review.

Fstack routed this check through the original Emil design-engineering skill and Jakub's accessibility and color skills. The theme and installed Tailwind preflight already define the intended colors. The consumer stylesheet duplicated a link reset outside Tailwind's layers and overrode the component's foreground.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `frontend/src/application.css`, primary action links | Unlayered `a { color: inherit }` produces `#12151a` on `#007a00`, measured at 3.2963:1. | Remove the duplicate reset. The component supplies white text, measured at 5.55:1. | WCAG 1.4.3 requires 4.5:1 for normal control text. Fix Root Causes changes the shared rule. |
| HIGH | `frontend/src/application.css`, primary action hover | The inherited 80% fill produces `#319331` on the page background, measured at 3.9264:1 against white. | Reuse `--primary-deep` for pointer hover. White on `#006b00` measures 6.7675:1. | Preserve readable text throughout the control's reachable state. The existing semantic token avoids a new palette. |

The first browser failure is `.artifacts/browser/primary-link-red-20261018-1/`. It records the incorrect computed foreground. The separate hover failure is `.artifacts/browser/primary-hover-red-20261018-1/`; its screenshot supplies the composited fill. Both are retained.

The current numeric browser check is `tests/visual/pilot.e2e.ts`. It composites computed solid backgrounds through their ancestors, measures both color pairs and waits for the control's actual CSS animations before reading hover. `.artifacts/browser/primary-contrast-green-20261018-4/` passed both setup and the check. The sharp earlier rest screenshot was also opened and inspected. Visual setup uses the normal session API and documented cookie setup. It does not replace the functional suite's real form login.

Run 3 encountered a 502 while the separate API-replacement test deliberately stopped the API. That report remains retained and is not counted as a product regression. Sequential run 4 passed after replacement finished. Visual acceptance must run after stack mutations complete.

Verdict is Approve for these two color pairs only. Input boundaries, other text colors, keyboard behavior, mobile widths, zoom and the other screen states remain outside this check. Complete coverage remains open in the continuation ledger.
