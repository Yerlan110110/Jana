# Demonstration data contract

## Purpose

Synthetic data must exercise actual product decisions.
Thirty differently titled cards are insufficient if their content and state are identical.
A request history, notification, course result and profile must reference the same existing people and events.

## Organization

Use at least two legal entities and several departments.
Include an employee with a manager, an unrelated manager, HR users with distinct company scopes and a controlled technical operator.
Prepare enough staff records to exercise pagination and filters.
Use fictional names and contact addresses under reserved example domains.
Use deterministic identifiers where tests or fixtures need stable references.
Generate demo credentials at runtime. Keep credentials outside Git.

## Requests

Prepare both leave and salary advance records across the implemented workflow states.
Include a returned request with a revised submission, a rejected request with a reason and a pending request that can be acted on live.
Keep dates, versions, submitted snapshots, actor assignments and history consistent.
At least one employee has several requests so filtering and history are meaningful.
A seed rerun must not duplicate business records or silently reset later user work.

## Academy

Create 30 complete course entries with varied learning content and matching questions.
Suggested content areas are onboarding, parcel operations, customer communication, information handling, team operations and safety.
These are demonstration topics, not assertions of actual Jana Post procedures.
A learner has assigned, unstarted, in-progress, completed, failed-attempt and overdue states.
Other employees have different distributions so team progress is useful.
Course duration is a content estimate, not proof of time actually spent studying.
Materials and quiz questions must agree. Correct options remain outside learner responses.

## Knowledge

Create policies that cover the demonstrated request and learning tasks.
Each policy has a title, version, owner, language, audience and a clear synthetic-content label.
Include an HR-restricted document and a document for another legal entity for access tests.
Include questions with evidence and questions without it.
Do not invent a factual answer to improve the apparent success rate.

## Events

Every read/unread notification targets an existing record.
Historical events carry plausible timestamps in chronological order.
Mock export receipts identify what was sent and whether it was accepted.
A failed export remains separate from the underlying human approval.

## Validation

The seed command reports counts and identities without logging secrets beyond its explicit one-time credentials output.
A verification script checks referential consistency, uniqueness, real state variety and catalogue count.
Record the observed counts after execution. Do not replace measured counts with these target statements.

