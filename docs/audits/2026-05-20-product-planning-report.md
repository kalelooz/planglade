# FlowBoard Product Planning Report

Date: 2026-05-20

Status: reference report. This does not replace `docs/ACTIVE_PLAN.md`.

## Executive Summary

FlowBoard currently has a credible app core, not a go-to-market product shell. The signed-in Home page exists at `/`, the primary product loop is mostly server-backed, and the database model already includes many future-proof primitives: work item hierarchy, relations, comments, attachments, saved views, workspace roles, notes, labels, and activity. The missing product layer is not "more screens"; it is a coherent workflow model, project-level configuration, user documentation, onboarding, and a deliberate choice about how much ITSM/Jira-like structure FlowBoard should expose.

Recommended direction:

1. Keep FlowBoard positioned as a clean project/work management tool first.
2. Add an optional "Service Desk / ITSM-lite" project mode later, not as the default.
3. Implement project feature toggles before adding heavy features: subtasks, custom fields, SLAs, request/ticket mode, docs, attachments, and workflow customization should be enableable per project.
4. Ship proper login and onboarding before marketing landing work.
5. Add user guides once the server-backed core loop and auth are stable enough that the guides will not describe temporary behavior.
6. Borrow from Jira/ITIL only where it improves work control: work types, statuses/transitions, SLAs, request categories, incident/request/change/problem vocabulary. Do not copy Jira's admin complexity.

## Current State From The Repo

### Landing Page

There is no active landing page route. The App Router has no `/landing`, `/marketing`, or public homepage route. The root route `src/app/page.tsx` is the signed-in Home command center with Quick Capture, Today, Overdue, Inbox, and Recent Notes.

Recommendation: defer marketing landing page until auth, onboarding, and stable demo data are ready. A premature landing page is less important than a real login/onboarding path.

### Login Page

There is no active `/login` route. A historical navigation plan explicitly removed `/login` because it had no real auth. There is an old `LoginPage` component at `src/components/flowboard/login-page.tsx`, but it says "Demo mode - mock authentication" and uses the old `auth-context.tsx`. Current backend work has NextAuth scaffolding under `src/app/api/auth/[...nextauth]/route.ts` and a session route under `src/app/api/auth/session/route.ts`.

Recommendation: rebuild login around the current NextAuth direction. Do not revive the old mock component as-is.

Minimum login/auth scope:

- Public `/login`.
- Provider sign-in using configured GitHub or Google provider.
- Local dev fallback remains hidden from production UX.
- Redirect signed-in users to `/`.
- Redirect signed-out users away from protected app routes.
- Add `/onboarding` for first workspace/project setup after first sign-in.

### Documentation And User Guides

Developer documentation exists: `README.md`, `docs/ACTIVE_PLAN.md`, `docs/FULLSTACK_ROADMAP.md`, `docs/QUALITY-GATES.md`, audits, and archive material. User-facing documentation does not yet exist.

Recommendation: add user docs only after the core product wording stabilizes. The first docs should be short in-app help pages, not a large external documentation system.

Suggested first user guides:

- Getting started: create a workspace, first project, and first task.
- Capture and triage: Quick Capture, Inbox, and moving work into projects.
- Work item lifecycle: open, edit, assign, schedule, complete, reopen, delete.
- Projects: project settings, views, labels, members, and optional features.
- Notes and project docs: when to use notes vs work items.
- Admin guide: members, roles, import local data, auth modes.

### Data Model Readiness

The Prisma schema already contains strong primitives:

- `WorkItem.parentId` and `children` for subtasks or parent/child work.
- `WorkItemRelation` for blocks, blocked by, relates to, duplicates, parent/child relation types.
- `WorkItem.checklist` for lightweight checklist steps.
- `SavedView` with layout, group, order, filters, and display JSON.
- `UserSettings` for user/workspace preferences.
- `Comment`, `Attachment`, and `ActivityEvent` models.
- Workspace roles and membership APIs.

This means the next product planning should avoid adding parallel concepts. "Ticket", "task", "issue", "request", and "work item" should be one object type with optional project mode semantics.

## Competitive And Reference Findings

### Plane

Plane is the closest conceptual match from `/external/pm-repos`. It uses work items as the central object and supports layouts such as list, kanban, calendar, Gantt, and spreadsheet. Its project settings are grouped into General, Features, Work Structure, and Execution, with feature toggles for cycles, modules, views, pages, and intake.

Adopt:

- Project feature toggles.
- Work item as the single object behind list, board, calendar, timeline/table views.
- Saved view preferences separate from work item data.
- Project settings groups: General, Features, Work Structure, Execution.
- Pages/docs as an optional project feature.

Avoid:

- Copying Plane's multi-package architecture.
- Shipping cycles/modules/analytics before FlowBoard's task lifecycle is reliable.

### Vikunja

Vikunja is strongest for durable task semantics. It models done state, done timestamp, due/start/end dates, reminders, recurrence, labels, attachments, comments, reactions, task positions, bucket movement, and rich task relations. Its relation model explicitly includes subtasks, parent tasks, blocks, blocked, precedes, follows, duplicates, and related.

Adopt:

- Treat completion as both state and timestamp.
- Keep dates explicit: start, due, completed, eventually end.
- Use relation types instead of one-off "dependency" fields.
- Use per-view task positions instead of one global order when views become sophisticated.

Defer:

- Recurrence.
- CalDAV.
- Complex reminders.

### Memos

Memos is useful for quick capture and Markdown-first notes. It emphasizes instant capture, Markdown portability, tags, task-list parsing, attachments, REST/gRPC APIs, and self-hosting simplicity.

Adopt:

- Markdown-first notes and project docs.
- Derived metadata from content: tags, mentions, checklist/task-list detection.
- Keep capture extremely fast.

Avoid:

- Turning FlowBoard into a notes-first app. Notes should support project work, not replace it.

### Focalboard

Focalboard is unmaintained, so it should be used only as a pattern reference. Its useful ideas are board/card property templates and view fields: view type, group by, date display property, sort options, visible properties, hidden/collapsed groups, filters, card order, column widths, and calculations.

Adopt:

- View settings model.
- Property template concept, simplified for FlowBoard.
- Table/card export patterns later.

Avoid:

- Direct dependency or wholesale architectural copying.

### Leantime

Leantime is strongest for non-project-manager friendliness and broad optional PM modules: subtasks, dependencies, milestones, sprint management, time tracking, timesheets, wikis/docs, goals, risk analysis, retrospectives, canvases, file storage, roles, OIDC/LDAP, plugins, and API.

Adopt:

- Progressive disclosure.
- Project docs/wiki templates.
- Optional risk, retrospective, goal, and timesheet modules only after the core workflow is stable.

Avoid:

- Adding every PM feature to the default surface.

### Jira And Jira Service Management

Jira's useful patterns are work types, parent/child hierarchy, subtasks, custom fields, workflows as statuses plus transitions, and project-specific configuration. Jira Service Management adds request types, incident/service request/change/problem categories, portal/request semantics, and SLAs. Atlassian docs describe SLAs as configurable time goals attached to service work and subtasks as optional work types that can be enabled/disabled and used to block parent completion.

Adopt selectively:

- Work types: task, bug, request, incident, change, problem, story.
- Workflow = statuses plus allowed transitions.
- Subtasks as optional project feature.
- Parent close rule: optionally require child/subtasks complete before parent can close.
- Custom fields per project, with a strict small field type set.
- SLA policies only when project mode is service/request based.

Avoid:

- Global admin-heavy workflow schemes in v1.
- Requiring users to understand Jira vocabulary in normal projects.
- Adding automation before manual workflows are solid.

### ITIL v4 / ITSM

Assumption: "ITMS" in the request means ITSM. ITIL v4 should influence terminology and process boundaries, not dominate the product. The relevant practices for FlowBoard are incident management, service request management, problem management, change enablement, knowledge management, service level management, and continual improvement.

Recommended ITIL-inspired mapping:

- Incident: something is broken or degraded.
- Service request: user asks for access/help/standard service.
- Change: controlled change to a system/process.
- Problem: root cause investigation, often linked to incidents.
- Knowledge/doc: reusable article, runbook, or guide.
- SLA: timer policy for response or resolution.

Default FlowBoard should not be an ITIL tool. It should offer an ITSM-lite project mode for teams that need tickets, SLAs, and request types.

## Product Vocabulary Recommendation

Use "work item" internally and in the model.

Use project-specific labels in the UI:

- Normal project: "Task".
- Software project: "Issue" or "Work item".
- Service desk project: "Ticket" or "Request".
- Docs/wiki: "Page" or "Doc".

The underlying object should stay one `WorkItem`. Do not create separate `Ticket`, `Task`, `Issue`, and `Request` tables unless real divergent behavior appears.

## Proposed Project Modes

### Simple Project

Default for solo users and small teams.

Enabled:

- Tasks.
- Status workflow: Backlog, To do, In progress, In review, Done.
- Labels.
- Assignee.
- Dates.
- Checklist.
- Notes/docs optional.

Disabled by default:

- SLA.
- Request portal.
- Required custom fields.
- Complex work types.
- Approval workflow.

### Software Project

For product/engineering work.

Enabled:

- Work types: task, bug, story.
- Parent/child work.
- Relations: blocks, blocked by, relates to, duplicates.
- Saved views.
- Optional estimates.
- Optional docs.

Deferred:

- Sprints/cycles.
- Releases.
- Automation.

### Service Desk / ITSM-Lite Project

For internal support or operations.

Enabled:

- Work types: request, incident, problem, change.
- Request categories.
- SLA policies.
- Required fields per work type.
- Comments and activity.
- Knowledge/docs.
- Optional approval for change/request.

Disabled unless explicitly enabled:

- Public portal.
- Customer accounts.
- Email ingestion.
- Complex ITIL reporting.

## Feature Toggle Model

Add per-project settings so users can choose how much structure a project needs.

Recommended modules:

- `subtasks`: allows parent/child work and child lists in the drawer.
- `checklists`: lightweight checklist steps inside a work item.
- `relations`: blocks, blocked by, relates to, duplicates.
- `customFields`: project-specific field definitions.
- `workTypes`: task/bug/story/request/incident/change/problem.
- `workflow`: custom statuses and transition rules.
- `sla`: response/resolution timers for ticket/request modes.
- `docs`: project docs/wiki pages.
- `attachments`: file uploads.
- `comments`: team discussion on work items.
- `activity`: mutation history.
- `savedViews`: custom list/table/board/calendar/timeline views.
- `members`: project-level access control.
- `estimates`: points, t-shirt size, or time estimate.
- `timeTracking`: manual time entries and timesheets.

Recommended data approach:

- Add `ProjectSettings` model with JSON module flags first.
- Add explicit tables only when a feature needs queryable records, e.g. `CustomFieldDefinition`, `CustomFieldValue`, `WorkflowStatus`, `WorkflowTransition`, `SlaPolicy`, `SlaCycle`.
- Keep user settings separate from project settings.

## Work Item Lifecycle

FlowBoard should define a proper lifecycle before adding advanced modules.

Default lifecycle:

1. Capture: item lands in Inbox/Backlog with minimal fields.
2. Triage: set project, type, priority, assignee, due/start date, labels.
3. Plan: add checklist/subtasks, docs/notes, relations, acceptance details.
4. Work: move through To do, In progress, In review.
5. Close: Done with `completedAt`.
6. Reopen: move from Done back to active status and clear or preserve completion history according to policy.
7. Archive/Delete: archive for historical project cleanup; delete only for mistakes.

Service desk lifecycle:

1. Open/requested.
2. Triage.
3. Waiting for support.
4. Waiting for requester.
5. In progress.
6. Resolved.
7. Closed.
8. Reopened.

Must-have workflow rules:

- Closing can require all blocking subtasks done when the project enables that rule.
- Moving to Done sets `completedAt`.
- Moving out of Done clears current `completedAt` or records a reopen event; choose one policy and document it.
- Every create/update/move/complete/delete should generate activity once Activity becomes visible.

## Subtasks Recommendation

Yes, FlowBoard should have subtasks, but in two layers:

1. Checklist items for lightweight personal decomposition.
2. Child work items for assignable, trackable subtasks.

Current schema supports both: `WorkItem.checklist` and `WorkItem.parentId`.

Recommended behavior:

- Default project: checklist on; child subtasks off until enabled.
- Software/service project: child subtasks can be enabled.
- Child subtasks inherit project by default.
- Parent progress shows child completion count.
- Optional rule: parent cannot close until child items are complete.

## SLA Recommendation

Yes, SLA is useful, but only for service/request/ticket projects. It should not appear in simple projects by default.

Minimum SLA model:

- `SlaPolicy`: name, projectId, target type, duration, calendar, priority/work-type filters.
- `SlaCycle`: workItemId, policyId, startedAt, pausedAt, breachedAt, completedAt.
- Metrics: first response and resolution only at first.

SLA states:

- Not started.
- Running.
- Paused.
- Met.
- Breached.
- Cancelled.

Do not build SLA reports first. Build the timer correctness first.

## Custom Fields / "Cells" / Requirements

The "cells" idea should be treated as custom fields, not a spreadsheet-first product.

Recommended field types:

- Short text.
- Long text.
- Number.
- Date.
- Select.
- Multi-select.
- Checkbox.
- User.
- URL.

Recommended requirement handling:

- Add `workType` and `customFields` before creating a separate requirement module.
- For software projects, a "Requirement" can be a work type or a doc template linked to work items.
- For service/change projects, required fields can vary by work type.

Avoid:

- Formula fields in the first version.
- Arbitrary nested field schemas.
- Project-level custom fields before basic workflow/statuses are stable.

## Project Detail Pages

Projects need more depth, but it should be organized, not dashboard-heavy.

Recommended project sections:

- Overview: status, dates, owner, description, current work, blockers.
- Work: list/board/table views.
- Docs: project notes/pages.
- Activity: recent real events.
- Members: project access if enabled.
- Settings: modules, statuses, labels, work types, fields, SLA.

Project metadata to add:

- Owner.
- Health/status.
- Start date, target date.
- Description.
- Goals/success criteria.
- Risks.
- Links.
- Optional docs template.

## User Documentation Plan

Phase 1: In-app help

- Empty-state links to relevant guide.
- "What is this?" help in Project Settings.
- Short onboarding checklist.

Phase 2: `/docs` route

- Static guide pages inside app.
- Versioned with the app.
- Searchable later.

Phase 3: Admin/deployment docs

- Auth setup.
- Database backup/restore.
- Import/export.
- Permissions model.

## Candidate Libraries

Already installed and should be used before adding alternatives:

- `next-auth` for auth adapter path.
- `@prisma/client` and `prisma` for persistence.
- `zod` for API validation.
- `@tanstack/react-query` for server state once data fetching expands.
- `@tanstack/react-table` for table/list work.
- `@dnd-kit/*` for board sorting and drag/drop.
- `@mdxeditor/editor`, `react-markdown`, and `@tailwindcss/typography` for docs/notes.
- `react-hook-form` and `@hookform/resolvers` for settings and admin forms.
- shadcn/Radix primitives for UI.
- `lucide-react` for icons.
- `date-fns` for dates.
- `recharts` for later reports.
- `papaparse` for CSV import/export.
- `sonner` for toasts.

Candidate additions, only when needed:

- `@auth/prisma-adapter`: if not already wired indirectly, use for NextAuth/Prisma persistence.
- `@t3-oss/env-nextjs`: typed environment validation.
- `nuqs`: typed URL state for filters/saved views.
- `server-only`: guard server-only modules in Next.js.
- `next-safe-action` or a small local mutation helper: only if route handlers become repetitive.
- `uploadthing` or direct S3/R2 SDK: attachments.
- `resend` plus `react-email`: invitations and notifications.
- `rrule`: recurrence, later.
- `postgres full-text search`: first search implementation.
- `meilisearch`: later external search if Postgres search is not enough.
- `@svar-ui/react-gantt` or a custom internal timeline: evaluate only when dependency editing becomes real.
- `xstate`: only if workflows become complex enough to justify a state machine. Do not add for simple status transitions.

Avoid adding now:

- Full workflow engines.
- Heavy ITSM suites.
- Alternate UI component systems.
- A second rich text editor unless MDXEditor cannot meet requirements.

## Recommended Roadmap Additions

These should be added after the current Phase 3/4 hardening items, not before activity/auth/server correctness.

### Slice A: Auth And Onboarding

- Build real `/login`.
- Protect app routes.
- Add first-run onboarding: workspace, first project, default mode.
- Add a clear dev-mode banner only in local dev.

Done when: a user can sign in, create/enter a workspace, and reach Home without mock auth language.

### Slice B: Project Settings Foundation

- Add `ProjectSettings` or equivalent config model.
- Add project settings UI groups: General, Features, Work Structure, Execution.
- Add module flags for docs, subtasks, relations, saved views, comments, attachments, SLA.
- Start with flags only; hide disabled UI consistently.

Done when: project settings determine visible project features without fake controls.

### Slice C: Work Item Lifecycle

- Define lifecycle transitions.
- Add activity generation for create/update/move/complete/delete.
- Add reopen behavior.
- Add archive vs delete semantics.
- Document the lifecycle.

Done when: opening, editing, moving, closing, reopening, and deleting work is consistent across views.

### Slice D: Subtasks And Relations

- Surface child work items from `parentId`.
- Add child creation in the drawer.
- Add completion count and optional parent-close guard.
- Add relation UI for blocks/blocked/related/duplicates.

Done when: subtasks are real work items and parent status rules are enforced when enabled.

### Slice E: Project Docs

- Add project docs/pages as optional module using existing Markdown stack.
- Link docs to work items and projects.
- Add templates: project brief, requirements, decision log, risk list.

Done when: users can keep project context inside FlowBoard without turning every note into a task.

### Slice F: Custom Fields

- Add field definitions and values.
- Support only simple field types first.
- Render fields in drawer and table.
- Allow required fields by work type only after work types exist.

Done when: projects can capture domain-specific details without hardcoding every field into `WorkItem`.

### Slice G: Service Desk / ITSM-Lite

- Add project mode.
- Add work types: request, incident, problem, change.
- Add request categories and first response/resolution SLAs.
- Add service-desk lifecycle.

Done when: a project can behave like a lightweight internal ticket queue without affecting simple projects.

## Decision Log

- Decision: keep `docs/ACTIVE_PLAN.md` as the active roadmap and place this report in `docs/audits`.
  Reason: the repo instructions say audits are reference material, not active planning authority.

- Decision: recommend project-level feature toggles before adding advanced surfaces.
  Reason: Plane, Jira, Leantime, and Focalboard all show that work structure differs by project, but FlowBoard's MVP must stay simple.

- Decision: make "work item" the internal object and expose task/ticket/request labels by project mode.
  Reason: the current schema already has a flexible `WorkItem`; separate tables would create duplication.

- Decision: support subtasks through both checklist items and child work items.
  Reason: the schema already supports both lightweight and durable decomposition.

- Decision: defer SLA to service/request project mode.
  Reason: SLA is valuable for ITSM but adds noise to personal/simple project management.

- Decision: borrow ITIL vocabulary but not ITIL process weight.
  Reason: ITIL practices can clarify incidents, requests, changes, and service levels, but the default product should remain approachable.

## Sources

Local repo:

- `docs/ACTIVE_PLAN.md`
- `docs/FULLSTACK_ROADMAP.md`
- `README.md`
- `prisma/schema.prisma`
- `src/lib/contracts.ts`
- `src/app/page.tsx`
- `src/components/flowboard/login-page.tsx`
- `src/components/lovable/shell.tsx`
- `external/pm-repos/plane`
- `external/pm-repos/vikunja`
- `external/pm-repos/memos`
- `external/pm-repos/focalboard`
- `external/pm-repos/leantime`

External references checked:

- Atlassian Jira workflow docs: https://support.atlassian.com/jira-cloud-administration/docs/work-with-issue-workflows
- Atlassian Jira work types docs: https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/
- Atlassian Jira subtasks docs: https://support.atlassian.com/jira-cloud-administration/docs/configure-sub-tasks/
- Atlassian Jira Service Management SLA docs: https://support.atlassian.com/jira-service-management-cloud/docs/create-an-sla/
- Atlassian Jira Service Management default configuration docs: https://support.atlassian.com/jira-cloud-administration/docs/default-configurations-for-jira-service-management/
- PeopleCert ITIL 4 practice page: https://www.peoplecert.org/jp/pages/itil4-practices/
- Plane README/docs references in `external/pm-repos/plane`
- Vikunja README/docs references in `external/pm-repos/vikunja`
- Memos README/docs references in `external/pm-repos/memos`
- Focalboard README and source in `external/pm-repos/focalboard`
- Leantime README/source in `external/pm-repos/leantime`
- TanStack Query docs: https://tanstack.com/query/latest/docs/react/
- Meilisearch docs: https://www.meilisearch.com/docs/capabilities/full_text_search/overview
- SVAR React Gantt docs: https://svar.dev/react/gantt/
