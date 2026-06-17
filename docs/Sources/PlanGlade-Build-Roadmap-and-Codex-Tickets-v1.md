# PlanGlade — Build Roadmap and Codex Tickets v1

**Status:** Final execution plan aligned to Master Source v5  
**Date:** 2026-06-14  
**Purpose:** Turn the holistic product source into a scoped, buildable sequence for Codex.

---

## 0. Build Strategy

Build PlanGlade in slices that each leave the app better than before.

Priority order:
1. Foundation and safety.
2. Solo core workflow.
3. Public MVP.
4. Timeline/dependencies.
5. Collaboration and advanced planning.
6. Time tracking/resource/reporting only after the core is loved.

**Fast-track goal:**
> Publish an honest public MVP that proves capture → task → project → note/doc → calendar with a calm UI and credible self-hosting.

---

## 1. Phase Overview

| Phase | Name | Goal | Public value |
|---|---|---|---|
| 0 | Foundation | App, auth, workspace, DB, shell | Can log in and use app shell |
| 1 | Solo Core | Inbox, tasks, projects, notes, calendar | Useful for solo users |
| 2 | Public MVP | Docs, landing, self-host, OSS docs | Can publish honestly |
| 3 | Planning Power | Timeline, dependencies, recurring tasks | Addresses strongest PM gap |
| 4 | Sharing + Mobile | PWA polish, invites, shared workspaces | Families/small teams |
| 5 | Optional Power | Time tracking, reports, importers | Freelancer/team expansion |

---

## 2. Phase 0 — Foundation

### SETUP-001 — Initialize app

**Goal:** Create the base Next.js/TypeScript/Tailwind/shadcn app.

Allowed areas:
- package files
- config files
- `src/app`
- `src/components/ui`

Requirements:
1. Next.js App Router.
2. TypeScript strict.
3. Tailwind.
4. shadcn/ui initialized.
5. Lucide installed.
6. Basic landing placeholder and auth placeholder.
7. No fake features.

Validation:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

---

### SETUP-002 — Prisma schema and DB

**Goal:** Add the v5 core data model.

Requirements:
1. Prisma schema includes User, Workspace, WorkspaceMember, Project, Task, TaskDependency, InboxItem, Note, Doc, Label, TaskLabel.
2. SQLite dev supported.
3. PostgreSQL production supported.
4. Prisma client singleton.
5. Seed script creates safe local demo data only when explicitly run.

Validation:
- `npx prisma validate`
- `npx prisma generate`
- migration or db push succeeds locally

---

### AUTH-001 — Auth.js and workspace session

**Goal:** Implement real auth and session-based identity.

Requirements:
1. Google OAuth support.
2. Dev-only sign-in path allowed only in development.
3. First sign-in redirects to onboarding.
4. Session includes user id and active workspace id.
5. No fake production sign-in.

Validation:
- sign in dev flow
- protected app routes redirect when logged out
- no client-provided user id trusted

---

### PERM-001 — Central permission layer

**Goal:** Create workspace membership authorization helpers.

Requirements:
1. `src/lib/permissions` helpers.
2. `requireWorkspaceMember`.
3. `requireWorkspaceOwner`.
4. common errors.
5. integration tests for unauthenticated/member/non-member.

Validation:
- tests prove cross-workspace denial

---

### SHELL-001 — App shell

**Goal:** Build calm app shell and primary nav.

Requirements:
1. Sidebar items only: Home, Inbox, Tasks, Projects, Notes, Calendar, Settings.
2. Neutral PlanGlade tokens aligned with the current branch style system.
3. Top bar with workspace, search placeholder, quick capture entry.
4. Responsive enough not to break mobile.

Validation:
- navigate every route placeholder
- no console errors

---

## 3. Phase 1 — Solo Core Workflow

### HOME-001 — Home dashboard

**Goal:** Build the Today/Focus command center.

Sections:
- quick capture
- today tasks
- overdue
- inbox summary
- next up
- recent notes/docs
- project focus card

Rules:
- no fake metrics
- no time tracking
- no enterprise KPIs

---

### INBOX-001 — Real inbox capture

**Goal:** Fast capture and triage.

Requirements:
1. Create inbox item.
2. List pending inbox items.
3. Convert item to task transactionally.
4. Dismiss item.
5. Workspace scoped.
6. Server-side validation.

Acceptance:
- converting item creates Task and marks InboxItem converted.
- no duplicate item remains pending.

---

### TASKS-001 — Task list

**Goal:** Main task hub list view.

Requirements:
1. Create/update/delete task.
2. Status/priority/project/due date.
3. Filters: all, today, upcoming, overdue, no date, blocked, completed.
4. Right drawer or detail panel.
5. Workspace scoped.

---

### TASKS-002 — Board view toggle

**Goal:** Add Kanban view inside Tasks.

Requirements:
1. Toggle list/board.
2. Columns by status.
3. Move task status.
4. Not a separate sidebar route.
5. Same task source as list.

---

### PROJECTS-001 — Projects list

**Goal:** Clean project list.

Requirements:
1. Create/edit/archive project.
2. Show status, progress, next task, open count, linked note/doc count, last active.
3. No vanity dashboard.

---

### PROJECTS-002 — Project detail overview

**Goal:** Project Home that answers what matters next.

Tabs:
- Overview
- Tasks
- Docs placeholder if docs not built yet
- Calendar
- Timeline hidden

Requirements:
1. description/context
2. next task
3. overdue/blocked signal
4. linked notes/docs
5. quick add task

---

### NOTES-001 — Notes core

**Goal:** Basic note system.

Requirements:
1. create/edit/delete note
2. search
3. project association
4. editor can be textarea/markdown first
5. workspace scoped

---

### NOTES-002 — Note-to-task extraction

**Goal:** Reduce friction between notes and action.

Requirements:
1. Parse checklist lines like `- [ ]`.
2. User can create tasks from selected checklist lines.
3. Tasks link to source note if model supports it or include backlink metadata later.
4. No AI required.

---

### CALENDAR-001 — Calendar month over tasks

**Goal:** Calendar as task view.

Requirements:
1. Month view.
2. Tasks appear by due date.
3. Create task from day.
4. Click task opens task drawer/detail.
5. “No date” list.

---

## 4. Phase 2 — Public MVP

### DOCS-001 — Project docs

**Goal:** Structured docs inside projects.

Requirements:
1. Doc list in project.
2. Create/edit/archive/delete.
3. Basic editor.
4. Workspace and project scoped.
5. No external editor dependency unless justified.

---

### SETTINGS-001 — Data export

**Goal:** Safe workspace export.

Requirements:
1. Export workspace JSON.
2. Includes projects, tasks, notes, docs, inbox items.
3. No secrets.
4. Filename `planglade-workspace-YYYY-MM-DD.json`.

---

### SELFHOST-001 — Docker/self-host baseline

**Goal:** Credible self-host path.

Requirements:
1. Dockerfile.
2. docker-compose.yml.
3. `.env.example`.
4. docs/SELF_HOSTING.md.
5. docs/BACKUP_RESTORE.md.
6. health endpoint.

---

### LANDING-001 — Research-aligned landing page

**Goal:** Product-first public landing.

Requirements:
1. Product-first hero aligned with the current app style.
2. Trust badges: Open source / Self-hostable / Solo-first.
3. Painpoint copy around low-friction, one source of truth, less bloat.
4. No fake features.
5. No pricing nav.
6. No landscape/camp/forest/mountain art.
7. No forced green/moss/sage visual system.
8. Use real screenshots/assets only when available.

---

### OSS-001 — Public repo docs

**Goal:** Prepare for public release.

Files:
- README.md
- LICENSE placeholder/decision note
- SECURITY.md
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- ROADMAP.md
- docs/ARCHITECTURE.md
- docs/AUTH.md
- docs/PRIVACY.md

---

### SECURITY-001 — Pre-public security baseline

**Goal:** Audit before public launch.

Requirements:
1. No secrets.
2. Auth routes protected.
3. Workspace scoping tests.
4. No fake dev bypass in production.
5. No stack traces.
6. Rate limits for auth/import if implemented.

---

## 5. Phase 3 — Planning Power

### TIMELINE-001 — Timeline v1

**Goal:** Simple timeline/Gantt based on tasks.

Requirements:
1. Query tasks with start/due dates.
2. Group by project.
3. Task bars.
4. Today line.
5. Week/month zoom.
6. Click opens task drawer.
7. Hidden route becomes visible only after useful.

---

### DEPENDENCY-001 — Dependencies

**Goal:** Model and UI for “A before B.”

Requirements:
1. Add blocker/blocked relationships.
2. Prevent self-dependency.
3. Prevent duplicate dependency.
4. Show blocked indicator in task list/project overview.
5. Show dependency line/marker in timeline if practical.

---

### RECURRENCE-001 — Recurring tasks

**Goal:** Support habits and repeated work.

Requirements:
1. Simple recurrence rules: daily, weekly, monthly.
2. Generate next occurrence on completion or scheduled job alternative.
3. Avoid complex RRULE UI at first.

---

### CALENDAR-002 — Week view and time blocks

**Goal:** Improve planning granularity.

Requirements:
1. Week view.
2. Optional scheduled start/end time for task.
3. No duplicate events.
4. External sync still deferred.

---

## 6. Phase 4 — Sharing and PWA

### PWA-001 — Responsive/PWA polish

**Goal:** Make web app viable on mobile.

Requirements:
1. responsive layouts for core pages
2. app manifest
3. installability
4. mobile capture optimized

---

### COLLAB-001 — Invites and roles

**Goal:** Enable small shared workspaces.

Requirements:
1. invite user
2. role owner/admin/member
3. permissions enforced
4. solo UX unchanged

---

### SHARED-001 — Shared/family workspace polish

**Goal:** Make shared lists usable without team bloat.

Requirements:
1. simple assigned-to-me filter
2. shared project/list patterns
3. no enterprise admin screens

---

## 7. Phase 5 — Optional Power

### TIME-001 — Lightweight time tracking

Only after core planning is stable.

Requirements:
1. manual time entry
2. start/stop timer
3. task/project association
4. monthly project/client summary
5. CSV export
6. no screenshots/surveillance/productivity policing

---

### IMPORT-001 — Guided import

Requirements:
1. import preview
2. duplicate warning
3. append-only first
4. no destructive replace in normal flow
5. support simple CSV/JSON

---

### REPORTS-001 — Basic reports

Requirements:
1. project progress
2. completed tasks over time
3. overdue/blocked summary
4. no fake metrics
5. no team performance scoring

---

## 8. Suggested First 12 Codex Tasks

1. SETUP-001 — Initialize app.
2. SETUP-002 — Prisma schema and DB.
3. AUTH-001 — Auth and onboarding.
4. PERM-001 — Permission helpers and tests.
5. SHELL-001 — App shell/nav/tokens.
6. INBOX-001 — Inbox capture/conversion.
7. TASKS-001 — Task list CRUD/filtering.
8. PROJECTS-001 — Projects list.
9. PROJECTS-002 — Project detail overview.
10. NOTES-001 — Notes core.
11. CALENDAR-001 — Calendar month over tasks.
12. DOCS-001 — Project docs.

Then build landing/self-host/OSS docs for public MVP.

---

## 9. Ticket Prompt Template for Codex

Use this exact structure:

```text
Task Name:
Goal:
Context:
Allowed Areas:
Do-Not-Touch:
Requirements:
Acceptance Criteria:
Design Reference:
Validation Steps:
Completion Report Required:
```

Rules:
- One ticket only.
- Exact files/areas.
- No unrelated cleanup.
- Report skipped items.
- Run validation.

---

## 10. Public MVP Exit Criteria

PlanGlade is ready for honest public alpha when:

- User can sign in.
- User can create workspace.
- User can capture an inbox item.
- User can convert it to task.
- User can create project.
- User can attach task to project.
- User can create note/doc for project.
- Calendar shows task due dates.
- Settings can export data.
- Landing page does not overclaim.
- Self-host docs are accurate.
- CI passes.
- Basic security audit passes.
- No fake features are visible.

---

## 11. Current Branch Status Note

ALIGN-001 was completed on the current branch:
- `/` is now a simple honest PlanGlade landing page.
- `/app` remains the app Home.
- `/onboarding` no longer 404s.
- Active shell branding says PlanGlade.
- Advanced top-level routes redirect back to MVP surfaces.
- Validation passed: lint, typecheck, tests, Prisma validate, and build.
- `prisma generate` still has a local Windows EPERM DLL lock risk.
