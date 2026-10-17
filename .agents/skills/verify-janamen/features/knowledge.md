# Knowledge and HR

## Sub-features

Question and saved answer; exact citation; refusal; explicit HR case; policy authoring and published resolution.

## How to get to it (user POV)

Open /assistant from employee navigation. HR opens /knowledge/cases and /hr/policies.

## Driving it with e2e

tests/web/knowledge.e2e.ts. Label Ваш вопрос, button Найти ответ, source link and citation heading.

## Proof

A known answer opens a permitted revision fragment. Unknown question refuses and creates one explicit case. HR can link only a separately published accessible revision. Revocation removes old source content.

## Charters

`knowledge-sources|chromium|default|Using --session employee alone, compare the saved answer and each accessible citation, including an unavailable source.`

## Gotchas

Default mode is extractive. Closing a case does not train a model. Actual generation/provider quality is a separate gate.
