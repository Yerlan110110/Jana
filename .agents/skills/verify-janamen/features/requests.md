# Requests and decisions

## Sub-features

Leave and advance; draft and submitted revision; return and edit; manager and HR decision; history; fulfillment.

## How to get to it (user POV)

Use /requests as an employee and /team/requests as manager or HR.

## Driving it with e2e

Write tests/web/requests.e2e.ts after observing current labels. Use server needs_my_action queue, versioned commands and actual role switches.

## Proof

Both workflows retain submitted facts and history. One stale command conflicts. An uncertain repeated same-payload command creates one result. Foreign roles get no object details.

## Charters

`request-recovery|chromium|default|Using --session employee alone, examine returned request editing and uncertain-result recovery without losing values.`

## Gotchas

Approved is not paid. Delivery and source incorporation are separate. No approved cancellation or reviewer reassignment is implemented.
