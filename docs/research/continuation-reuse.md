# Continuation reuse decisions

Observed 17 October 2026. Runtime evidence and raw responses are retained under `.artifacts/pace-research/` and `.artifacts/reuse-sources/`. This record supersedes metadata-only component decisions.

## Pace source and deployment differ

The permitted local source is pinned at `4c5d2d2077de1a2997d5d7bc8a79e69ae3656d32`, kit 4.0.3. The [public demo](https://pace-ui.vercel.app) serves kit 4.1.7 from `eb8b4834f12d719d28e9a7791d821ade618810ac`. Its deployed registry digest matches the pinned deployed source. The local registry has 82 stable entries; the deployed registry has 109. Both contain 394 total entries. The public site is not evidence that local preview entries are stable.

A live REA capture inspected navigation and the design page at 1280 × 720 with reduced motion. Evidence ID is `ev_e517ebc6f052d6860f751c485efb69d7c50dacd19b721e7061b07cf55e624d76`. This is a live capture, not a replay. It does not prove authenticated HR, responsive, keyboard or component interaction behavior. The current session has a working REA CLI; active MCP discovery is a separate claim.

Full source and import closure inspection permits the local `textarea`, `native-select`, `card`, `empty`, `skeleton` and `dialog`, plus their shared `cn` helper. Their component source is MIT. Shared Pace styles and notices are AGPL-3.0-only and retain their notices in the public source. This is not a claim that all of Pace is MIT or a legal opinion on combined distribution.

Button, Toast and MotionPrefs remain excluded. Their full helper closure retains explicitly attributed Oxygen constants despite MIT registry labels. Input, Badge, Table, ProgressRing and several other entries depend on unresolved Oxygen permission. Removing attribution or relying on tree shaking does not resolve that uncertainty. No complete stable local screen block has a verified safe closure.

The first broader installation was rolled back after this finding. The final receipt is `pace-c06be54881ff9e38fa6c029051a776cd`. Receipt verification and `python3 .artifacts/pace-research/verify-evidence.py` pass. The latter checks source pins, registry identity, closure and font evidence; it does not inspect the finished JanaMen UI.

## Missing controls use official MIT source

Button and Input come from the official shadcn registry, with its MIT notice retained. Sources are [Base Nova Button](https://ui.shadcn.com/r/styles/base-nova/button.json) and [Base Nova Input](https://ui.shadcn.com/r/styles/base-nova/input.json). The raw response SHA-256 values are respectively `9ba7e870178813f0552b818a913a2792fb500c779e36395740b4973e3025d427` and `bbad1bba130ac9750a61844eeb8f043e8a710846e07689fa85398b80a46c2741`.

Both use the already installed Base UI package. Imports are adapted to the existing `cn` helper. Button transitions name exact properties. A small JanaMen wrapper preserves action width during pending commands and supplies icon slots. It does not replace accessible primitive mechanics. The component registry records these provenance decisions.

## Jana identity and readable type

Observed Jana assets supply green `#008c00`, text `#12151a`, muted text `#5e5e60`, background `#f6f6f6` and tint `#f1fff1`. White normal text on the original green has contrast 4.4199, below 4.5. The action variant `#007a00` has contrast 5.55. Focus needs an opaque outline; a half-alpha green ring on white was insufficient in the inspected pair.

Inter Tight Variable 5.3.0 is OFL-1.1. The actual Cyrillic and extended Cyrillic font files jointly contain all 18 Kazakh-specific upper/lowercase glyphs. Browser use and rendering remain separate checks. No downloaded remote font is required at runtime.

## Professional mechanisms to apply

Existing HR/LMS research remains relevant. Further feature work must record the observed or documented mechanism before composing the JanaMen view.

| Source | Mechanism | JanaMen use and boundary |
| --- | --- | --- |
| [Frappe HR leave application](https://docs.frappe.io/hr/leave-application) | Dates, balance, assigned approver, explicit status and notifications | Read-only official balance beside a real request form; current responsible role and history. Behavior reference only; no Frappe source copied. |
| [Frappe employee-specific approver](https://docs.frappe.io/hr/leave-management/help-articles/setting-employee-wise-leave-approver) | Approval scope belongs to the employee's routing | Use the server's review predicate before pagination. No global client-side HR inbox. |
| [Moodle demos](https://moodle.org/demo/) | Assigned course navigation, material, completion and assessment are separate activities | Inspect available live demo and first-party docs before Academy composition. Retain actual published revision and server result. No client answer key or completion on page visit. |
| [shadcn registry](https://ui.shadcn.com/docs/registry) | Accessible source-distributed controls with explicit dependencies | Reuse controls; compose domain pages around the existing Django session and API. No second auth or backend. |

These references justify mechanism reuse, not a pixel copy of an unrelated dashboard. A full HR suite replacement would discard the tested contract and duplicate the HR source. A complete Pace screen is currently blocked by provenance. Safe primitives plus the existing domain APIs are the smaller verified foundation.
