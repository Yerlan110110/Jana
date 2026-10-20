# Pace feedback HANDOFF — JanaMen run 2026-10-17-janamen

Final package for the Pace agent. Built retrospectively on 2026-10-20 from
receipts, Git history and surviving thread quotes; every event is marked
`"retrospective": true` in `events.jsonl`.

## 1. What was built, on which versions

JanaMen — Digital HR platform for the Jana Post × Terricon Valley hackathon
(Django/DRF/Postgres + React 19/Vite/TS). Live demo: https://jmhr.vercel.app,
repo `Yerlan110110/Jana`, last pushed commit `9ed64c7` (+ later `1a183b7`).

- Pace **kit 4.0.3** from local checkout `/home/yqecea/coding-projects/pace`
  @ `4c5d2d2077de1a2997d5d7bc8a79e69ae3656d32` (branch
  `codex/pace-cloud-handoff-20261011`).
- Owner had pinned **4.1.5 @ f510c134** — the pin was never actually used;
  all feedback binds to 4.0.3 (PF-001).
- Install path: `bin/pace.mjs` doctor → plan → apply → **rollback** → safe
  plan → apply → verify (`verified: true`). Receipts:
  `pace-15b5115e…` (rolled-back), `pace-c06be548…` (verified).
- Surviving kit files: `card`, `native-select`, `textarea`, `cn`, `skeleton`,
  `empty`, `dialog` (unused) + `styles/pace.css` token layer and notices.

## 2. Owner feedback (verbatim where available)

- «креативность - ключ к победе» — rejected the plain green recolor, supplied
  five Crextio-like references; whole product re-themed (PF-005).
- (paraphrase) Asked for "unusual direction", approved Crextio after Inspo
  search found nothing stronger for a working dashboard.
- Owner hand-edited the static concept `.artifacts/design-review/crextio-home.html`
  to tune column layout, profile card, ring size, spacing — direct
  evidence he drives pixel-level visual quality.
- No verbatim complaint about Pace itself; friction was at installer/docs
  level (below), not at component API level.

## 3. Agent observations

**Positive**

- Token layer adaptability is real: `styles/pace.css` imported untouched at
  `src/index.css:4`; two successive brand themes (green Jana →
  graphite/paper/solar Crextio) shipped without editing a single kit file
  (PF-004, PF-011).
- Kit leaf components (Card, NativeSelect, Textarea, Skeleton, Empty)
  survived an aggressive editorial restyle — structural soundness confirmed.
- Receipts/hashes made provenance auditable months later — this whole
  retrospective was possible only because receipts exist (PF-002 evidence).

**Friction / time losses**

- First apply had to be rolled back; a second "safe" cycle was needed, incl.
  uninstalling 74 packages. Likely license-gating of oxygen-licensed files —
  hypothesis, not confirmed (PF-002).
- No supported prune: agents deleted ~15 unused kit files by hand, leaving
  receipts that claim files which no longer exist (PF-006).
- The two hottest controls (Button, Input) ended up consumer-vendored from
  Base UI/cva instead of the kit (PF-007); toasts went to sonner directly
  (PF-008); kit dialog installed but never imported (PF-009).
- Site↔kit drift discovered pre-install: site advertises 44 components/369
  registry/check-usage; kit 4.0.3 manifest has 21/20 and no such command
  (PF-003, confirmed).
- Custom palette required follow-up contrast repairs — destructive,
  primary hover, disclosure hit-area, focus (PF-010, fixed in app).

## 4. Coverage table

See `COMPONENTS.md`. Headline: 6 of 22 safely-applied items actually shipped
in product code; Button/Input/Toast — the most stateful controls — came from
non-kit sources; the formal Pace-theme vs brand-theme A/B was **not run**.

## 5. Confirmed defects (with reproduction)

- **PF-001 version reporting**: prompt pinned 4.1.5; every receipt says 4.0.3;
  `bin/pace.mjs` gives no warning. Repro: inspect `.artifacts/pace-apply.json`
  `version` field vs requested pin.
- **PF-003 site↔manifest drift**: compare `kit/manifest.json` (21 records) and
  `kit/registry.json` (20) with pace-ui.vercel.app claims (44/369/check-usage);
  evidence in `docs/design/evidence/pace-jana/`.
- **PF-006 receipt drift after manual prune**: `components/pace/` has 7 files;
  verify receipt lists 22. Repro: `ls frontend/components/pace` vs
  `frontend/.pace/receipts/pace-c06be54881ff9e38fa6c029051a776cd.json`.
- **PF-009 dead installed component**: `pace/dialog.tsx`, zero imports.
  Repro: `grep -r "pace/dialog" frontend/src`.

**Hypotheses (not confirmed)**: rollback cause = license gating (PF-002);
contrast repair need = token contract gap for non-default palettes (PF-010);
no documented "deep brand preset" path pushed theming into app CSS (PF-005).

## 6. Workarounds applied (app-side, not Pace fixes)

Safe re-apply instead of fixing the plan; hand-deletion of unused kit files;
`src/components/upstream/` vendored Button/Input; direct `sonner` for toasts;
app-level theme CSS (`crextio-layout.css`, `themes/jana.css`) over pace.css;
contrast repairs in `95aa941`, `0b42954`, `3c69f67`.

## 7. Prioritized recommendations for Pace

| # | Problem → evidence | Impact | Proposed fix | Verify by |
| --- | --- | --- | --- | --- |
| 1 | Installer silently binds a different version than pinned (PF-001) | Feedback/attribution corrupted | `pace doctor` prints kit version + SHA; `apply` warns or fails on mismatch vs requested pin | Receipt `version` equals intended tag |
| 2 | Site promises components/commands the kit lacks (PF-003) | Wrong expectations pre-install | Version-bind the published catalog to a kit SHA; or ship the missing pieces | Manifest counts == site for same pin |
| 3 | Plan doesn't surface license-gated items → rollback cycle (PF-002) | Lost install cycle, 74-pkg churn | Plan output marks `LicenseRef-*` items and offers `--exclude-license`/`--safe` in one pass | Single apply reaches `verified` |
| 4 | No prune command → hand deletion breaks receipts (PF-006) | Verify lies after cleanup | `pace prune` removes unimported entries and rewrites receipt | `verify` green after prune |
| 5 | No documented deep-brand path (PF-005, PF-010) | Theming lives in app CSS; contrast fixes by trial | Document the semantic token contract for custom palettes; optional `verify` contrast gate | Brand restyle needs zero state-contrast repair commits |
| 6 | Hottest controls left kit anyway (PF-007/008) | Kit value unproven on button/input/toast | Compare kit button/input vs consumer-vendored copies; either close the gap or document the supported wrapper pattern | A consumer keeps kit button/input through a reskin |

## 8. Attribution

- **pace (kit)**: token layer quality, leaf-component structural soundness,
  receipt/provenance design.
- **docs-cli**: version binding, site↔manifest drift, license gating UX,
  missing prune, missing brand-preset guide.
- **agent-choice**: manual pruning, vendoring Button/Input, sonner shortcut,
  leaving unused dialog installed, skipping the formal A/B.
- **app-logic**: all domain screens, Crextio layout/theme, state repairs.
- **shadcn-radix/base-ui**: upstream vendored controls (Base UI + cva);
  radix itself removed by safe-deps step.

## 9. Paths

- Package: `docs/pace-feedback/2026-10-17-janamen/` (SESSION, events.jsonl,
  COMPONENTS, this file).
- Evidence index: `.artifacts/pace-feedback/2026-10-17-janamen/INDEX.md`.
- App repo: `/home/yqecea/coding-projects/jana` @ `main`.
- Pace checkout used: `/home/yqecea/coding-projects/pace` @ `4c5d2d2` (4.0.3).
