# Delivery and source

## Sub-features

Integration source status; export attempts; receipt; authorized retry; separate approval and source accounting.

## How to get to it (user POV)

HR opens /hr/integrations. Employees read only request fulfillment.

## Driving it with e2e

Write tests/web/operations.e2e.ts from actual API and visible actions. Test fault/retry only on the owned synthetic adapter.

## Proof

A failed delivery is retried without a second approval. A valid receipt changes delivery evidence only. Raw payloads, secrets and operator controls stay unavailable to employees.

## Charters

`delivery-recovery|chromium|default|Using --session hr alone, inspect a failed synthetic export and its recovery while checking retained approval.`

## Gotchas

1C and Documentolog are mocks. Receipt is not payment or legal signature. Never touch a real integration.
