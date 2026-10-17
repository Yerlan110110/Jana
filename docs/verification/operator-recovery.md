# Operator delivery recovery through the real interface

18 October 2026. One fresh advance completes through employee, manager, HR, failed mock delivery, operator recovery and the employee's confirmed receipt. This is a synthetic integration check. It proves neither payment nor a legal signature.

The passing run is `.artifacts/operator-recovery-20261018-2.log`, with one passed test. Its trace and safe synthetic observations are in `.artifacts/browser/operator-recovery-20261018-2/`. Request `aa4e6f96-2e08-42ae-a278-f7c7b8e098b9` and export `ed7544e7-6537-4626-bed0-6d7471775036` retain their real history. The test does not consume leave balance.

The probe stops only the existing `janamen-ci` worker before the new approval. This lets the HR operator enable the server's existing mock fault while that export is pending. The API actually reports mock-fault availability. The test follows the operator list's real link and accepts the three explicit native confirmations for fault, restoration and retry. Starting the worker produces an actual failed attempt without a receipt. HR restores the adapter and separately retries delivery. The next actual attempt is accepted and the receipt names the same submitted revision. The final export contains two attempt results, `failed` then `accepted`.

A fresh request read proves that delivery and retry leave the approval version and complete decision history unchanged. After an actual account switch, the employee sees the receipt and the advance's separate source-accounting state. The employee has no delivery-retry button. Operator diagnostics remain in the operator endpoint rather than the employee fulfillment projection. Existing permission tests cover the server denial separately.

The runner restores the same owned worker container in `finally`, including on failure. The first attempt, `.artifacts/operator-recovery-20261018-1.log`, fails because the new test guessed a route missing `/exports/`. It is a verification error, not a product defect. Its approved request and delivered export remain preserved. The repaired test follows the application's existing link and checks the resulting export identity. No application code or database state was changed to make this pass.

Run this host-only probe on the explicitly selected fixture after its services are ready.

```bash
JANAMEN_OPERATOR_PROJECT=janamen-ci \
JANAMEN_WEB_URL=http://127.0.0.1:8090 \
JANAMEN_CAPTURE_ROOT=.artifacts/browser/operator-<unique-run>/captures \
npx e2e run --config e2e.operator.config.ts --trace on \
  --output .artifacts/browser/operator-<unique-run>/report
```

The runner refuses another project or origin. It uses the host Docker CLI, the existing ignored synthetic configuration and Compose files. It does not belong to the ordinary browser container suite, whose image has no Docker control. Do not run another mutating scenario on this fixture while the worker is stopped. The generated test report with Secret-filled logins supplies behavioral assertions, not permitted screenshots.

The application commands already own versions, idempotency, transactions and outbox records. The worker owns delivery attempts and receipts. The browser composes those existing responsibilities. Sequential design exploration compared reusing an old failed fixture with controlling the worker around a fresh approval. The fresh path was selected because it also observes the failed attempt and keeps the human decision unchanged. Parallel design diversity was reduced to preserve the remaining independent release-review capacity. No independent review is claimed by this owner run.

Build the Lever changed a manual multi-role demonstration into a guarded repeatable browser check. Model the Domain keeps approval, delivery and accounting separate. Prove It Works requires real server reads after each visible result. The material risk is leaving a stopped worker or a second approval behind. The `finally` check restores the same running container, and request history equality rules out another human decision during recovery.

Public HTTPS delivery, real 1C, real Documentolog, payments, signatures and independent release acceptance remain separate.
