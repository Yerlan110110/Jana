# Journeys author handoff

Author snapshot, 17 October 2026. This report covers the Requests, Academy and people feature modules. It is not an independent release review.

## Workspace and scope

Both `pwd -P` and `git rev-parse --show-toplevel` returned `/home/yqecea/.t3/worktrees/jana/t3-4351e3c7`. The starting tree was clean at `808e0c6`. Fetch completed. This branch has no upstream and the remote advertised no branch to compare. The parent checkout was not edited.

Owned changes are under `frontend/src/features/`, this report, and [journeys-reuse.md](../research/journeys-reuse.md). The one authorized shared integration was the coordinator's `c678c42`, cherry-picked as `0226698`. No shared file was authored here. No manifest, lockfile, generated schema, backend, router, shell, global theme or HANDOFF change was authored. Nothing was pushed.

Research was committed before view composition. The [reuse record](../research/journeys-reuse.md) cites the first-party Frappe and Moodle sources and the pinned Pace audit. Full platforms were rejected because they duplicate the existing backend and session ownership. Safe installed controls and native forms supply the interaction mechanics.

## Exports and routes

All exports are named React components without required props.

| Module | Export | Route |
| --- | --- | --- |
| `features/requests.tsx` | `RequestsPage` | `/requests` |
| `features/requests.tsx` | `RequestCreatePage` | `/requests/new?type=leave` or `?type=advance` |
| `features/requests.tsx` | `RequestDetailPage` | `/requests/:id` |
| `features/requests.tsx` | `RequestQueuePage` | `/team/requests`, optional `?kind=hr` and `?employee=:id` |
| `features/academy.tsx` | `AcademyPage` | `/academy` |
| `features/academy.tsx` | `CatalogPage` | `/academy/catalog` |
| `features/academy.tsx` | `CoursePage` | `/academy/courses/:id` |
| `features/academy.tsx` | `LearningPage` | `/academy/enrollments/:id` |
| `features/academy.tsx` | `QuizPage` | `/academy/enrollments/:id/quiz` |
| `features/academy.tsx` | `AttemptPage` | `/academy/attempts/:id` |
| `features/academy.tsx` | `LearningHistoryPage` | `/academy/history` |
| `features/academy.tsx` | `ManageCoursesPage` | `/hr/courses` |
| `features/academy.tsx` | `CourseEditorPage` | `/hr/courses/new` and `/hr/courses/:id` |
| `features/academy.tsx` | `AssignLearningPage` | `/hr/assignments` |
| `features/academy.tsx` | `TeamLearningPage` | `/team/learning`, optional `?employee=:id` |
| `features/people.tsx` | `ProfilePage` | `/profile` |
| `features/people.tsx` | `TeamPage` | `/team` |
| `features/people.tsx` | `EmployeePage` | `/team/:id` |

Every top-level module imports `journeys.css`. The integrator supplies the router and existing `SessionProvider` and query provider. Feature styles use only `rq-`, `ac-` and `people-` classes. Common layout classes are the coordinator's supplied contract.

## Behavior and ownership

Request forms use separate leave and advance payload shapes. Create saves a draft, then the detail exposes submission. Returned forms preserve the comment and prior snapshots. Unsaved edits must be saved before submission. Commands use the generated client and `useCommand`. The values include every body field, `expected_version`, action and target ID. Uncertain retry uses the original mutation variables. Decision confirmation captures the version when opened. A refresh requires a new confirmation. Stale forms keep local fields while adopting the explicitly refreshed server version.

The queue sends `needs_my_action=true` before server pagination. Own lists send the current session employee. Commands are rendered from `allowed_actions`. Fulfillment renders approval, document delivery and source accounting independently. Official balance and portal projection have separate labels and a source date. Exact server snapshots remain available as JSON disclosures. History includes the actor, comment, submission, version and local date/time.

Academy uses real server pagination, category and language filters. Enrollment completion, overdue state and failed attempts remain independent. Material navigation never completes a lesson. Only the completion command does so. Quiz questions come from the learner API and submit selections to the server. Results use server scores and retain earlier attempts. HR forms create and edit structured lessons, options and questions. Publication creates a revision. Archive and restore use their real endpoints. Assignment selects one actual employee and one actual published revision. No bulk success or self-enrollment is invented.

Profile facts are read-only. Team and employee detail use scoped APIs. No localStorage personnel state, alternate authentication, backend, or answer key was added to learner code. Cached forms survive transport refresh failures. Access-denial responses remove inaccessible cached detail.

## Checks and evidence

Durable raw evidence is in this worktree's `.artifacts/journeys/`. It must be preserved before the worktree is archived. These ignored files are not in the commits.

The checkout did not contain either `node_modules` directory despite the task's starting assumption. `npm ci --ignore-scripts --no-audit --no-fund` and its frontend equivalent restored the existing locked dependencies. No lockfile changed. Backend dependencies were restored with `uv run --project backend --frozen`. The runtime used Python 3.13.13, not the CI's Python 3.12.

| Check | Observed result | Evidence |
| --- | --- | --- |
| `npm --prefix frontend run typecheck` | Passed after final source review | `typecheck-final.txt` |
| `npm run typecheck` | Passed for generated client and frontend | `typecheck-root-final.txt` |
| Feature Vite production bundle | Passed for actual modules and shared controls in the isolated entry | `feature-bundle.txt` and `harness-build/` |
| `git diff --check` | Passed | Author command log in this task |
| Django system check | Passed | `backend-check.txt` |
| Separate synthetic migration and seed | 58 employees, 30 courses and varied request/enrollment fixtures | `migrate.txt`, `seed.txt` |

The feature bundle retained warnings about optional Vite config imports and its single all-routes chunk over 500 kB. This is the test entry with static imports, not a measurement or claim about the coordinator's production route splitting.

The feature browser entry under `harness/` mounts the real exports and shared session/query code. It adds a test login and route list only. Its API used a separate SQLite database on port 8091. Vite used port 5191. No parent runtime or production database was changed.

The T3 preview ran these functional paths. The recorded browser observations and API access log support each item.

| Browser path | Observed result |
| --- | --- |
| Full catalogue | 20 courses on page one and 10 on page two. Server total 30. Page two had document width 320 at viewport 320. |
| Advance | Employee create and submit, manager return with comment, employee edit and resubmit, manager approve, HR approve. Two submitted snapshots and retained comment/history. |
| Leave | Employee create, edit, submit, manager approve and HR approve. Delivery remained queued and source accounting remained unconfirmed. |
| Unknown create response | A test middleware threw after the server committed. Fields stayed visible. Exact retry reused the same body and key, returned the same record ID and left one creation history entry. This is an injected response-loss test, not a physical network outage. |
| Stale request edit | A separate API command advanced the record. UI save returned 409. Local text survived the conflict and explicit refresh. The next save used the refreshed version. |
| Final-source cancellation | A synthetic draft was cancelled through the current confirmation flow. Status and timestamped history changed to cancelled. |
| HR authoring | UI created a course with a real lesson and question, saved and published it, and assigned the published revision to an actual employee. |
| Quiz prerequisites | Before lesson completion, the quiz showed the prerequisite and no answer radios. |
| Lesson completion | The real command persisted one of one required materials. Reloading the quiz exposed the questions. |
| Quiz results | Wrong selection returned server score 0 and an incomplete enrollment. Correct selection returned 100 and completed the enrollment. The earlier failure remained visible. |
| Immutable history | HR edited, saved, published revision two and archived the course. The employee's original revision-one result and both attempts survived. An unhinted own attempt URL resolved through scoped reads. |
| Learner payload | Actual learner content response contained neither `correct_option_id` nor author explanations. |
| Profile | Actual profile showed source revision, balance date and synchronization time. It had zero editable controls. |
| Team boundary | Manager list loaded nine scoped records. A known employee from the other legal entity returned a non-disclosing unavailable state with zero fact sections. |

Files are `browser-observations.json`, `browser-final-scope.json`, `browser-final-recheck.json` and `api.log`. `catalogue-harness-1280.png` is a rendering observation of the feature entry. It is not final-product visual acceptance. The feature entry lacks the coordinator's new global layout and shell.

Failed evidence remains. `typecheck-initial.txt` records missing Vite types. `typecheck-requests.txt` records missing root contract dependencies. The other failed typechecks record the corrected literal-widening and command-envelope errors. `api-start-during-seed-failed.log` records a SQLite startup lock when the API was first launched before seed finished. `vite.log` retains the initial artifact-entry import-resolution failure. The test configuration then explicitly resolved the installed frontend packages. A login attempt before the API restart and a stale login-button click also failed in T3 tool history. No failed check was counted as passing.

## Review boundaries and remaining gates

Standards self-check found no `any`, unsafe cast, suppression comment, local personnel persistence, extra dependency or ownership escape in authored source. This is author review. Independent review remains `BLOCKED: independent review` under the explicit no-child-agent restriction.

Spec implementation covers the named route exports. The browser evidence establishes the functional paths above, not every state combination. Manager/HR rejection, HR return, leave return/resubmit, archive restore, failed course writes, all filter combinations, every empty/loading/permission state and team-learning aggregation were not exercised in this browser run. Their source paths exist and use the real API; they remain runtime checks for the coordinator.

| Interface domain | Inspected evidence | Boundary |
| --- | --- | --- |
| Accessibility | Native controls, wrapping labels, radio fieldsets, status text, actual errors and native navigation links | Full keyboard and screen-reader walks remain open. |
| Layout | Feature CSS uses wrapping rows, flexible grids and a collapsing material outline. Catalogue and profile had no horizontal overflow at 320 in the feature entry. | Final shell at 320, 390, 768, 1280 and 1440 and 200% zoom remain open. |
| Writing | Labels name real commands. Errors have visible recovery. Approval, receipt and accounting have distinct wording. | Server-provided validation strings remain shared-backend copy. |
| Typography | Material text wraps at 72ch. Facts wrap long values. Numeric summaries use tabular figures. | Final fonts, Kazakh glyph rendering and computed sizes depend on the coordinator's global theme. |
| Color | Only supplied semantic tokens are used. States include text. | Rendered contrast in the complete product was not measured. |
| UI and motion | Installed safe controls are reused. No feature entrance or decorative motion was added. | Whole-product visual acceptance and physical touch behavior remain open. |

The main assumption is that the coordinator integrates the documented providers, routes and global classes. The material risk is that feature behavior can pass while the integrated shell clips a control or changes focus. The observed native link correction demonstrates why that integration gate remains necessary.

No change to shared source is required for these exports to typecheck. Suggested coordinator follow-ups are contextual handling for non-version 409 errors in the shared `ErrorNotice`, and final-shell verification through `verify-janamen`. The shared notice currently describes every 409 as another-tab change, although duplicate course slug and archived course commands also use 409.

Attempt links include `?enrollment=:id` for one scoped lookup. Without that hint, own attempts are found through paginated own enrollments. A team attempt without the hint cannot be resolved from the current standalone API. All team links generated here include it. A direct attempt resolver would remove that lookup cost, but no backend change was made. Lesson text is safely displayed as preformatted plain text; rich Markdown rendering is not added.

No Docker, PostgreSQL concurrency, public deployment, final application production build or external HR integration pass is claimed. The local feature bundle is a separate artifact. No CI or push was started.

## Skills that changed decisions

Read paths include `.agents/skills/fstack/SKILL.md`, `.agents/skills/emil-design-eng/SKILL.md`, `.agents/skills/better-interface/SKILL.md`, `.agents/skills/pick-ui-library/SKILL.md`, the owning better-accessibility, better-layout, better-writing, better-typography, better-colors and better-ui files, and the local poteto-mode Codex mapping. The active poteto entry was `/home/yqecea/.codex/plugins/cache/t3-pstack/t3-pstack/2.0.0-rc.7/skills/poteto-mode/SKILL.md`; its complete agent persona was also read.

Emil's frequency rule removed decorative motion. Jakub's native-control and visible-recovery rules selected native forms, labels and persistent errors. Pick UI Library kept installed Base UI controls and native selects. Model the Domain supplied separate request payload variants and independent learning states. Type System Discipline supplied generated `Model` and operation types. Make Operations Idempotent supplied exact-intent retries. Architect compared a generic schema-form engine with direct feature forms; direct forms exposed the actual commands with less indirection. Technical Writing and Unslop shaped this cited handoff and task-first UI labels. Deslop removed casts and kept the small shared foundation. No independent no-comments or architect panel ran because child delegation was explicitly forbidden. No authored source comments or suppressions were added. The research skill ran in-thread for the same restriction.

## Commits and retention

Authored completed commits before this report are `6038ac4` for research, `c894bde` for requests/people, and `c803bac` for Academy and the navigation seam migration. The authorized shared cherry-pick is `0226698`, equivalent to coordinator commit `c678c42`. The following source-recovery and handoff commit is identified by this report's Git history.

The coordinator can integrate authored commits without reapplying the shared commit it already owns. Keep this worktree, the ignored SQLite fixture and evidence until the coordinator has retained the needed artifacts and verified integration. The feature test API and Vite processes are owned by this task and are stopped at handoff. No installed application or personal file is a cleanup target.

Dispatch ledger. Research, architecture sketch, implementation and author verification ran in-thread on the parent model because the user explicitly prohibited child agents. Independent review did not run.
