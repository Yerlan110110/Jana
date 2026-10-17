# Verify employee workflows over HTTP

Use `python3 scripts/verification/web_build.py --url http://127.0.0.1:8090 --output .artifacts/web-build-<unique-run>.json` after compiling the frontend to compare every local compiled file with the running web server. The command writes a new hash record and returns 1 for any missing or different served file. It refuses a missing local index. This proves file identity, not browser behavior or a complete deployment.

For native browser zoom, use the separate [zoom verification recipe](../../.agents/skills/verify-janamen/SKILL.md#native-zoom). The [calibration record](../../docs/verification/native-zoom.md) explains its evidence and screenshot limits.

Use `smoke_workflows.py` against a local JanaMen demo to verify persisted workflows through the real API. The runner uses Python 3.11 or newer and the standard library. It does not import Django or use its test client.

## Run the complete check

1. Start the API with the complete synthetic dataset. Use the setup commands in the [project README](../../README.md). Keep the credentials JSON produced by `seed_demo` private.
2. Start the outbox worker against the same database. From `backend`, run the following command in another terminal.

   ```bash
   uv run python manage.py process_outbox --watch
   ```

3. From the repository root, run the smoke check.

   ```bash
   python3 scripts/verification/smoke_workflows.py \
     --base-url http://127.0.0.1:8000 \
     --credentials-file runtime/demo-credentials.json \
     --output runtime/workflow-smoke.json \
     --wait-for-exports 60
   ```

4. Read `outcome`, `failure`, and `observations.mock_export_delivery_verified` in the JSON report. A complete successful run has `outcome: "passed"` and `mock_export_delivery_verified: true`.

The terminal prints a short sanitized summary. The file contains each assertion, the created resource identifiers, observed export states, and workbench counts. The runner returns exit code `0` for success, `1` for a failed check, and `2` when the report cannot be saved safely.

If the worker is unavailable, omit `--wait-for-exports`. The runner verifies creation of one outbox entry per final approval and records the available delivery state. A pending export leaves `mock_export_delivery_verified` false. That run does not establish worker delivery.

## Inspect the exercised scenarios

Use the assertion names and `artifacts` identifiers to open the corresponding records in the API.

- Each of the leave and salary-advance journeys creates a draft, edits it, submits it, receives a manager return, edits the returned request, resubmits it, and passes through manager and HR approval.
- The checks exercise CSRF rejection, idempotent replay, conflicting reuse of a key, stale versions, forbidden status assignment, role denials, and hidden records from another legal entity.
- Separate HR and foreign-employee requests test privileged self-approval and entity boundaries. Their owners cancel these new probe requests.
- Academy creates a uniquely coded synthetic course with two required lessons and two questions. HR publishes and assigns it. The employee completes the materials, receives a failed server-scored attempt, retries successfully, and reads the persisted result.
- Learner responses are checked recursively for answer-key fields and an author-only explanation marker. The answers submitted by the runner come from its own newly authored fixture.
- A second publication proves that an enrollment retains its original course version. Archiving this run's course preserves its completed result and attempt history.
- Workbench counts are compared with fully paginated, scoped registries. Preview limits and current `allowed_actions` are checked separately. Notification counts are observed without assuming that asynchronous notifications stop arriving between reads.
- Mock export receipts are checked against the approved immutable request revision. Delivery must preserve the human decision and leave the official source balance unchanged.

These checks establish API behavior. Use the separate `smoke_knowledge_http` command for the knowledge journey. Browser interaction, rendered design, a live language model, real 1C, real Documentolog, payments, and signatures require their own verification.

## Repeat the check without replacing fixtures

Run the same command again. Every run uses new resource identities, command keys, and a course slug. The runner reads existing leave dates and chooses a free future day. It does not edit existing fixture requests, courses, source snapshots, or official balances.

A successful run retains one newly approved day of leave, one approved advance, two cancelled access probes, one archived course with two published versions, and one completed enrollment. Keep those records as evidence. A partial failure also retains the records created before the failed assertion; the report identifies them.

If the selected employee has less than one unreserved day, choose another synthetic employee with an available balance. Keep `--manager` aligned with that employee's actual direct manager. For the unchanged default dataset, another account in the same team is available through this command.

```bash
python3 scripts/verification/smoke_workflows.py \
  --base-url http://127.0.0.1:8000 \
  --credentials-file runtime/demo-credentials.json \
  --output runtime/workflow-smoke-another-employee.json \
  --employee employee.1.warehouse.02.demo \
  --manager manager.demo \
  --wait-for-exports 60
```

Use `--hr` and `--foreign-employee` only when the selected synthetic accounts have the required roles and entity relationship. The runner verifies the credential identities, active profiles, source identifiers, and reporting relationship before creating workflow records.

If login returns `429` with a bounded `Retry-After`, the runner waits for that interval and retries once. Other unexpected HTTP failures stop the journey and produce a partial report. Inspect the named assertion and the local API logs before rerunning.

## Keep the run local and the report safe

Use an HTTP origin on `127.0.0.1`, `localhost`, or `[::1]`. The runner maps `localhost` to `127.0.0.1` to avoid a DNS lookup. It refuses other hosts, URL credentials, base paths, queries, and fragments. Redirects and environment proxy settings are disabled. Pagination links must remain on the original loopback origin.

Use a credentials document marked `synthetic: true` from this demo. Passwords, cookies, CSRF values, command keys, raw response bodies, and raw exception messages are excluded from the report. The output cannot replace the credentials file or a symbolic link. Reports are written atomically with private file permissions.

Treat the generated API in [contracts/openapi.yaml](../../contracts/openapi.yaml) as the endpoint and payload authority when updating this runner. Its explicit scenario methods retain the actual roles and state transitions. They share only HTTP session handling, pagination, assertions, and report output.
