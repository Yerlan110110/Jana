# External integration boundaries

This contract defines the normalized interface implemented by the demonstration adapters. It does not claim knowledge of private 1C or Documentolog endpoints.

## Ownership and identity

| System | Authoritative facts | JanaMen responsibility |
| --- | --- | --- |
| 1C | Employee employment facts and official leave balance | Import a validated source snapshot, retain revision/freshness, keep it read-only in business APIs. |
| JanaMen | Request payload, submitted revision, review decision, learning result | Preserve evidence and perform authorized transactional commands. |
| Documentolog | Receipt and processing state of an exported document | Retain external identity and delivery state independently of approval. |
| Payroll or payment provider | Actual advance payment | Never infer payment from an approved request or mock document receipt. |

Use stable source employee ids. Names are display values, not identity keys. A connector does not provision an administrator by trusting a role string in an employee snapshot.

## Employee import

A normalized batch identifies its source, legal entity, monotonic source revision for the mock protocol, captured time and employee records. The adapter for a real system must explicitly translate its own revision semantics.

Validate the complete intended change before committing. Resolve manager references by external id, including references to another record in the same batch. Reject duplicate employee identities, unknown dependencies, inconsistent legal entities, manager cycles and stale revisions. Keep the last valid imported facts when a batch fails.

Only explicit integration/operator commands can write official facts. An ordinary HR profile form cannot invoke an unrestricted import. A connector's authentication belongs at that boundary when a real remote transport is enabled.

Employee account provisioning and employment synchronization are distinct operations. The current synthetic seed provisions accounts. A real onboarding connector must define its own account lifecycle before adding automatic account creation.

Record source revision, source capture time, processing result and a safe error summary. A retry of the same accepted snapshot converges to the same state. Reusing a revision with different data is a conflict rather than a silent overwrite.

## Leave balance reconciliation

The profile exposes the official balance and the time of its source snapshot. Portal reservations and projected remaining days are separate values.

An import must establish which approved portal requests the new official balance already incorporates. Without that correlation, subtracting every portal approval after every import can count the same leave twice.

The implemented mock accepts explicit `incorporated_request_ids` for each employee snapshot. Each id must identify that employee's approved leave request and its immutable submitted revision. The HR-owned `LeaveBalanceIncorporation` stores the confirmed revision and day count. A later snapshot must reaffirm every currently incorporated id; omission is a validation error. To remove an incorporation, the caller supplies `balance_reversals` with a request id and reason. The source import history retains both the original inclusion and correction. A later explicit reincorporation is supported.

The calculation is `projected_balance = official_balance - portal_reserved_days`. Reservations include pending and approved portal leave except approved leave explicitly incorporated by the source. `source_incorporated_days` is exposed separately to explain the difference. Documentolog acceptance never reduces these reservations by itself.

A real connector must supply comparable source accounting evidence and revision semantics before the projection can be described as authoritative. Do not guess incorporation from a matching date, amount or document-delivery receipt. The exact normalized request fields and response schema are generated in OpenAPI; [integration verification](../verification/integrations.md) records the implemented rules and recovery cases.

## Export after final approval

1. The approval command commits a business decision, event and outbox message together.
2. A worker claims a due message, records an attempt and constructs an export from the immutable submitted revision.
3. The adapter receives an idempotency key tied to that message, not a newly generated key on each retry.
4. The adapter returns an external receipt or a typed failure.
5. The worker records success or schedules a bounded retry. A process crash leaves work recoverable through an explicit lease or equivalent claim mechanism.

The export includes request identity, revision, type, relevant immutable employee facts, requested dates or decimal money and decision metadata. It excludes passwords, session data, unrelated personnel fields and full AI conversation history.

An external call does not participate in a PostgreSQL transaction. A crash after remote acceptance and before local acknowledgment can happen. Receiver idempotency is therefore part of the adapter contract, even when a worker holds a row lock.

## Operator behavior

Operators can see source synchronization state and export failures within their permitted scope. Retry is an explicit command. It does not create another HR approval and cannot silently alter the approved payload.

Mock fault injection should support a transient delivery failure and a successful retry with the same external identity. It is a controlled demonstration/test capability. Do not expose a generic arbitrary-URL connector to ordinary users.

## Acceptance evidence

- A stale employee import preserves the newer snapshot.
- A malformed employee/manager batch commits no partial official facts.
- A duplicate source revision with different payload is rejected.
- A failed export preserves the approved business request.
- Retrying a delivered message yields one receipt and does not duplicate the business decision or notification.
- A crashed claim can become available again without rewriting the message identity.
- An employee and an out-of-scope HR account cannot operate another entity's integration records.

The verification report must distinguish implemented and executed scenarios from adapter obligations that await the real external systems.
