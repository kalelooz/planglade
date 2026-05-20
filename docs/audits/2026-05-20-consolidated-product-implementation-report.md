# FlowBoard Consolidated Product Implementation Report

Date: 2026-05-20

Status: reference report feeding `docs/ACTIVE_PLAN.md`. This merges:

- `docs/audits/2026-05-20-systematic-audit.md`
- `docs/audits/2026-05-20-product-planning-report.md`
- User direction on notifications, themes, import/export, comments, mentions, and Jira-style task history

## What To Keep

Keep these ideas because they match the current architecture and product direction:

- Server-derived task history, using `ActivityEvent`, so Activity and task drawers show real mutation history like Jira.
- Task comments and mentions, using the existing `Comment` table as the collaboration foundation.
- In-app notifications, generated from real events such as mentions, assignment, due-date changes, comments, and completed/blocked work.
- Light, dark, and system theme modes. These already exist conceptually through `next-themes`; the missing part is server-backed persistence and cleaner settings UX.
- Settings import/export and workspace import/export. Settings JSON export exists in an older client-only settings view; the durable version should use server-backed settings and workspace data.
- Project-level feature toggles for subtasks, comments, mentions, notifications, docs, custom fields, SLA, attachments, and saved views.
- Subtasks in two layers: checklist items for lightweight decomposition and child work items for assignable subtasks.
- Optional ITSM-lite project mode later, including request/incident/change/problem work types and SLA.
- Quality hardening from the systematic audit: production auth, stricter ESLint, authorization tests, Windows-safe validation, and real storage providers.

## What To Ditch Or Defer

Avoid these because they add complexity before FlowBoard is stable:

- A marketing landing page before real login/onboarding is complete.
- Reviving the old mock `LoginPage` as-is.
- Fake notification chrome or notification preferences that do not create/read notification records.
- Jira-style global workflow schemes, global admin complexity, or requiring all users to understand ITIL terms.
- Separate `Ticket`, `Issue`, `Task`, and `Request` database tables. Keep one `WorkItem` model and change labels/behavior by project mode.
- Full ITIL by default. ITIL should inspire optional service-desk projects only.
- SLA in simple projects.
- Formula custom fields, complex spreadsheet behavior, or automation before manual workflows are reliable.
- Focalboard wholesale adoption; use its view/property ideas only.

## Consolidated Product Decisions

### 1. The next foundation slice is history-first

Before notifications, comments, mentions, reporting, SLA, or audit views, FlowBoard needs real activity generation from server mutations.

Reason: notifications and history are downstream of events. If events are not reliable, every later collaboration feature becomes inconsistent.

### 2. Comments and mentions come before notifications UI polish

Task comments should be real records first. Mentions can then be parsed from comment bodies and converted into notification records.

Recommended mention format:

- Store comment body as Markdown/plain text.
- Parse `@display-name` or `@email` against workspace members.
- Persist mention targets in notification metadata first; add a relation table later only if querying demands it.

### 3. Notifications are records, not just toggles

The durable model should include notification records with read/unread state. User notification preferences should only filter which records are created or surfaced.

Minimum notification triggers:

- Mentioned in a comment.
- Assigned to a work item.
- Comment on a work item assigned to me.
- Due date changed on my work item.
- Work item blocked/unblocked.

Email can wait until in-app notifications are correct.

### 4. Task history should be visible in two places

Activity page:

- Workspace/project-wide event feed.
- Search and filters by action/entity/person/date.

Task drawer:

- History tab showing changes for that work item only.
- Comments tab showing discussion.

This gives users Jira-like traceability without making the default UI heavy.

### 5. Theme support should be simple and server-backed

Keep three theme modes:

- Light.
- Dark/night mode.
- System.

Accent color and density can remain optional preferences, but they must persist through `UserSettings`. Avoid overbuilding multiple decorative themes.

### 6. Import/export should be staged

Stage 1:

- Keep local-to-server import working.
- Add server-backed settings export/import.

Stage 2:

- Add workspace JSON export/import for projects, work items, notes, labels, comments, and saved views.

Stage 3:

- Add CSV export/import once custom fields and table views stabilize.

## Required Data Model Additions

The current schema already has `ActivityEvent`, `Comment`, `Attachment`, `WorkItemRelation`, `UserSettings`, and `SavedView`. Add only the missing records needed for the next slices:

### Notification

Fields:

- `id`
- `workspaceId`
- `recipientId`
- `actorId`
- `type`
- `entityType`
- `entityId`
- `activityEventId`
- `title`
- `body`
- `metadata`
- `readAt`
- `createdAt`

### ProjectSettings

Fields:

- `id`
- `workspaceId`
- `projectId`
- `mode`: simple, software, service_desk
- `modules`: JSON flags
- `workflow`: JSON at first
- `createdAt`
- `updatedAt`

Use JSON first for module flags. Add normalized workflow/SLA/custom-field tables only when the feature needs strong querying.

### Optional Later Tables

- `CustomFieldDefinition`
- `CustomFieldValue`
- `WorkflowStatus`
- `WorkflowTransition`
- `SlaPolicy`
- `SlaCycle`
- `WorkspaceExport`

## Implementation Roadmap

### Slice 1: Activity And Task History

Goal: make history real before exposing collaboration features.

Tasks:

- Add an `activity-service` helper for creating `ActivityEvent` rows.
- Call it from project, work-item, note, label, saved-view, settings, and member mutation routes.
- Include before/after metadata for important work-item fields: title, status, priority, assignee, project, due date, start date, labels, checklist, note links.
- Convert `/activity` from Zustand/mock activity to server `ActivityEvent` reads.
- Add a task-drawer History section filtered by `entityType=WORK_ITEM` and `entityId`.

Verify:

- Create, edit, move, complete, reopen, and delete a task.
- `/activity` shows the real events after refresh.
- Opening the task drawer shows only that task's history.

### Slice 2: Comments And Mentions

Goal: make task discussion real and prepare notification generation.

Tasks:

- Add comment list/create/update/delete API routes for work items.
- Add role checks: members can comment, viewers can read only.
- Add a task drawer Comments section backed by server data.
- Parse `@mentions` against workspace members when creating/updating comments.
- Store mention metadata on the related activity event until notification records exist.

Verify:

- Comment survives refresh.
- Viewer cannot create/update/delete comments.
- Mention parsing resolves existing workspace members and ignores unknown names safely.

### Slice 3: Notifications

Goal: create durable in-app notifications from real events.

Tasks:

- Add `Notification` model and Zod contracts.
- Add `/api/notifications` list/read/unread/mark-all-read routes.
- Generate notifications for mentions, assignment, due-date changes, and comments on assigned work.
- Add notification preference keys to `UserSettings.notifications`.
- Add a quiet notification center in the shell only after the records are real.

Verify:

- Mentioning a user creates an unread notification for that user.
- Mark read survives refresh.
- Disabled preferences suppress new matching notifications.

### Slice 4: Settings, Themes, And Import/Export

Goal: make settings useful and durable instead of client-only.

Tasks:

- Replace client-only settings state with `GET/PATCH /api/settings`.
- Persist theme mode as `system | light | dark`.
- Persist density/accent only if the app uses them consistently.
- Remove or disable settings that do not affect the product.
- Add settings JSON export/import against server-backed settings.
- Add workspace JSON export for projects, work items, notes, labels, comments, saved views, and settings.

Verify:

- Theme mode survives refresh/sign-out/sign-in.
- Settings export can be imported into the same workspace.
- Workspace export returns real server data and excludes inaccessible workspace data.

### Slice 5: Project Settings And Optional Modules

Goal: let projects choose complexity without bloating the default product.

Tasks:

- Add `ProjectSettings` model and API routes.
- Add Settings sections: General, Features, Work Structure, Execution.
- Add module flags for comments, mentions, notifications, subtasks, relations, docs, attachments, saved views, custom fields, SLA.
- Hide disabled feature UI consistently.
- Add project modes: simple, software, service_desk.

Verify:

- Disabling comments hides comment creation and blocks comment mutation routes.
- Simple projects do not show SLA or service-desk fields.
- Existing projects get safe default settings.

### Slice 6: Subtasks And Relations

Goal: support structured work without forcing it on every project.

Tasks:

- Surface child work items from `parentId`.
- Add child work-item creation inside the task drawer.
- Add parent progress and optional "children must be done before parent closes" rule.
- Add relation UI for blocks, blocked by, related, duplicates.
- Generate activity and notifications for blocked/unblocked changes.

Verify:

- Child work items are regular work items with their own assignee/status/dates.
- Parent close guard works only when enabled.
- Relations survive refresh and appear consistently in task drawer and relevant views.

### Slice 7: Docs, Custom Fields, And ITSM-Lite

Goal: add advanced project structure after collaboration/history is reliable.

Tasks:

- Add optional project docs/pages using the existing Markdown stack.
- Add templates for project brief, requirement, decision log, risk list, and runbook.
- Add simple custom field definitions and values.
- Add service-desk mode work types: request, incident, problem, change.
- Add first response/resolution SLA only for service-desk projects.

Verify:

- Simple project users do not see service-desk features by default.
- Required fields are enforced only for configured work types.
- SLA timers are accurate before reports are added.

## Quality And Security Hardening Plan

These are not product features, but they must be part of implementation order.

### Immediate

- Keep using Windows-safe validation commands.
- Generate activity inside server transactions where possible.
- Do not expose Activity, Notifications, Comments, or Attachments as primary features until they read/write server records.

### Next

- Re-enable `react-hooks/exhaustive-deps` as warning and fix touched files.
- Add targeted authorization tests for cross-workspace access.
- Verify production auth mode with real provider configuration.

### Before Production

- Convert critical ESLint warnings to CI errors.
- Add backup/restore procedure.
- Add rate limiting for auth and mutation routes.
- Add security review for tenant boundaries, uploads, notifications, and mentions.

## Updated Priority Order

1. Activity/task history.
2. Comments and mentions.
3. Notifications.
4. Server-backed settings, three theme modes, and import/export.
5. Project settings and optional feature modules.
6. Subtasks and relations.
7. Docs, custom fields, and service-desk/ITSM-lite.
8. SLA.
9. Reporting, CSV, automation, and public landing page.

This order keeps the good ideas but prevents the product from becoming a fake Jira clone before the core collaboration loop is trustworthy.
