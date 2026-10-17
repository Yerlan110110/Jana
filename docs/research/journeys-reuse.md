# Requests and Academy reuse decisions

Inspected 17 October 2026 before composing the views. This is a mechanism study, not a REA capture or a claim of authenticated demo coverage.

## Sources and decisions

| Primary source | Evidence | JanaMen decision |
| --- | --- | --- |
| [Frappe HR leave application](https://docs.frappe.io/hr/leave-application) | The documented form puts dates, balance, reason and the approver together. The approver reviews separately. | Show the official balance date and portal projection separately beside the leave form. Preserve explicit save and submit. Use the assigned reviewer and `allowed_actions` from Django. |
| [Frappe HR application source](https://github.com/frappe/hrms/blob/develop/hrms/hr/doctype/leave_application/leave_application.py) and [API](https://github.com/frappe/hrms/blob/develop/hrms/api/__init__.py) | Validation checks overlaps, balance, self approval and the approver. Approval queries are filtered on the server. | Use `needs_my_action=true` before pagination. Never infer decision rights from role or from the current employee manager. No Frappe code is copied. |
| [Moodle activity completion](https://docs.moodle.org/501/en/Activity_completion) | A material can have its own explicit completion criterion. Completion is distinct from navigation. | Use a real `complete-lesson` command. Show required material counts and server progress. Opening a lesson never completes it. |
| [Moodle quiz activity](https://docs.moodle.org/501/en/Quiz_activity) | Quiz attempts have assessment rules and results. | Show prerequisites and attempt limits before answers. Submit selections to the server. Show its score, pass flag, material state and retained attempt history. Never expose author answer keys in learner components. |
| [Moodle first-party demo directory](https://moodle.org/demo/) and [Mount Orange](https://school.moodledemo.net/) | The live guest home loaded through T3 preview. It identifies Moodle 5.3, separate role demos and hourly reset. It describes previous/next course navigation. | Use ordered lesson navigation with a visible course outline. Authenticated learning and quiz interactions were not observed; those decisions use the first-party docs and JanaMen source, not an invented live walkthrough. |
| [Pinned local reuse audit](continuation-reuse.md) | Safe Pace closure includes Card, Empty, Skeleton, Dialog, NativeSelect and Textarea. Button and Input use official MIT shadcn adapters. | Reuse installed components and native forms. No Oxygen-dependent Pace entry, new dependency, auth or backend. |

Frappe HR and Moodle are maintained full platforms. Adopting either would add deployment and authentication ownership while duplicating the existing tested Django modules. Their mechanisms are reference material only. No hosted account, paid plan or source copy is required. Existing JanaMen sessions, CSRF, generated client and transactional commands remain the runtime foundation.

## Source-bound design

The authoritative shapes are `Model<'RequestDetail'>`, `Model<'EnrollmentDetail'>`, `Model<'LearningContent'>`, `Model<'CourseDraftRequest'>` and `Model<'Employee'>`. Forms hold editable fields separately from the fetched record version. A failed write retains local values. An explicit refresh loads a new server version without overwriting them.

Request approval, document receipt and official source accounting are separate sections of the fulfillment response. A receipt never means paid. Enrollments retain their fixed revision even when a new course revision is published or the course is archived. Own lists filter by the session employee on the server; team lists use scoped server APIs.

Two structures were considered. A schema-driven generic form would hide the two request payloads and course nesting behind adapters. Feature modules with small typed forms keep exact commands and permission checks visible. The latter is selected. Shared controls, errors, pagination and command retry handling stay owned by the existing foundation.

The throughput checkpoint is one research commit, one checked request/profile unit, one checked learner unit, and one checked authoring unit. No child agents run under the explicit task restriction. Independent review and whole-product browser acceptance remain the coordinator's gates.

Emil's frequency rule removes entrance motion. Jakub's layout rules keep task actions in document flow, wrap long names and collapse course outline beside material at narrow widths. Accessibility rules select native labels, fieldsets, radio buttons and details. Model the Domain separates completion, due state and failed attempts. Type System Discipline derives payloads from the generated schema. Make Operations Idempotent uses the existing `useCommand` key for an unchanged uncertain retry.
