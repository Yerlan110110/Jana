# Knowledge implementation and evidence

## Ownership and implementation shape

The knowledge module owns policy drafts, published revisions, exact source chunks, assistant answers, and internal HR cases.
Identity supplies the actor and employee scope. Core supplies append-only records and transactional events. Notifications supplies per-user delivery.
The module does not approve HR requests or modify employee facts.

The module uses the shared identity, session, event, notification, idempotency, and seed interfaces. Its implementation branch includes the core commits `44b2208`, `20d474b`, and `9ef6fb7` through local cherry-picks.
The independent Academy and integration workstreams use other worktrees. This agent owns `apps/knowledge`, its dependencies, and this document.
Publication locks one document. HR case resolution locks one case. These locks protect actual shared invariants.
One code owner keeps retrieval, publication, source access, and answer validation consistent. The root will obtain an independent review after integration.

## Design comparison

| Candidate | Behavior | Decision |
| --- | --- | --- |
| PostgreSQL full-text index with an external vector service | One central index can serve a large corpus, but index updates and access filters need explicit synchronization. | Defer until corpus size and retrieval evaluations justify it. |
| Per-scope BM25 lexical retrieval with published database chunks | Only accessible chunks enter the in-memory ranker. Source revocation takes effect on the next query and citation open. | Adopt for the reproducible baseline. |
| LLM-only reading of every policy | Sends more text to the provider and makes authorization errors more expensive. | Reject. |

`rank-bm25` supplies BM25L. `snowballstemmer` supplies Russian and English stemming. Kazakh keeps normalized tokens because the selected library has no Kazakh stemmer.
The same preprocessing runs on questions and chunks. A conservative token-coverage gate refuses weak matches. Ranking scores are not calibrated confidence values and do not appear as confidence in responses.

The official OpenAI Python SDK supplies the optional generation adapter. `OPENAI_MODEL` has no default. The adapter uses the installed Responses API and a JSON Schema generated from Pydantic types.
Generated mode uses `answer_strategy=source_bound_selection`. The provider selects complete source sentences. Rendered claims must equal their quoted sentences, with the original numbers and negation.
An unsupported paraphrase is rejected even when it cites an existing chunk. The no-key mode uses `answer_strategy=ranked_excerpts` and does not call a provider.
This contract proves preservation of selected text. It does not prove that the source policy is true or that selected sentences completely answer every question.
A live provider evaluation remains required before claiming provider-backed answer quality. Fluent paraphrase is not implemented.

## Skills applied

Pstack `poteto-mode`, `how`, and `architect` shaped ownership and the comparison above. This is a labeled sequential design pass because all available agent slots are occupied by independent project work.
`principle-model-the-domain` separated draft metadata from immutable published evidence and separated an answer from an explicit HR escalation case.
`principle-boundary-discipline` and `principle-type-system-discipline` put request and provider parsing at the boundary and derive provider JSON Schema from one Pydantic model.
`principle-test-behavior-not-implementation` directs verification to API results, access denials, persisted history, and atomic notifications.
Fstack, Emil's `emil-design-eng`, and Jakub's `better-interface` and `better-writing` shaped visible answer modes and recovery instructions. No rendered frontend is part of this module.

## Primary sources

- [Rank BM25 source and preprocessing contract](https://github.com/dorianbrown/rank_bm25)
- [Official OpenAI Python SDK](https://github.com/openai/openai-python)
- [Django QuerySet and row-lock contract](https://docs.djangoproject.com/en/5.2/ref/models/querysets/)

## Verification results

Verification ran in the module's isolated checkout using Python 3.12 and PostgreSQL 16.15. The database contained synthetic data only. No provider credential was available or used.

| Check | Actual result | What the result establishes |
| --- | --- | --- |
| Full PostgreSQL test suite | **90 passed in 32.87 seconds** | 49 shared/core tests and 41 knowledge tests pass together in this checkout. |
| Concurrent domain commands | Three PostgreSQL tests passed | Competing publications and HR resolutions produce one winner; repeated escalation converges to one case and notification. These tests use separate database connections. |
| Synthetic question evaluation | **20 of 20 passed** | Known questions return the required source statement and topic. Unknown, restricted, ambiguous, and injection cases return the expected refusal without source disclosure. |
| Real loopback HTTP journey | **29 of 29 checks passed** | Session login with CSRF, answer and citation retrieval, unknown and HR-only source refusal, explicit and replayed HR escalation, manager denial, HR response, and employee notification work across real HTTP requests. |
| Schema validation | No warnings or errors | `drf-spectacular --validate --fail-on-warn` generates the integrated schema for the installed modules. |
| Django checks and migration drift | No issues; no changes detected | The models and checked-in migration agree, and framework checks pass. |
| Ruff | Check and format pass | The module meets the repository's configured Python style checks. |

The evaluation fixture and lexical threshold were developed together. The initial run exposed two missed synthetic cases; token preprocessing and the coverage gate were adjusted. The final 20-case result is a regression result, not held-out retrieval accuracy. Nine supported cases additionally require an exact substantive source statement, beyond matching a topic.

Machine-readable results live in `backend/apps/knowledge/evidence/evaluation.json` and `backend/apps/knowledge/evidence/http-journey.json`. The question evaluation includes input hashes, dependency versions, and its calibration caveat. Neither result contains passwords or API keys.

### Meaningful failure checks

- Entity, department, role, and effective-date filters run before retrieval; inactive employee sessions are denied.
- Draft edits leave published content unchanged. Published revisions and chunks reject ORM updates and deletes; the operator admin permits viewing only.
- Historical citations require both current document access and historical revision access. Narrowing and later widening of audience scope cannot expose previously restricted evidence.
- Citation resolution and answer history reauthorize access. A revocation during a provider request withdraws the answer before it is returned.
- Provider fixtures reject invented chunk ids, invented quotations, unsupported paraphrases with valid references, changed numbers, removed negation, and incomplete source sentences.
- Provider outage and invalid output are different from absent evidence. Missing provider configuration is explicit.
- Assistant history and employee HR cases are private. Managers cannot open a subordinate's conversation or HR case.
- A notification write failure rolls back the HR case, business event, and idempotency receipt together.
- An employee transfer preserves the original entity's responsibility for the existing HR case.

### Populated seed

Fresh seeding supplies 18 documents per legal entity with an active HR owner and a warehouse department: employee, manager, HR, and department policies; two Kazakh documents; archived, draft, and future content. An entity without a warehouse department receives 17 applicable documents.
With at least three employee accounts, seeding also adds two open HR cases and one resolved case. Seed operations use the normal domain commands and retain later human edits. Repeated seeding is covered by the tests.

The runtime integration database had two entities and 58 employees from the shared seed. Its initial policy seed preceded the final warehouse department selector correction. The fresh-seed unit test and committed selector determine department behavior; the older runtime fixture is not evidence for that specific department mapping.

### Reproduce

Set the project database configuration to a disposable PostgreSQL database and run from `backend`:

```sh
uv sync --frozen --group dev
uv run python manage.py migrate
uv run python manage.py seed_demo
KNOWLEDGE_GENERATION_PROVIDER=extractive uv run pytest -q
KNOWLEDGE_GENERATION_PROVIDER=extractive uv run python manage.py evaluate_knowledge --output /tmp/janamen-knowledge-evaluation.json
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run python manage.py spectacular --validate --fail-on-warn --file /tmp/janamen-schema.yml
uv run ruff check apps/knowledge
uv run ruff format --check apps/knowledge
```

The module README documents how to run the loopback HTTP command against a running backend using the credentials file produced by `seed_demo`.

## Remaining gates and practical limits

The implementation is executable and its local backend checks pass. Independent integrated code review remains the root agent's gate. This report does not claim that an independent reviewer has approved the module.

No live model-provider call, frontend browser journey, or Docker image build was performed by this workstream. Provider transport and structured output were tested through the real installed SDK with controlled HTTP responses. A real configured provider evaluation remains necessary. Source-bound generation preserves selected sentences; it does not establish policy truth, semantic completeness, or fluent answer quality.

The corpus is synthetic. Real policy ingestion, owner approval, broader held-out questions, adversarial retrieval cases, and native-speaker Kazakh review remain necessary before real employee use. The instruction-pattern guard is a conservative layer, not a comprehensive prompt-injection detector.

The lexical ranker rebuilds from the currently authorized corpus for each question. This keeps access changes immediate, but no large-corpus latency or memory claim is made. Kazakh uses normalized tokens without a morphological stemmer in the selected library.

Published evidence is immutable through application ORM and API/admin boundaries. A database operator can bypass application rules; database-level tamper resistance is not claimed. Simultaneous duplicate questions persist one answer and event but can issue more than one provider call before persistence. Durable inference execution and provider billing deduplication are future work.
