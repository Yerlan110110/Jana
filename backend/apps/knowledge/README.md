# AI Jana and policy knowledge

This module answers questions from accessible published policies and records explicit requests for HR help.
All bundled policies are synthetic. They are not Jana Post rules.

## Run the reproducible mode

Run commands from `backend` after the main database configuration is ready.

```sh
uv sync --frozen --group dev
uv run python manage.py migrate
uv run python manage.py seed_demo
uv run python manage.py evaluate_knowledge --output /tmp/janamen-knowledge-evaluation.json
```

`seed_knowledge()` adds 18 policy examples per legal entity with an active HR owner and a warehouse department.
It adds the 17 applicable documents if the warehouse department is absent. Repeated runs preserve existing documents, revisions, and human edits.
The documents include employee, manager, HR, and department audiences, two Kazakh documents, an archive, a draft, and a future effective date.
When the entity has at least three employee accounts, seeding also creates two open HR cases and one resolved case. Stable message ids prevent duplicate cases or overwritten human responses.

The default `KNOWLEDGE_GENERATION_PROVIDER=extractive` calls no model provider.
The ranker uses `rank-bm25` BM25L and `snowballstemmer`, with normalized Kazakh tokens.
Only accessible current chunks enter the ranker. A query needs at least two matched terms and at least two-thirds token coverage.
The threshold and stop words were tuned against the bundled regression cases. The case result is not held-out accuracy.
Ranking cannot prove that an excerpt fully answers every natural-language question. Broader paraphrase and Kazakh morphology evaluation remains necessary.

## Enable model selection of source sentences

Set the following environment variables outside Git.

| Variable | Value |
| --- | --- |
| `KNOWLEDGE_GENERATION_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | The operator's provider credential |
| `OPENAI_MODEL` | An explicitly selected model supported by the operator's account and Responses structured output |

The model name has no default. A missing model or key returns `provider_unavailable` with reason `provider_not_configured`.
The official OpenAI Python SDK receives only the question and permitted excerpts. Requests set `store=false`, a 20-second SDK timeout, one retry, and at most 1,800 output tokens.
When enabling this adapter, configure the web worker and reverse proxy timeout to cover both attempts and retry delay, for example at least 60 seconds. The provider is not called inside the normal answer persistence transaction.
SDK transport behavior is tested with a controlled HTTP transport. This repository does not claim a successful live provider call.

The provider returns structured claims. Each claim must consist of complete source sentences and cite their actual chunk ids.
The server rejects invented ids, invented quotes, paraphrases, changed numbers, removed negation, and partial-sentence extraction.
Every rendered sentence matches its cited source. This guarantee does not prove that the source policy is true or that the selected answer is complete.
Fluent paraphrase generation is not implemented.

## Interpret the answer contract

| `mode` | `answer_strategy` | Meaning |
| --- | --- | --- |
| `extractive` | `ranked_excerpts` | The local ranker selected source excerpts. No LLM call occurred. |
| `generated` | `source_bound_selection` | The provider selected complete source sentences. The server preserved the original text. |
| `insufficient_evidence` | `refusal` | There is no supported answer, clarification is needed, or prior evidence is no longer accessible. |
| `provider_unavailable` | `unavailable` | The configured provider failed or its output failed validation. |

New answers return HTTP 201. A repeated `client_message_id` with the same question and language returns the persisted answer with HTTP 200.
A reused id with a different question returns HTTP 409. Use a new id to ask again after a provider outage.
A provider failure returns HTTP 503 with the standard error fields and the persisted answer in `answer`.
Lists and detail reads return the same answer shape with current evidence checks.
Simultaneous requests with the same new message id converge to one persisted answer and event, but can both reach the provider before persistence. The message id does not guarantee one billable provider call. A durable inference job would be needed for that guarantee.

`evidence_status` is `current`, `superseded`, `unavailable`, or `not_applicable`.
An old accessible revision remains identified as `superseded`. Show a visible historical-source message and an action to ask again.
If a source is archived, expires, or leaves the employee's scope, the server withdraws stored claims and citations.
The original append-only answer remains in the database. It is not exposed through the employee API after the source is revoked.

## Use the API

All routes start with `/api/v1/`. Use the session and CSRF flow described by the main API guide.

| Route | Methods | Access and behavior |
| --- | --- | --- |
| `knowledge/documents/` | GET | Paginated effective published policies in the employee's scope. |
| `knowledge/documents/{id}/` | GET | The current published revision, with its text and metadata. |
| `knowledge/citations/{chunk_id}/` | GET | An authorized exact excerpt, immutable revision, locator, and content hash. |
| `knowledge/updates/` | GET | The employee's assignments; managers see themselves and direct reports, HR sees the legal-entity scope. |
| `knowledge/updates/{id}/` | GET | The employee's before/after changes and question. The correct option is never returned. |
| `knowledge/updates/{id}/attempt/` | POST | Submit one answer with `Idempotency-Key`; an incorrect answer remains open for retry. |
| `knowledge/admin/documents/` | GET, POST | Entity-scoped HR draft management. |
| `knowledge/admin/documents/{id}/` | GET, PATCH | Read or update a draft with `expected_version`. |
| `knowledge/admin/documents/{id}/publish/` | POST | Publish a new immutable revision with `expected_version`. |
| `knowledge/admin/documents/{id}/archive/` | POST | Withdraw the source with `expected_version`. |
| `knowledge/admin/documents/{id}/revisions/` | GET | HR history of immutable published revisions. |
| `assistant/answers/` | GET, POST | Private answer history or a new question. |
| `assistant/answers/{id}/` | GET | The author's answer with fresh source authorization. |
| `knowledge/gaps/` | GET, POST | Private employee cases and original-entity HR work queue. |
| `knowledge/gaps/{id}/` | GET | The case question, details, and saved HR response. |
| `knowledge/gaps/{id}/resolve/` | POST | Entity-scoped HR response with `expected_version`. |

Every document mutation, gap mutation, and policy-update answer requires `Idempotency-Key`. A replay returns the original command result and `Idempotency-Replayed: true`.
An idempotency key cannot be reused for another route, body, employee entity, or role.
The next client reads the object again when it needs current state after a replay.

Question input has `question`, `language`, and a fresh UUID `client_message_id`.
Gap input has `answer_id` and optional `details`. Creating a question does not automatically create a gap case.
Gap resolution input has `expected_version` and `response`. Managers cannot read a subordinate's private HR case or assistant history.
The case retains its original legal entity if the employee transfers. The original entity's HR keeps responsibility for the case.

Document creation requires `slug`, `title`, `language`, `topic`, and `draft_sections`.
Each section has `heading` and `text`. The API accepts at most 40 sections, 12,000 characters per section, and 120,000 text characters per document.
Optional ownership fields remain subject to HR entity restrictions. Only a technical superuser can author a document for all legal entities.
Draft edits do not change published title, text, audience, or dates before publication.
For an existing published document, changing its title, summary, or section text requires a practical check with three distinct options before publication. The published revision retains its predecessor and check; assignments and notifications go only to active users matching that revision's audience, legal entity, and department. A correct answer completes the assignment; wrong answers are retained and can be retried. The manager list contains only the manager and direct reports. HR sees assignments in its entity. Archiving or publishing a later changed revision closes earlier pending assignments. A change to publication metadata alone does not create a new assignment.
The technical Django admin offers these records for viewing. It does not bypass the business commands.

## Frontend integration

Generate client types from the root OpenAPI schema. Do not create a second handwritten API contract.
Use `allowed_actions` to show commands, and retain server permission checks.
Render question text, policy text, and provider-selected text as plain text or sanitized Markdown. Never inject source content as trusted HTML.
Use the server's citation URL. A model-generated link is not accepted by this API.
Keep the synthetic label, source title, section locator, revision number, and effective dates visible with the answer.
Show the source-bound selection label for generated mode. Do not describe it as fluent synthesis.
Render a clear recovery action for insufficient evidence, provider errors, and revoked sources. A loading spinner does not replace these states.
RU and KZ response messages are included. Native-speaker review of the Kazakh wording remains open.

## Verify the module

```sh
uv run pytest apps/knowledge -q
uv run python manage.py spectacular --validate --fail-on-warn --file /tmp/janamen-schema.yml
```

Run the suite on PostgreSQL to execute the three concurrency cases. SQLite skips those cases.
The concurrent cases cover publication, repeated escalation, and case resolution.
The committed `evidence` directory contains the synthetic regression and loopback HTTP results. Their scope is recorded in each file.

To verify real local HTTP sessions, start the backend and run the following command with the credentials file produced by `seed_demo`.

```sh
uv run python manage.py smoke_knowledge_http \
  --base-url http://127.0.0.1:8000 \
  --credentials-file ../runtime/demo-credentials.json \
  --output /tmp/janamen-knowledge-http.json
```

This check creates synthetic questions and one resolved HR case. It verifies CSRF login, citations, refusal, role denial, idempotent escalation, HR response, and notifications.
The command accepts a loopback server and prints no passwords. It does not inspect the policy rehearsal or policy-update screens.

## Reused implementations

- [Django](https://docs.djangoproject.com/en/5.2/) supplies transactions, row locks, models, migrations, sessions, and the operator admin.
- [Rank BM25](https://github.com/dorianbrown/rank_bm25) supplies lexical ranking.
- [Snowball](https://snowballstem.org/) supplies the installed stemming algorithms.
- [OpenAI Python SDK](https://github.com/openai/openai-python) supplies provider transport and Responses support.
- [Pydantic](https://docs.pydantic.dev/latest/) supplies provider output validation and the generated JSON Schema.
