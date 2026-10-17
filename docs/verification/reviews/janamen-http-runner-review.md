# Independent HTTP workflow runner review

## Verdict

Approve the corrected runner within this review's scope. Two confirmed defects were reported to the coordinator, fixed by the coordinator, and independently rechecked. No finding remains open.

The reviewed final `scripts/verification/smoke_workflows.py` has SHA-256 `b29785b0427714209f0cc2d54eddb1f8da91556701fe05374efa3941ce8330be`. The reviewed README has SHA-256 `4770648b0430148e4339aa5343250a0f3ee5bee09a866b8dd230fd8f82c033e4`.

This reviewer made no shared-tree edits or commits. I did not repeat either complete mutating JanaMen run. My additional checks used private temporary files, injected failures, and temporary loopback HTTP servers. No actual JanaMen request was needed for those additional checks.

## Scope

I read the complete workflow runner and its README. I inspected the two existing reports, checked their structure and assertion counts, and compared the scenario claims with the source. I also reviewed the coordinator's report-safety tests and the new CI command.

The review covered destination restrictions, redirects, environment proxies, session handling, generated resource identities, secret handling, output-file safety, failure handling, and the meaning of the recorded evidence. It did not repeat the full backend audit or a browser review.

## Confirmed findings and closure

| Finding | Initial impact | Correction and independent result | Status |
| --- | --- | --- | --- |
| F1, high. Argument failure bypassed output protection. | `main()` validated timing arguments before checking whether output aliased the credentials file. With `--request-timeout 0` and the same input/output path, it wrote the failure report over the credentials. A private temporary reproduction returned exit code 1, changed the original file, and made zero HTTP requests. | `validate_report_path` now runs before other work and again inside `write_report`. Eight probes covered the same path, a symlink, a hardlink, and a parent-symlink alias, each with valid and invalid timing. All returned exit code 2 and preserved the original credentials. | Closed. |
| F2, medium. Unexpected cleanup exceptions escaped sanitization. | `logout()` caught only `SmokeFailure`, and `main()` called it in `finally` outside the generic error guard. An injected unexpected exception propagated with a sensitive sentinel and prevented report creation. | Per-session cleanup now records sanitized exception metadata, preserves an earlier failure, continues other sessions, and clears local cookies and CSRF state. An outer cleanup guard also preserves report writing. Three independent injected-failure cases saved private reports without the sentinel. | Closed. |

F1 was first rechecked on source SHA-256 `e6aa129af928293589490498e9b552afa7fc5bda6b83be24108c9a16b695ee18`. F2 and the final report-safety suite were rechecked on the final source hash above.

The F2 checks exercised an unexpected per-session cleanup exception, an existing workflow failure followed by cleanup failure, and an unexpected failure of the outer cleanup method. Each returned exit code 1 and saved a report with mode `0600`. The per-session cases attempted the next logout and cleared both cookie jars and both CSRF values. The existing workflow failure remained the reported failure in its case. No raw sensitive sentinel appeared in the report, standard output, or standard error.

## Existing run reports are consistent with the source

| Report | Run ID | Assertion evaluations | Unique assertion names | Recorded HTTP requests | Export result |
| --- | --- | ---: | ---: | ---: | --- |
| `runtime/workflow-smoke-first.json` | `41b0ee0a7dcf4c2f930c9fa90add1abb` | 807 passed of 807 | 661 | 190 | Two processed exports. `mock_export_delivery_verified` is true. |
| `runtime/workflow-smoke-repeat.json` | `1244b7f6b0d7453ea5861d0899643b5c` | 807 passed of 807 | 661 | 190 | Two processed exports. `mock_export_delivery_verified` is true. |

These are 807 assertion evaluations per run, not 807 distinct test cases. Status checks, JSON shape checks, pagination checks, preview checks, and repeated role or lifecycle observations all contribute to this count. The README calls them assertions and does not claim that they are distinct tests.

The reports' `total` values equal the actual check-list lengths. Their `passed` values equal the number of true results. Both have no failure and contain the expected newly created request, course, enrollment, and export identifiers. Both files have mode `0600`.

The first report's SHA-256 is `e991cfe3f5d588a4ee47420f71635050a6c7b147974fb37973a840fd317e7ef6`. The repeat report's SHA-256 is `38aaf105b148e5b359f0ee9a556544e1af63f60a109a49a5f852ff2318d7b816`.

I inspected these existing reports and the code that generates them. The author and coordinator own the evidence that the original two runs reached their live Gunicorn, PostgreSQL, and worker processes. This audit does not relabel those runs as my own execution.

## Scenario claims match the implemented runner

Both request kinds exercise draft creation, editing, submission, manager return, correction, resubmission, manager approval, HR approval, and a subsequent read of persisted history. The runner checks immutable first revisions, consecutive history versions, idempotent replay, key conflicts, stale writes, forbidden status assignment, CSRF denial, self-approval denial, and foreign-entity hiding.

The access probes create new requests owned by the selected HR and foreign employee. Their owners cancel those probe requests. The runner does not approve an unrelated seeded request.

Academy uses a newly authored course identified by the run ID. It publishes and assigns that course, completes its two required lessons, submits a known wrong answer set, then submits the fixture's correct answer set. It checks server-scored results, persisted attempts, hidden answer-key fields, a hidden author-only sentinel, assignment scope, a pinned course revision, and history after archival. This is a dedicated API verification fixture. It does not replace the project's 30-course content requirement.

The workbench checks compare full scoped registries against counts and use detail reads to verify current actions. They check bounded previews separately. Unread notification counts are checked for a valid nonnegative shape without pretending that asynchronous delivery stops between reads.

The integration check requires exactly one outbox entry for each of this run's two final approvals. If the worker is awaited, it verifies processed state, the mock provider, the accepted attempt, and the matching immutable request revision. The human decision history and official balance must remain unchanged. With no wait option, a pending export is recorded with `mock_export_delivery_verified: false`, as the README explains.

The runner does not claim knowledge retrieval, model-provider quality, a rendered interface, real 1C or Documentolog compatibility, payroll payment, or a legal signature. Those exclusions appear in both source and documentation.

## Destination and mutation checks

`loopback_url` permits HTTP origins on `127.0.0.1`, `localhost`, and `::1`. It maps `localhost` to the numeric loopback address. It rejects URL credentials, non-loopback hosts, non-HTTP schemes, base paths, queries, fragments, invalid ports, and control characters.

`HTTPSession.target` keeps API and pagination requests on the original scheme and authority. I ran 25 pure origin and pagination probes. All accepted or rejected the expected cases and made zero HTTP requests.

I also exercised the actual urllib opener against temporary loopback servers. The origin returned a redirect to a different local port while environment proxy variables pointed to a separate local proxy. The runner received status 302. The observed request counts were one at the origin, zero at the redirect destination, and zero at the proxy. This verifies that redirects and environment proxy settings were disabled in the tested opener.

Before workflow creation, the runner checks the credentials document's synthetic marker, distinct account names ending in `.demo`, expected roles, active profiles, matching credential and server employee IDs, `SYN-<username>` source identifiers, the direct manager relationship, and entity relationships. These are explicit demo conventions. They are not cryptographic attestation of an arbitrary server.

Positive mutations use this run's newly created request, course, and enrollment identities. Permission probes intentionally send writes that the backend must reject, including a write to the selected synthetic employee's official balance. A successful run checks that the official balance did not change. As with any negative authorization test, a defective server could apply a write that the runner expects to reject. The synthetic account and loopback restrictions confine that possibility to the selected demonstration environment.

## Secret and report handling

Passwords are sent only to the selected loopback login endpoint. The report does not copy credential payloads, cookie jars, CSRF tokens, command keys, arbitrary response bodies, or raw exception messages. Assertion evidence keywords in the source are HTTP status and expected status. Other observations are chosen counts, identifiers, states, and synthetic leave figures.

I compared the known password values in the local demo credentials document with both report files without printing those values. No password value was found. This supports the two inspected files and the source's selected report fields. It is not a claim to have detected every possible secret pattern.

Output protection now runs before work and immediately before report creation. Atomic replacement uses a private temporary file in the destination directory. The fixed alias probes preserved input bytes, and failure reports had mode `0600`. A report that cannot be saved safely returns exit code 2 without printing its raw contents.

## Executed regression gate

```sh
python -m unittest discover -s scripts/verification/tests -v
```

The command passed two test methods in 1.281 seconds. The first method contains eight alias and timing subcases. The second verifies a separate safe failure report, unchanged input credentials, zero HTTP requests, and private output permissions. The CI workflow invokes this same command.

The reviewed test file has SHA-256 `51539658cf5e3f1a57505074ae2ba2732c71dc203a9ca127573de7785bf6fd14`.

## Limits

No full mutating workflow rerun was needed to verify these fixes. The original 807-assertion reports predate the report-safety changes. The additional probes verify the corrected failure paths without claiming a new full success run.

I did not launch a browser, build containers, call a live model, or contact real integration providers. Filesystem alias checks were exercised in private temporary directories. This review does not certify behavior under a hostile concurrent filesystem actor.

Pstack investigation, domain and boundary guidance informed the scope and the executable failure probes. Fstack's evidence discipline informed the distinction between API checks and rendered UI behavior. The report preserves the difference between assertion counts, test methods, observed results, and unexecuted gates.
