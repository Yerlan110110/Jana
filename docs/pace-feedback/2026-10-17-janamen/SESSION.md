# Pace feedback session — JanaMen (run 2026-10-17-janamen)

Status: **retrospective reconstruction**. The structured log (`events.jsonl`,
`COMPONENTS.md`) was not maintained during the hackathon. This package was
rebuilt on 2026-10-20 from Git history, Pace receipts, research notes and the
preserved conversation summary. Every entry in `events.jsonl` carries
`"retrospective": true`. User quotes are included only where a verbatim
message survived in the thread history; otherwise `user_quote` is `null` and
the observation records a paraphrase.

## Product under test

- JanaMen — synthetic Digital HR platform for the Jana Post × Terricon Valley
  hackathon. Django/DRF/PostgreSQL backend, React 19 + Vite + TypeScript
  frontend (`frontend/`).
- Time box: 16–18 October 2026, public demo at <https://jmhr.vercel.app>,
  repo `Yerlan110110/Jana`.
- Design direction actually shipped: "Crextio" editorial dashboard —
  graphite/paper/solar (yellow) palette, translucent cards, pill navigation,
  oversized thin numerals. An earlier green Jana Post direction was rejected
  by the owner before this reskin (see PF-005).

## Pace versions — pinned vs factually used

| Fact | Value | Evidence |
| --- | --- | --- |
| Pinned by owner prompt | Pace 4.1.5, commit `f510c1344a70f91c14c45eeadbff319a6b86ecb8`, branch `codex/pace-cloud-handoff-20261011` | session prompt |
| Checkout actually used | `/home/yqecea/coding-projects/pace` @ `4c5d2d2077de1a2997d5d7bc8a79e69ae3656d32` (2026-10-15), same branch | `git log -1` in pace checkout |
| Version reported by installer | **4.0.3** | `.artifacts/pace-apply.json`, `pace-safe-verify.json` |
| Install receipt | `pace-15b5115e49e1540f57d55276cd196ba3` → status `rolled-back` | `.artifacts/pace-rollback-held.json` |
| Re-apply receipt (safe set) | `pace-c06be54881ff9e38fa6c029051a776cd` → status `verified` | `.artifacts/pace-safe-verify.json` |

Version boundary: all feedback below is bound to **kit 4.0.3 @ 4c5d2d2**, not
to the pinned 4.1.5. The delta between the two was never evaluated (PF-001).

## Timeline (UTC+5 → UTC)

- 2026-10-17 — prior research doc `docs/research/pace-jana-design-system.md`
  records kit/site manifest drift before any install (PF-003).
- 2026-10-17T17:39Z — `bin/pace.mjs apply`, 27 items, deps `added 88 packages`.
- Same day — apply **rolled back**; re-planned as "safe" 22-item set, deps
  `removed 74 packages`; `verify` → `verified: true` (PF-002).
- 2026-10-17T18:00Z — commit `808e0c6` "add typed session and licensed
  interface foundation" lands kit + `styles/pace.css` + `components.json`.
- 2026-10-18 — app reskin to Crextio (`e77b828`), then graphite/paper/solar
  workspace + cinematic entry (`b6ae372`, 16:39 +05).
- 2026-10-18 — contrast/focus/keyboard repair commits (`95aa941`, `0b42954`,
  `1ef839c`, `3c69f67`, `98352ec`) (PF-010).
- 2026-10-18–19 — product work continues to `9ed64c7` / `1a183b7`; public
  Vercel deploy confirmed READY.
- 2026-10-20 — this retrospective package written.

## Scope and screens

Auth entry (demo quick-login), employee workbench, requests list/detail/forms,
AI Jana assistant + knowledge reading/authoring/rehearsal/updates/cases,
Jana Academy (learner course/quiz + HR authoring/analytics), notifications,
people/operations (manager, HR views). Two themes were exercised on the same
component set in sequence (green Jana → Crextio), never side-by-side; the
formal Pace-theme vs brand-theme A/B required by the experiment was **not**
run (see `COMPONENTS.md` coverage notes).

## Evidence locations

- Receipts/plans: `.artifacts/pace-*.json`, `.artifacts/pace-*-deps.log`,
  `frontend/.pace/receipts/`, `frontend/.pace/backups/`.
- Prior research: `docs/research/pace-jana-design-system.md`,
  `docs/design/evidence/pace-jana/` (source-provenance, rea-replay-summary…).
- `.artifacts/pace-feedback/2026-10-17-janamen/INDEX.md` — pointer index.
