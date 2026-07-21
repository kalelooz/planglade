# FlowBoard Active Plan

> AI agents: this is the single source of truth for execution planning. Read this after `AGENTS.md` and before changing code. Do not treat archived audits, rollback patches, worklogs, or completed slice plans as active roadmap items.

Last updated: 2026-05-22

## Current Status

The frontend MVP loop is complete for the current local-first prototype. FlowBoard now has focused primary navigation, shared client workspace state, local persistence, Quick Capture, real task completion, notes search, and date-driven Calendar/Timeline behavior.

FlowBoard is not a production full-stack app yet. The active work now moves from UI honesty to the full-stack foundation described in `docs/FULLSTACK_ROADMAP.md`.

## Product Goal

Turn FlowBoard from a polished prototype into a simple, fast, trustworthy project management tool for solo users and small teams.

The completed frontend product loop is:

1. Capture work quickly.
2. Triage captured work in Inbox.
3. See what matters today in Home and My Tasks.
4. Use Projects, Calendar, and Timeline as views over the same task data.
5. Persist user-created work locally.

The current priority is the production foundation:

1. Replace placeholder backend/auth/database pieces with real FlowBoard foundations.
2. Keep the completed frontend loop working while moving persistence server-side.
3. Add collaboration only after single-user server persistence is durable.

## Operating Rules

- Start every session with a short TODO list.
- Work one slice at a time and validate that slice before moving on.
- Prefer existing shadcn/ui, Radix, Tailwind variables, Lucide icons, TanStack Table, and Zustand patterns.
- Backend, auth, and database work are now in scope only for the production foundation and server-backed core loop.
- Do not polish fake actions. Make them real, disable them, or remove them from the active surface.
- Do not delete `Reddit/`; it is protected voice-of-customer research.
- Use `docs/QUALITY-GATES.md` for validation scope.

## Current Active Milestone

Build the full-stack foundation without expanding the product surface.

The next milestone is Phase 1 from `docs/FULLSTACK_ROADMAP.md`:

- [x] Define the public self-host baseline: NextAuth, SQLite via Prisma, and local attachment storage. Provider-specific hosted deployment decisions remain outside the public repository.
- [x] Replace the sample Prisma schema with FlowBoard domain models.
- [x] Add Zod schemas for core create/update payloads.
- [x] Define API contracts for work items, projects, notes, labels, saved views, settings, and activity.
- [x] Replace the hello-world API route with real health/bootstrap routes.
- [x] Replace mocked auth direction with a production auth adapter plan and server session checks.
- [x] Fix project red gates before production: TypeScript build errors cannot be ignored, build/start scripts must be cross-platform, and package-manager usage must be normalized.

Verify: the app still runs the completed frontend loop, Prisma can validate/migrate the real schema, and no advanced surface is promoted before it reads/writes real data.

Additional progress completed during Phase 1 execution:

- [x] Added initial Prisma-backed API CRUD routes for projects, work items, and notes.
- [x] Added initial `workspace/import-local` API route for local-to-server migration.
- [x] Added initial Prisma-backed API CRUD routes for labels, saved views, and user settings.
- [x] Enforced workspace scoping on project/work item/note update and delete routes.
- [x] Added `GET /api/auth/session` scaffold route that resolves a real DB-backed dev user/workspace session.
- [x] Removed `typescript.ignoreBuildErrors` from `next.config.ts`.
- [x] Replaced Bun-only production start script with cross-platform Node standalone start.
- [x] Fixed Prisma API typing issues that blocked `tsc --noEmit` after removing build-error ignores.
- [x] Locked the public self-host baseline (NextAuth + SQLite + local storage).

## Phase Breakdown (Pending vs Done)

### Phase 1 - Foundation (in progress)

- [x] FlowBoard Prisma schema and typed API contracts.
- [x] Core CRUD routes (projects/work-items/notes/labels/saved-views/settings).
- [x] Workspace-scoped update/delete guards.
- [x] Dev session scaffold for server-side actor/workspace resolution.
- [x] Remove TypeScript-ignore build gate and Bun-only start gate.
- [x] Finalize production auth provider decision and migration plan.
- [x] Normalize package-manager usage and dependency scripts.

### Phase 2 - Server-backed Core Loop (in progress)

- [x] `My Tasks` now reads from `/api/work-items` and performs server-backed complete/delete mutations.
- [x] Added client-side shared server-session helper and reused it in `My Tasks` bootstrap.
- [x] Added Settings UI flow for one-time local-to-server migration (`append`/`replace`) using `workspace/import-local`.
- [x] Wired `Home` read path to server work-items and notes, with server-backed complete and quick-capture task creation.
- [x] Wired `Projects` read path to server projects/work-items, plus server-backed project/task create, update, move, and delete actions.
- [x] Wire Inbox, Notes, Calendar, and Timeline to server data.
- [x] Complete server-backed drawer edit flows for work items (title/description/assignee/dates/labels/project).
- [x] Add UI affordance for one-time localStorage import using existing `workspace/import-local` route.

Additional progress in this batch:

- [x] Converted Inbox to server-backed capture flow using `BACKLOG` work items with server triage/move/delete.
- [x] Converted Notes read/create/update/delete to server-backed routes and server task extraction from checklist markdown.
- [x] Converted Calendar and Timeline reads to server-backed work-item/project loading.
- [x] Added optimistic server mutation + rollback for task changes in Inbox and Timeline.
- [x] Updated `TaskDrawer` core edits to PATCH server state (status, priority, title, description, assignee, dates, label, project) with optimistic rollback behavior.
- [x] Added NextAuth adapter scaffolding (`/api/auth/[...nextauth]`) with provider-based server sessions and dev-session fallback in `/api/auth/session`.
- [x] Extended session payload with workspace member identities and rewired server-backed pages to use real assignee user IDs for scope and assignment.
- [x] Added server persistence for task `noteIds` and `checklist` across contracts/API/import route and drawer mutations.
- [x] Normalized package manager declaration to npm in `package.json`.

### Phase 3 - Collaboration + Hardening (pending)

- [x] Workspace roles and membership workflows.
- [x] Activity generation from core work-item/project/note mutations and server-backed task history.
- [x] Work-item comments and mention parsing against workspace members.
- [x] Notifications now use durable server-side notification records with read/unread persistence and preference-aware delivery.
- [x] Settings persistence and server-backed workspace JSON snapshot import/export are live for active workspace data.
- [ ] Authenticated bootstrap and full sign-in lifecycle validation for production auth mode (`firebase` / `nextauth`) across core views.
- [x] Project-level feature flags baseline is implemented (`mode` + `featureFlags`) and enforced for currently mutable optional-module surfaces (comments, mentions, notifications, subtasks, relations, attachments). Docs/custom-fields/SLA surfaces remain unsurfaced.
- [x] Attachments and indexed search baseline APIs are implemented with workspace auth + project-flag guards.
- [ ] CI/deployment/security hardening. (partial: GitHub Actions CI baseline committed; provider-neutral self-host deployment guidance remains pending)

Additional progress in this batch:

- [x] Added workspace member management APIs (`GET/POST /api/workspace/members`, `PATCH/DELETE /api/workspace/members/:memberUserId`) with role checks.
- [x] Added reusable role-based authorization helpers in `src/lib/api-utils.ts`.
- [x] Enforced `MEMBER`+ write authorization on project/work-item/note/label/saved-view/settings/import mutation routes.
- [x] Enforced `ADMIN`+ authorization on workspace membership and local-import workflows.
- [x] Hardened Firebase session bootstrap token lifecycle on the client: ID token storage now tracks `onIdTokenChanged`, and `/api/auth/session` bootstrap requests now prefer fresh `currentUser.getIdToken()` tokens when available.
- [x] Added auth-mode-aware client sign-in/sign-out wiring (`firebase` + `nextauth`) and connected the main app shell identity/sign-out controls to live session/user context.
- [x] Added auth mode validation in `/api/auth/session` for invalid mode and `nextauth` provider misconfiguration, and improved client session-bootstrap error surfacing for faster auth diagnostics.
- [x] Centralized auth mode/env validation in a shared helper and added auth-readiness diagnostics to `/api/health` for faster production triage.
- [x] Added attachment APIs (`GET/POST /api/attachments`, `PATCH/DELETE /api/attachments/:attachmentId`) with workspace role checks, target validation, project-level `attachments` flag enforcement, and activity logging.
- [x] Added work-item relation APIs (`GET/POST /api/work-item-relations`, `DELETE /api/work-item-relations/:relationId`) with workspace role checks, relation validation, project-level `relations` flag enforcement, and activity logging.
- [x] Added workspace-scoped unified search API (`GET /api/search`) across projects/work-items/notes/labels.
- [x] Enforced `subtasks` feature flag on work-item create/update parent-child mutations.
- [x] Added Firebase Storage signed upload URL route (`POST /api/attachments/upload-url`) and storage-object validation on attachment metadata persistence.
- [x] Added storage-provider abstraction (`firebase` + `local`), plus signed local binary upload/download routes for development (`/api/attachments/upload-binary`, `/api/attachments/download-binary`).
- [x] Added shared work-item relation boundary guard + automated tests for cross-workspace/cross-project/feature-flag relation checks.
- [x] Added shared attachment project-boundary guard + automated tests for cross-workspace and attachment-flag enforcement checks.
- [x] Added the GitHub Actions CI baseline (`.github/workflows/ci.yml`) and removed provider-specific hosted configuration from the public tree.

## Consolidated Next Implementation Order

Use `docs/audits/2026-05-20-consolidated-product-implementation-report.md` and `flowboard-collaboration-foundation-plan.md` as reference material for the next implementation slices. Keep this order unless a blocking production defect appears:

1. Complete production auth bootstrap validation (Firebase/NextAuth sign-in, sign-out, expiry behavior, and protected-route verification).
2. Extend authorization tests beyond relation boundaries to cover remaining collaboration/data routes.
3. Complete attachment storage hardening (cross-workspace tests, tighter limits, cleanup lifecycle) on top of the new local+firebase storage pipeline.
4. Add project docs, custom fields, and service-desk/ITSM-lite mode later, behind explicit flags.
5. Add SLA only for service-desk projects after the event/comment/notification foundation works.

Do not prioritize a marketing landing page, Jira-style workflow complexity, formula custom fields, broad reports, or public request portals before the collaboration foundation is real.

## Completed Frontend Milestone

The core loop is honest across the primary app surfaces.

Primary navigation should stay focused:

- Home
- Inbox
- Projects
- My Tasks
- Notes
- Calendar

Advanced or secondary surfaces should not drive the MVP:

- Timeline is useful for date planning, but should only show real task dates.
- Connections, Activity, Team, Reports, Settings, Board, and Work Items must stay secondary unless the data is real and consistent.

## Page Plan

### 1. App Shell

Goal: keep navigation calm, small, and trustworthy.

- [x] Rename any remaining default "Dashboard" wording to "Home" where appropriate.
- [x] Keep primary navigation small: Home, Inbox, Projects, My Tasks, Notes, Calendar.
- [x] Keep Graph/Connections, Activity, Team, Reports, Board, Work Items, and similar low-priority screens behind Advanced/More or direct routes.
- [x] Remove or hide fake notification chrome.
- [x] Keep one primary action in the header: Quick Capture or `+ New`.
- [x] Remove duplicate page titles between shell header and content.

Verify: sidebar grouping is clear, fake header controls are gone, current location is obvious, and the changed shell surface has no crushed controls.

### 2. Home

Goal: make Home the daily command center, not a vanity dashboard.

- [x] Add Quick Capture at the top.
- [x] Show Today, Overdue, Inbox, and Recent Notes.
- [x] Remove vanity KPIs unless clicking them reveals the exact underlying work.
- [x] Make empty states action-oriented.
- [x] Keep team/reporting content off the first screen unless the data is real.

Verify: a task can be captured quickly, no first-screen action pretends to persist if it does not, and the first screen has one clear focal area.

### 3. Inbox

Goal: keep Inbox limited to unprocessed captures and items needing triage.

- [x] Quick Capture creates linked task state for captured items.
- [x] Linked items are clearly indicated.
- [x] Keep awareness widgets out of Inbox unless they require triage.
- [x] Make triage actions update the same task state used by Home and My Tasks.
- [x] Avoid confirmation steps that do not protect a meaningful destructive action.

Verify: captured work appears in the right task surfaces, triage changes are reflected elsewhere, and Inbox is not a mixed dashboard.

### 4. Projects / Kanban

Goal: keep project execution simple and connected to trustworthy task state.

- [x] Reduce card metadata to title, status/priority cue, due signal, and one project/tag cue.
- [x] Move extra information into the drawer.
- [x] Make create/edit/delete/move actions mutate shared state or clearly mark them unavailable.
- [x] Keep the inner project list compact and keyboard/mouse usable.
- [x] Avoid project/report shortcuts that imply real reporting before reports are real.

Verify: moving, creating, editing, and deleting tasks changes every view that reads task state.

### 5. My Tasks

Goal: make the personal work list reliable.

- [x] Add direct row completion controls.
- [x] Replace fake bulk actions with real mutations or disable them.
- [x] Add useful filters: Today, Overdue, Upcoming, Blocked, No Date.
- [x] Keep table/list density compact but readable.
- [x] Ensure rows open the same universal drawer as other views.

Verify: complete/delete/move/edit actions affect shared task state and empty states tell the user what to do next.

### 6. Notes

Goal: make notes fast to capture and easy to find.

- [x] Add notes search across title, body, and tags.
- [x] Highlight search matches.
- [x] Make capture/edit mode obvious.
- [x] Improve selected-note state and list readability.
- [x] Prepare for task links and checkbox-to-task conversion without overbuilding it.

Verify: search is accurate, creating/editing notes updates the list immediately, and note controls are discoverable.

### 7. Calendar

Goal: make dated work visible and consistent.

- [x] Drive calendar items from task dates.
- [x] Fix date parsing so years are explicit and stable.
- [x] Show useful task text before truncation.
- [x] Calendar data agrees with My Tasks and Home.
- [x] Add creation affordance on empty days only after create flow is real.
- [x] Keep month view readable on desktop and mobile.

Verify: changing a task due date moves it on the calendar, and undated tasks do not appear on misleading dates.

### 8. Timeline

Goal: show planning dates without adding fragile complexity.

- [x] Use the current date instead of a hardcoded `TODAY`.
- [x] Add a clear today marker.
- [x] Make overdue work visually distinct.
- [x] Use consistent status/project color rules.
- [x] Drive bars from real start and due dates.
- [x] Keep dependencies hidden until blocker/dependency state exists.

Verify: today's marker matches the actual current date and Timeline agrees with Calendar and My Tasks.

### 9. Advanced Views

Goal: prevent advanced screens from damaging product trust.

- [x] Hide or demote Connections until relationships are real.
- [x] Hide or demote Activity until user actions generate real activity.
- [x] Hide Team for the solo-first MVP unless assignment/workload data is real.
- [x] Hide Reports until reports derive from the same task/project state.

Verify: advanced screens are not part of the primary first-run path and do not contradict shared task/project state.

## Cross-Page Done Criteria

- [x] One source of truth for tasks, projects, notes, members, activity, and settings.
- [x] Create/edit/delete/move actions update all affected views.
- [x] Core user-created work survives refresh through localStorage persistence.
- [x] Changed UI surfaces pass the targeted checks in `docs/QUALITY-GATES.md`.
- [x] `README.md`, `AGENTS.md`, this plan, and implementation state do not contradict each other.

## External Repo Guidance

Use `docs/FULLSTACK_ROADMAP.md` as the reference for lessons from `external/pm-repos/`.

- Plane: use its work-item and saved-view model as inspiration.
- Vikunja: use its durable task semantics as inspiration.
- Memos: use its Markdown-first quick capture and derived note metadata as inspiration.
- Focalboard: use only its board/view preference ideas; do not copy wholesale because the standalone repo is unmaintained.
- Leantime: use its progressive-disclosure product philosophy; do not import its broad feature set into the MVP.

## Reference Material

These are reference or historical documents, not active plans:

- `docs/audits/` - audits and strategic analysis.
- `docs/archive/completed-plans/` - finished slice plans.
- `docs/archive/rollback-patches/` - rollback snapshots retained for safety.
- `docs/archive/worklog-legacy.md` - historical worklog, not current verification.
- `docs/superpowers/plans/` - older implementation planning notes.
