# JanaMen product specification

## Product outcome

JanaMen gives an employee one place to understand a work obligation, act on it and see the result.
The first connected journeys cover leave, salary advance, assigned learning and questions about HR instructions.
Managers act within their teams. HR maintains content and handles the human decisions and gaps that require it.

The user explicitly requests a complete populated product. Thirty courses, varied employees, request histories and knowledge cases are design inputs.
A small demo-only dataset is not the target.

## Source precedence

The organizer's supplied Digital HR Platform JanaMen PDF is the original brief.
The user also supplied a longer organizer-report transcript. Its added details include request filters, an explicit quiz, RAG, synthetic data and a prohibition on AI personnel decisions.
The full second PDF and its revision date were not available. This specification adopts the stronger compatible requirements and records decisions rather than inventing an official revision.
The public event page confirms the two alternative tracks: https://terricon.kz/ru/hackathon.
Jana Address offline inference, throughput and mandatory Docker rules do not automatically apply to Digital HR.

### Organizer requirements and acceptance

| ID | Requirement | Observable acceptance |
| --- | --- | --- |
| AUTH-01 | At least employee, manager and HR roles | The same data resource is readable or denied according to server permissions. |
| AUTH-02 | Restrict access to permitted people | A manager cannot list, open or mutate another team's record by changing an id. |
| PROFILE-01 | Employee profile | Name, position, legal entity, department, manager, hire date and official leave balance are present. |
| PROFILE-02 | Official facts are read-only | Attempts to PATCH official profile facts fail or no write route exists. |
| REQUEST-01 | End-to-end request | Creation, submission, human decision, status and history persist across sessions. |
| REQUEST-02 | My requests | Search/filter list, date/type/status and a detail card expose the same underlying record. |
| LEARN-01 | Academy catalogue and assignments | Employee can find relevant courses and resume an assignment. |
| LEARN-02 | Material and assessment | Server records lesson progress and quiz result in the employee profile. |
| AI-01 | Knowledge-based answers | Supported answers cite accessible document revisions and exact excerpts. |
| AI-02 | Honest lack of evidence | Unsupported questions get a clear refusal and an HR escalation action. |
| NOTIFY-01 | Notifications | Request decisions and learning events generate owner-scoped notifications. |
| MOCK-01 | Future integration design | Explicit interfaces identify 1C employee import and Documentolog export. |
| DATA-01 | Synthetic data | Seed records and documents are fictional and labeled as demonstration content. |
| DELIVER-01 | Reproducible delivery | Backend, source code, README, role access instructions, architecture and demo instructions exist. |
| I18N-01 | Localization readiness | API uses stable codes, separate translated content and language metadata. |

The prototype does not decide personnel outcomes through AI. All approval commands require an authorized human session.

## Product extensions chosen for JanaMen

These choices expand the organizer baseline. They are not claims about Jana Post's current rules.

- Implement both leave and salary advance.
- Use manager review followed by HR confirmation in the demonstration policy.
- Preserve submission revisions and actor-stamped decision history.
- Show official balance, data freshness and a separately labeled leave projection.
- Surface pending work across requests and learning through a common workbench contract.
- Give HR a queue of unresolved knowledge questions.
- Keep course publication, assignment, learning completion and quiz success separate.
- Preserve historical learning results when a course is archived or revised.
- Expose integration delivery status separately from the business decision.
- Use 30 distinct courses and substantial synthetic organization/request/document data.

## Actors and scope

### Employee

Reads its own official profile, learning assignments, request history, notifications and accessible policies.
Creates, edits and submits its own requests.
Completes its own lessons and attempts.
Can explicitly ask HR to resolve a knowledge gap.
Cannot change ownership, scores, roles, published policies or an approval.

### Manager

Has the employee capabilities for itself.
Reads its direct team's permitted profile and learning information.
Receives assigned review tasks. Reviews the snapshot actually submitted.
Cannot approve its own request.
Cannot expand the scope by supplying a department, employee or legal-entity id.

### HR

Has the employee capabilities for itself.
Handles permitted employee requests and content for its legal entity.
Publishes policy revisions and learning content.
Assigns courses and follows learning results.
Works with unresolved knowledge cases.
Official staff facts remain owned by the integration source.

### Technical operator

Uses controlled administrative access for environment operations and synthetic account provisioning.
It is separate from the business role. Admin access does not establish a legal HR decision.
Operator access and seed credentials are documented as demonstration access.

## Request behavior

An employee saves a draft, checks its meaning, then submits it.
Submission freezes the payload, assigned manager and policy context for that revision.
A request has a server version. Editing a stale version returns a conflict and preserves both actors' data.
The server exposes allowed_actions so the client can explain available decisions.

Reviewers can approve, reject or return for correction when the state and assignment permit.
Rejection and return require an explanation.
Returning permits a revised submission while retaining the old snapshot.
A manager decision advances to HR in the demonstration workflow.
HR's final approval records a business decision and queues export. Export success never asserts that a payment occurred.

An employee can cancel a draft or a pending request.
An already approved request is retained. Its cancellation needs a separate defined amendment policy, not a delete button.

For leave, validate ordered dates and conflicting active requests.
Compute the demonstration day count by the documented convention.
Do not portray that convention as Kazakhstan employment law or an official Jana Post policy.

For salary advances, validate positive decimal money, currency and payment date.
The action records a request and human decision. Payroll posting and bank payment are outside the demonstrated connector.

## Learning behavior

The catalogue supports categories, search and filters.
An employee has a personal learning view that distinguishes assigned, started, completed and overdue records.
Due date, availability, completion and score are separate attributes. A completed course can later be unavailable.
Progress reflects server-accepted lesson completions. A learner cannot set its own progress percentage.
The learner sees questions and choices without answer keys.
An attempt records the published question version and received answers.
Scoring follows the fixed course-version threshold.
Failed attempts preserve completed lessons and expose whether another attempt is allowed.
Completion creates an event, notification and profile result.

HR can create draft content, publish a version and assign it to scoped employees.
Publishing a new version leaves existing assignment evidence intact.
Managers see aggregate and individual progress only within their allowed team.

## Knowledge behavior

Knowledge is published HR content, not anything an employee tells the chatbot.
Each answer identifies its response mode and sources.
Opening a source resolves an existing document revision that the user can access.
The assistant cannot use a manager-only or another-entity document to answer an employee.

A generated answer requires a configured model adapter and retrieved evidence.
The no-key mode is extractive: it quotes retrieved material and is clearly labeled.
A failure to retrieve, a provider outage and an unsupported question are distinct states.
The system must not disguise one as a successful generated answer.
An employee chooses whether to create an internal HR knowledge case.
HR can resolve the case, cite a policy or publish a correction through its ordinary permission checks.

## Notifications and workbench

A notification describes an event. A task requires an action.
Marking a notification read does not approve a request or complete a course.
Workbench items provide a resource, reason, owner, due date where relevant and allowed next action.
Ordering rules must be explicit and understandable. Avoid unexplainable AI priority scores.
Follow-up navigation takes the employee to a current record, including a useful state when the action was already handled.

## Content and localization

Use Russian for the initial complete content set.
Prepare Kazakh translations for navigation labels and representative content through the localization contract.
Never infer a legal rule from translation or invent a regulation to fill an empty page.
Professional-product references inform behavior and quality. Their text, courseware and private assets are not copied into the seed.

## Acceptance surfaces

The backend proves state and permissions through API and database tests.
The next frontend agent proves discoverability, form completion, keyboard access, mobile reflow, screen-reader naming and readable status feedback in a browser.
Passing backend tests does not close those frontend acceptance items.

