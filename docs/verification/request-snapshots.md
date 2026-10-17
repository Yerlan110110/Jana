# Readable submitted request versions

18 October 2026. Scope is the saved facts in request detail for leave and salary advance. This is a verified feature checkpoint, not complete product acceptance.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `frontend/src/features/requests/detail.tsx` | An employee opens a submitted version and receives raw JSON, internal field names and identifiers. | Existing native definition lists show the submitted person, request type, dates or money, reason and explicitly synthetic review convention. | The employee can read what was sent without interpreting a transport format. Current editable values never replace earlier submissions. |
| MEDIUM | Request reviewer row | The row identifies only the assigned role; another disclosure exposes a UUID. | Use the existing session's person name when its ID matches the saved assignment. Otherwise retain the assigned-role label. | The next actor is clearer without inventing a name or replacing an old assignment with the current manager. No reassignment capability is added. |

The only production snapshot writer already saves sixteen fixed fields. `RequestSnapshotSerializer` describes that existing shape through drf-spectacular 0.30.0. The method field returns the saved JSON unchanged. The generated OpenAPI and API client replace `unknown` with this schema. There is no handwritten frontend duplicate, migration, new write endpoint or changed idempotency response. Decimal strings remain strings. The existing summary formatter now uses Russian day units instead of displaying `1.00 дней`.

This reuses the native disclosure, `Facts`, `RequestSummary` and the established responsive grid. The [Frappe mechanism study](../research/journeys-reuse.md) already motivates keeping submitted facts and the approver visible. The [drf-spectacular customization contract](https://drf-spectacular.readthedocs.io/en/latest/customization.html#step-3-extend-schema-field-and-type-hints) supports a serializer annotation on a method field. No new component library or third-party source copy is needed.

## Observable checks

The real browser RED is `.artifacts/snapshot-readable-red-20261018-1.log`. It creates and approves an advance after a return and resubmission, opens the first submitted version and fails because its readable `Причина` field is absent. The retained request is `9928cc4b-a3a4-4805-820b-151fd24cb4db`. The failure is an actual assertion, not a setup failure.

The same role journey passes at `.artifacts/snapshot-readable-green-20261018-1.log`. It checks the original reason in submission one and the corrected reason in submission two, then completes the leave journey and reads its submitted reason. The full suite additionally compares the displayed manager name with the authenticated employee's real manager data.

The read-only visual check at `.artifacts/snapshot-visual-20261018-2.log` passes with its employee setup. It reads real completed requests and checks every returned revision against the generated API. Native Enter opens each disclosure. All six saved 1280px and 320px images were opened. The three native 200% submitted-version images under `.artifacts/browser/snapshot-native-zoom-20261018-1/captures/submitted-1792275894877/` were also opened. The narrow images preserve readable labels, names, dates, amounts and reasons. Some desktop images capture part of the surrounding history; these are viewport regions, not full-page inspection.

The current complete normal-view run passes twelve tests at `.artifacts/snapshot-matrix-20261018-1.log`, including all 31 views at five widths and the expanded-version check. It saves 155 inventory records and 587 overlapping inventory segments. The native run passes ten tests at `.artifacts/snapshot-native-zoom-20261018-1.log`, with 31 inventory records and 310 inventory segments plus the expanded versions. These are automated coverage counts. Full visual/state acceptance remains open.

PostgreSQL passes 232 tests with 193 retained warnings at `.artifacts/request-snapshot-postgresql-20261018-1.log`. Both request kinds exercise immutable revisions. The JSON read through the API equals each persisted payload. The current compiled frontend matches all 30 served files at `.artifacts/request-snapshot-format-build-identity-20261018.json`. Contract generation/checking, frontend and browser types, build, backend style, migration, pinned-skill and report-safety checks pass in the `request-snapshot-*` logs.

## Retained browser fixture failure

The first full regression has thirteen passed tests and one failed test at `.artifacts/request-snapshot-browser-regression-20261018.log`. Its unrelated knowledge assertion matches nine history headings with the same question while the route changes. The trace records zero assertion reads before the ambiguity failure. The test now waits for the actual level-one page heading. It preserves the exact question, citation title and source-content assertions. No delay, data deletion or application change repairs this fixture. The focused check passes at `.artifacts/knowledge-heading-green-20261018-1.log`. The subsequent full regression is recorded separately rather than replacing the failed run.

The repaired full Docker run passes all fourteen tests at `.artifacts/request-snapshot-browser-regression-20261018-2.log`. It includes the actual named-reviewer assertion and both readable submission histories. Fresh API replacement also passes at `.artifacts/request-snapshot-nginx-replacement-20261018.json`; the API address changes from `172.29.1.3` to `172.29.1.5` while the current frontend container and its start time stay unchanged. Both GitHub jobs for the preceding zoom-tool checkpoint `e7d2d97` pass at https://github.com/Yerlan110110/Jana/actions/runs/39074695521. That remote run predates this request feature.

Type System Discipline changed the contract into a generated snapshot model. Laziness Protocol reused the existing presentation components. Jakub's writing and layout rules replaced internal terminology with submitted facts and allowed long values to wrap. Emil's frequency rule retains immediate native disclosures without decorative motion. None of these checks is an independent release review or a screen-reader walk.
