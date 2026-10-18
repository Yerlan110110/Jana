# Policy rehearsal before publication

Status: implemented backend contract, 18 October 2026.

HR can preview how the existing extractive retrieval would answer scoped past
employee questions if the current draft of one `KnowledgeDocument` were
published, without publishing it. The preview is read-only. Publication stays a
human action on the existing publish command.

## Design choice

Two options were compared:

- **Stored simulation.** Persist a `PolicySimulation` aggregate with its own
  results, events and lifecycle. Rejected: it duplicates corpus state, needs a
  migration and snapshot bookkeeping, and cannot prove more than the live
  ranking seam already proves. The brief prefers no new model.
- **Pure preview.** Recompute ranking per request against a candidate corpus
  where only this document's published chunks are replaced by in-memory draft
  chunks. Chosen and implemented. No persistence, no LLM call, no legal
  judgment.

## Endpoint

`POST /api/v1/knowledge/admin/documents/{id}/rehearsal/`

Session-authenticated HR in the document's legal entity only. Employees,
managers and HR of another entity get 403 or 404 under the same rules as other
admin document actions. CSRF applies as to any unsafe request. No
`Idempotency-Key` is required because the action writes nothing: it creates no
`AssistantAnswer`, event, notification or version change.

### Request

```json
{
  "expected_version": 3,
  "language": "ru",
  "questions": ["Можно ли перенести часть отпуска на следующий год?"],
  "gap_case_ids": ["9b1f8c2e-...."]
}
```

- `expected_version` — required. Compared with the document version exactly as
  publish does. A stale value returns 409.
- `language` — optional, applies to explicit `questions` only. Defaults to the
  document draft language. Gap-case questions use the language stored on their
  original answer.
- `questions` — optional list of explicit question strings, 8–2000 characters
  each, plain text without hidden control characters. Evaluated under the
  requesting HR user's own scope.
- `gap_case_ids` — optional list of `KnowledgeGapCase` ids. Only cases visible
  to the caller (same legal entity, active employee) resolve; any other id
  returns 404 and exposes nothing about the case. Each question is evaluated
  under the original employee's scope, so access, department, audience and
  effective-date semantics match what that employee's assistant would see.
- If both are omitted, up to 10 most recent scoped gap-case questions are used.
- The combined total is bounded at 10 questions. A larger set returns 400.
- If no questions resolve at all, the endpoint returns 400.

The interface explicitly labels manual questions as HR-scoped. It shows a
restriction notice even when some excerpts remain visible. Archived documents
cannot start a rehearsal from the editor. An empty question population asks the
author to enter a question; it does not imply a successful zero-question check.

Errors: 400 validation, 403 wrong role, 404 unknown or out-of-scope document or
gap case, 409 stale `expected_version`.

### Response

```json
{
  "document": {
    "id": "…",
    "slug": "syn-kz-demo-leave",
    "title": "Порядок отпуска",
    "state": "published",
    "version": 3,
    "has_unpublished_changes": true
  },
  "current": {
    "revision_id": "…",
    "revision_number": 1,
    "content_hash": "…",
    "published_at": "2026-10-18T09:00:00Z"
  },
  "draft": {
    "content_hash": "…",
    "language": "ru",
    "topic": "leave",
    "audience": "all",
    "effective_from": "2026-09-18",
    "effective_until": null,
    "section_count": 3
  },
  "audience_impact": {
    "eligible_current": 41,
    "eligible_draft": 41,
    "changed": 0
  },
  "summary": {"total": 2, "unchanged": 1, "changed": 0, "lost": 0, "gained": 1},
  "impacted_employees_count": 1,
  "results": [
    {
      "source": "gap_case",
      "gap_case_id": "…",
      "question": "Можно ли перенести часть отпуска на следующий год?",
      "language": "ru",
      "classification": "gained",
      "before": {"reason": "no_matching_policy", "excerpts": [], "restricted_excerpts": 0},
      "after": {
        "reason": "lexical_evidence",
        "excerpts": [
          {
            "origin": "draft",
            "chunk_id": null,
            "revision_id": null,
            "revision_number": null,
            "document_id": "…",
            "title": "Порядок отпуска",
            "heading": "Перенос отпуска",
            "locator": "§ 3. Перенос отпуска",
            "text": "…",
            "content_hash": "…",
            "score": 4.21,
            "coverage": 1.0
          }
        ],
        "restricted_excerpts": 0
      }
    }
  ],
  "scope": "extractive_retrieval_comparison",
  "not_legal_verification": true
}
```

### Field semantics

- `current` is `null` for a document that was never published. In that case
  `audience_impact.eligible_current` is `null` and every excerpt in `after`
  that comes from the draft is a gain candidate.
- `classification` per question:
  - `unchanged` — the same ordered evidence (document id + chunk content
    hash) before and after, or no evidence in both.
  - `changed` — evidence exists in both runs but differs.
  - `lost` — evidence existed before, none after (for example the draft
    narrows audience or effective dates so the document leaves the corpus).
  - `gained` — no evidence before, evidence after.
- `excerpts[].origin` is `published` for real persisted chunks (ids are real
  and citable) and `draft` for in-memory draft chunks. Draft excerpts carry
  `chunk_id`, `revision_id` and `revision_number` as `null`; the frontend must
  not build citation links for them.
- `restricted_excerpts` counts ranked chunks the caller may not see.
  Gap-case questions are ranked under the original employee's scope, which
  can include documents HR can neither read nor manage — for example a
  global `legal_entity: null` policy with `audience: "employee"`. Their
  excerpts are never serialized; only the count is exposed. The
  classification still reflects the employee's real ranked result, so
  `reason: "lexical_evidence"` with `excerpts: []` and
  `restricted_excerpts > 0` is a coherent, expected combination. Same-entity
  employee policies are not restricted: entity HR can already manage them.
- `audience_impact` counts are bounded by the document's own scope. Entity
  HR can only rehearse documents in their legal entity, so counts stay
  inside it. A superuser rehearsing a company-wide document may count
  employees across entities; that is a technical-admin path, not an HR one.
- `before.reason` / `after.reason` reuse the assistant's reason vocabulary:
  `lexical_evidence`, `no_matching_policy`, `clarification_required`,
  `unsafe_instruction`.
- `audience_impact` counts active employees with active accounts for whom the
  document is retrievable today under the published revision versus under the
  draft scope (legal entity, department, audience, effective window). `changed`
  is the size of the symmetric difference. These are counts only; no employee
  identity is exposed.
- `impacted_employees_count` is the number of distinct employees among the
  evaluated gap-case questions whose classification is not `unchanged`.
- `scope` and `not_legal_verification` are constants. The preview compares
  lexical retrieval support only. It does not judge legal correctness, does
  not call an LLM and does not certify the draft.

## Semantics that match production retrieval

- The ranking seam is shared: `retrieval.rank_chunks` ranks any iterable of
  chunks. `retrieve()` calls it with the live accessible corpus; rehearsal
  calls it with the swapped corpus. Scoring, coverage thresholds, ambiguity
  detection and unsafe-instruction filtering are identical.
- The before-corpus is exactly `accessible_chunks(actor, current_only=True,
  language=…)` for each question's actor.
- The after-corpus removes this document's chunks and adds draft chunks only
  when the draft metadata (legal entity, department, audience, effective
  window, language) passes the same visibility rules for that actor. A draft
  that changes scope is previewed honestly: narrowing to `hr` or a future
  `effective_from` shows evidence as `lost` for employees.
- Questions from gap cases never expose the employee's identity; the response
  carries `gap_case_id`, question text and language only.

## Seed scenario

`seed_knowledge()` leaves the `{entity}-demo-leave` document published with an
unpublished draft that adds a «Перенос отпуска» section, and seeds an open gap
case asking «Можно ли перенести часть отпуска на следующий год?» Rehearsing
that document demonstrates a `gained` classification end to end. The
`{entity}-demo-remote-work` document stays a never-published draft for the
`current: null` path.

## Limitations

- Preview reflects the draft and corpus at request time. Concurrent edits by
  another HR are guarded only by `expected_version`; a later rehearsal may
  differ.
- Ranking is lexical (BM25). A generated answer mode is not simulated; the
  preview bounds what retrieval could supply, not what a configured LLM would
  say.
- `audience_impact` counts eligibility, not notification or readership.

## Observed integration behavior

The frontend uses generated OpenAPI types and suppresses an old result while
its draft has unsaved changes or its saved version differs from the result.
An explicit question runs in HR scope. Its employee-impact count can therefore
be zero even when the source changes; only evaluated gap cases contribute
employee counts.

The matching corpus includes document titles and section headings as well as
body text. Removing an answer paragraph while retaining a matching title can
produce `changed`, not `lost`. The side-by-side excerpts expose that change;
this is not a semantic guarantee that the remaining passage answers the
question. The pitch must describe source comparison, not automatic detection
of every incorrect or missing answer. This behavior was observed in the
Docker browser run on 18 October; the first assertion expecting `lost` failed
and is retained in `.artifacts/browser/checkpoint-1557/rehearsal/`.
