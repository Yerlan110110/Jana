# Component coverage — JanaMen run 2026-10-17-janamen

Every UI element the shipped product actually uses, with its real provenance
(from imports and `package.json`, not from looks). Kit version: Pace **4.0.3**
@ `4c5d2d2` (see SESSION.md for the 4.1.5 pin discrepancy, PF-001).

Coverage honesty: this is the *product's* element list, not the kit catalog.
Most of the kit was never exercised. "Checked" below means observed in the
shipped app / fix-commit evidence, not a formal per-state audit — the
hackathon did not fund that depth.

## Receipted Pace kit files still present and used

| Element | Implementation | Used on | States exercised | Theme adaptation | Linked events |
| --- | --- | --- | --- | --- | --- |
| Card | `components/pace/card.tsx` (Pace, 9 import sites) | workbench, requests, academy, knowledge, ops dashboards | default, interactive; translucent Crextio variant via app CSS | Token layer + heavy app CSS; no component edits | PF-004, PF-011 |
| NativeSelect | `components/pace/native-select.tsx` (8 sites) | request filters, forms | default, focus; narrow-width repaired in app | tokens + app CSS | PF-004 |
| Textarea | `components/pace/textarea.tsx` (7 sites) | AI Jana prompt, request forms, HR authoring | default, focus, long content | tokens + app CSS | PF-004 |
| cn util | `components/pace/cn.ts` (3 direct sites + all upstream wrappers) | everywhere via wrappers | n/a | n/a | PF-007 |
| Skeleton | `components/pace/skeleton.tsx` (1 site) | loading states | loading only | default | — |
| Empty | `components/pace/empty.tsx` (1 site) | empty list states | empty only | default | — |
| Dialog | `components/pace/dialog.tsx` | **unused — zero imports** | none | none | PF-009 |
| `styles/pace.css` token layer | imported at `src/index.css:4`, unmodified | global | all states ride on these tokens | the token layer itself was the adaptation surface | PF-004, PF-010 |

## Consumer-owned vendored components (NOT Pace kit)

| Element | Implementation | Provenance evidence | Used on | Notes |
| --- | --- | --- | --- | --- |
| Button | `src/components/upstream/button.tsx` | Base UI `Button` primitive + cva variants; `shadcn-LICENSE.md` in same dir; imports pace `cn` | all primary/secondary/ghost/destructive actions | Re-vendored after kit button deleted (PF-007). Contrast variants repaired in commits `95aa941`, `0b42954` |
| Input | `src/components/upstream/input.tsx` | same lineage | forms, auth | Same story as Button |

## Direct third-party primitives

| Element | Package | Used on | Notes |
| --- | --- | --- | --- |
| Toaster / toasts | `sonner@^2.0.7` | `main.tsx`, knowledge features | Kit toast removed during prune; sonner used directly (PF-008) |
| Icons | `lucide-react@^0.563` | 13 files | — |
| Base UI primitives | `@base-ui/react@^1.8` | upstream button/input | Radix deps were installed by first apply then removed in the safe deps step (`removed 74 packages`) |

## App-owned UI (no kit/primitive base)

Layout shell, pill navigation, striped decorative blocks, dark workflow card,
oversized numerals, cinematic brand intro, request timeline, academy
authoring tables, knowledge rehearsal panels — all custom CSS/TSX:
`application.css`, `crextio-layout.css`, `brand-intro.css`,
`interior-preview.css`, `themes/jana.css`, `features/journeys.css`.
This is where the product's visual identity actually lives; the kit supplied
the leaf controls and the token vocabulary underneath.

## Installed-then-removed kit items (never shipped, never tested)

From the safe apply receipt, deleted later by hand (PF-006): `button`,
`input`, `tabs`, `field`, `label`, `pagination`, `dropdown-menu`, `avatar`,
`breadcrumb`, `progress`, `sheet`, `toast`, `separator`, `springs`,
`motion-prefs`, `use-reduced-motion`, `sidebar`/`stat-card`/`table`/`command`/`kbd`/`grid`/`spacing`/`dashboard-shell`/`tooltip`/`input` never survived the first rollback at all.

## Verification coverage actually performed

- Two sequential brand themes shipped on the same components (green Jana →
  Crextio) — real adaptability evidence, but not the side-by-side Pace-theme
  vs brand A/B the experiment asked for. **Formal A/B: not run.**
- Dark theme: not applicable — product ships one light editorial theme.
- Narrow/mobile: edge-to-edge layout fix (`01a4512`) and narrow-controls fix
  (`8abc4f5`) — checked at app level, not per component.
- Keyboard/focus: nav-level fixes (`1ef839c`, `98352ec`) — verified for
  navigation paths; per-component keyboard audit not run.
- Reduced motion: `98352ec` keeps keyboard focus/reduced motion stationary;
  `use-reduced-motion` kit util was removed during prune.
- loading/empty/error/success: partially exercised via Skeleton/Empty/sonner;
  no systematic matrix.
