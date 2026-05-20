# FlowBoard Active Plan

> AI agents: this is the single source of truth for execution planning. Read this after `AGENTS.md` and before changing code. Do not treat archived audits, rollback patches, worklogs, or completed slice plans as active roadmap items.

Last updated: 2026-05-20

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

- [ ] Choose deployment target and database path for v1 production. Recommended default: Next.js app plus PostgreSQL through Prisma.
- [ ] Replace the sample Prisma schema with FlowBoard domain models.
- [ ] Add Zod schemas for core create/update payloads.
- [ ] Define API contracts for work items, projects, notes, labels, saved views, settings, and activity.
- [ ] Replace the hello-world API route with real health/bootstrap routes.
- [ ] Replace mocked auth direction with a production auth adapter plan and server session checks.
- [ ] Fix project red gates before production: TypeScript build errors cannot be ignored, build/start scripts must be cross-platform, and package-manager usage must be normalized.

Verify: the app still runs the completed frontend loop, Prisma can validate/migrate the real schema, and no advanced surface is promoted before it reads/writes real data.

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
