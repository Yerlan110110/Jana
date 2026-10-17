# Frontend API integration guide

This guide explains how the future frontend uses the backend contract.
The generated OpenAPI file is authoritative for endpoint names and serialized fields. Refresh it after backend changes.
Product screen and state specifications live in docs/design.

## Authentication

Use Django session cookies with credentials included.
Request the CSRF endpoint before the login POST. Send X-CSRFToken with every unsafe request.
Refresh the token after login because login rotates CSRF state.
A frontend development origin must be explicitly listed in backend configuration.
Use a same-origin reverse proxy in deployment so the session boundary is understandable.

Do not store a copied role or employee id as an authorization source.
Read the active session and profile from the backend.
Logout clears the server session. Clear client caches belonging to that identity.

## Resource identity

Domain identifiers are UUID strings.
Dates and timestamps are distinct. Treat a date as a calendar value rather than parsing it as an arbitrary timezone timestamp.
Money and decimal balances are decimal strings.
Status codes are stable machine values. Translate them in locale resources, never by changing the API enum.
Source revisions and record versions are meaningful identifiers. Preserve them in commands and evidence views.

## Reading lists

List endpoints expose pagination, search and supported filters.
Scope is enforced before pagination and filtering.
A filtered empty result is different from an empty personal collection.
Keep the selected filters in the URL when that makes browser navigation useful.
Do not infer the total by the number of entries on the current page.

## Performing commands

The backend returns allowed_actions for records with a workflow.
Use this information to offer actions, but expect the command to check again.
Send the current expected version with edits and decisions.
Use a new Idempotency-Key for a new user intent. Reuse that key for a retry of the same intent and payload.
Disable duplicate submission while a request is pending, but do not rely on a disabled button for correctness.

On success, refresh or invalidate all affected employee, request, notification and workbench caches.
Do not optimistically display a human approval before the server accepts it.
Preserve typed form data when a request fails.
A 409 requires explaining the changed record and reloading its current version before another deliberate decision.

## Errors and recovery

| Condition | Employee-facing behavior |
| --- | --- |
| Session expired | Explain that sign-in is required. Preserve a safe local form draft if permitted. |
| Missing permission | Explain that this action is unavailable. Do not present technical role names as the only explanation. |
| Hidden or removed resource | Show an unavailable-record state with navigation back to the list. |
| Invalid field | Keep values, place the error by the field, and focus the first invalid field. |
| Stale version | Say the record changed and ask the user to review the current version. |
| Duplicate intent already accepted | Display the original accepted result. |
| Provider unavailable | Keep the question and offer a clear retry or source-view path. |
| Integration export failed | Retain the business decision and show the separate delivery problem to the permitted role. |

Error copy names a next step. Use the request_id in an expandable support detail, not as the main message.

## Learning integration

Treat catalogue availability, assignment status, completion and score as separate values.
Never calculate an authoritative score in the browser.
Never infer completion from opening a page.
Render only the question choices returned to a learner. The correct answer key belongs to the backend.
Use the enrollment's course version when rendering historical results.
When a course is archived, preserve the learner's history and explain content availability.

## AI and evidence integration

Show the response mode. Generated and extractive responses are different capabilities.
Render citations from returned document/chunk identifiers and URLs.
Opening a citation must still authorize the user. Handle an unavailable source revision explicitly.
Keep the question visible while a source is inspected.
A refusal is a useful outcome when the basis is absent.
Creating an HR case is an explicit employee action, followed by a visible case id and status.
The assistant does not operate approval buttons on behalf of HR.

## Notifications

A notification is linked to an event and an object.
Read/unread is per user.
Opening a completed task should show its current state and historical event.
Marking a notification read must not change the request or course.

## Type generation

Generate TypeScript definitions from the committed OpenAPI artifact.
The next agent chooses its frontend framework and component composition within the product requirements.
Do not write a second independent collection of response interfaces by guessing from screenshots.
Runtime validation is still needed for untrusted external data and adapter responses.

## Browser acceptance

Use the real API and at least an employee, its assigned manager, an unrelated manager and HR.
Verify cookie/CSRF flow, account switching without cache leakage, stale writes, duplicate-click recovery and source access.
Verify keyboard, narrow viewport, 200% zoom, reduced motion, focus restoration and screen-reader labels.
These checks remain open until an implemented frontend is actually driven in a browser.

