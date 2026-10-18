# Integrated rehearsal review, 18 October 2026

Candidate: `f0b316e..89f8af9`. Independent reviewer: `antigravity/gemini-3.8-flash-medium`. Coordinator inspected the cited source and current contract after receiving the report. The full external report is retained in `.artifacts/verification/checkpoint-1545/independent-review.md`.

## Standards

Accepted open findings:

- Mixed visible and restricted excerpts omit the restriction notice. `frontend/src/features/knowledge/rehearsal.tsx` renders that notice only when there are no visible excerpts.
- Empty default questions produce an English validation message rather than an actionable Russian empty state.
- Archived documents retain an enabled rehearsal action although the backend rejects them.
- The paper palette retains `color-scheme: dark` in its dark selector. Native controls can disagree with the surrounding surface.
- Heading hierarchy skips a level. This is a semantic improvement; the report alone does not establish a formal WCAG failure.

The unchanged summary pill lacks a status attribute, but no concrete functional defect was shown. Treat it as optional consistency work.

## Spec

The reviewer called explicit HR-scoped questions critical. The implementation matches `docs/product/policy-rehearsal.md`, which explicitly specifies the requesting HR user's scope. It is not a permission bypass. The UI nevertheless fails to state that scope and can mislead an author testing manager-only or employee-only content. Accept the disclosure gap. Do not silently impersonate an arbitrary employee or broaden retrieval permissions. Original employee gap cases already use the original employee's scope.

The seed adds the rehearsal section only to newly created documents. Existing documents are deliberately preserved. Accept the demo-preparation/documentation gap, not the proposed unconditional overwrite of existing drafts. A deployed demo must be prepared and checked separately before claiming the scenario exists there.

The owner explicitly rejected rehearsal as the flagship differentiator. It remains an implemented supporting capability. No independent first-place or beyond-enterprise verdict was obtained.

## Verification limits

This review does not cover the forthcoming Cinetic/Earshot intro. The reviewer inspected permissions, stale versions and no-write behavior, and cited the existing 255-test run. Those checks do not close the findings above or the existing COV1 acceptance gap. Findings remain open until changes and runtime checks are recorded.
