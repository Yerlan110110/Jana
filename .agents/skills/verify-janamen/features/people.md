# People and scope

## Sub-features

Imported read-only profile; source date; scoped team and employee details; learning summary denominator.

## How to get to it (user POV)

Use /profile for self, /team for manager or HR, and allowed employee links.

## Driving it with e2e

Write tests/web/people.e2e.ts after route integration. Compare both list and direct-link scope.

## Proof

No business role can edit imported facts. Foreign team/entity details stay undisclosed. Summary and drilldown refer to the same population.

## Charters

`people-scope|chromium|default|Using --session manager alone, inspect long team records and direct links while checking read-only facts and scope.`

## Gotchas

A manager field does not itself authorize decisions on an earlier submitted request.
