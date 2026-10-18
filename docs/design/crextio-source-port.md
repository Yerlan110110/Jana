# Crextio source port

The owner's supplied archive is the design source: `crextio-rea-reverse-engineered.zip`, attachment ID `6b08c03e-891a-46bd-ab6f-6f12a9970f14-23ebf15b-85b7-418b-9204-c67e56a9ade9-zip`.

Its extracted `src/crextio_ui.html` contains ten screens. `design-system/` contains tokens and component blueprints. `assets/avatars-base64.json` contains the supplied images. Evidence files describe the 908 × 638 board, four 217px columns, 4px gaps and stacked task panel.

The owner explicitly rejected a palette-only reskin. The current change replaces the sidebar with top pill navigation and ports the dashboard's metric strip, work-day route, progress, circular indicator, next-action panel and lower two-column schedule. People uses the directory's column structure. Remaining pages inherit the board and navigation, with existing business forms retained.

## Content adaptations

All counters use the scoped workbench API. Bars use actual material progress per enrollment, not invented weekly activity. The circular indicator compares projected and official leave balances; it is not a time tracker. The schedule lists actual assignments and due dates. The owner rejected the portrait and decorative stacked layers. They are removed. The first card links to actual request creation, knowledge search and learning.

The desktop board expands to the available application viewport. Narrow layouts reflow instead of shrinking text to an unreadable scale. These are explicit functional adaptations from the fixed reference.

## Evidence

Coordinator screenshots at 1440px and 320px are retained in `.artifacts/verification/checkpoint-1545/crextio-structure-desktop.png` and `crextio-structure-mobile.png`. Both widths have no document horizontal overflow. These first captures precede removal of the duplicate legacy lower dashboard. No zero-difference pixel-parity claim is made. Secondary screen parity remains incomplete.

The source images were supplied by the owner but the portrait is no longer rendered. Existing project and dependency notices remain intact.

## Latest owner corrections

The accent is Jana Post green using existing verified brand tokens. Learning filters align controls at 44px with labels above. Only the programmatically focused main region loses its outline; interactive keyboard focus remains. Menu strokes morph into a close icon. Native router view transitions move the selected navigation pill, with reduced-motion and keyboard suppression. No animation library was added. Assistant examples populate the real question form; they do not fabricate saved answers.
