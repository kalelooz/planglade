# FlowBoard Full-Stack Roadmap

Last updated: 2026-05-22

This document records where FlowBoard is now, what has already been completed, what is missing for a production full-stack app, and which ideas from `external/pm-repos/` should influence the next build phases.

## Current State

FlowBoard has completed the frontend-first MVP loop:

- [x] Primary navigation is focused on Home, Inbox, Projects, My Tasks, Notes, and Calendar.
- [x] Advanced surfaces are demoted from the first-run path.
- [x] Quick Capture creates task state used by Home, Inbox, My Tasks, Projects, Calendar, and Timeline.
- [x] My Tasks has real row completion behavior.
- [x] Calendar and Timeline use task dates instead of hardcoded demo dates.
- [x] Notes have search, clearer capture/edit state, and better selected-note readability.
- [x] Core workspace state is centralized in Zustand and persisted to `localStorage`.
- [x] Basic model tests exist for quick capture and Home section selection.

FlowBoard is not production-ready yet. The app is currently a strong local-first frontend prototype, not a full-stack product.

## Missing for a Full-Stack App

- [ ] Production auth lifecycle hardening: Firebase Google login mode is wired, client token refresh/bootstrap hardening is in place (`onIdTokenChanged` + fresh token resolution in session bootstrap), and app-shell sign-out is now mode-aware (`firebase` / `nextauth`), but full sign-in/sign-out/session-expiry and account lifecycle validation across all core routes is still pending.
- [ ] Authenticated session bootstrap completion: `GET /api/auth/session` supports `dev`, `nextauth`, and `firebase` modes, with invalid-mode/provider-misconfig guards, shared env validation, and `/api/health` auth diagnostics; provider deployment checks and full lifecycle verification are still pending.
- [x] Real data model: Prisma now uses FlowBoard domain models for workspace, membership, project, work item, note, label, saved view, activity, settings, comments, attachments, and task relations.
- [x] API mutation layer baseline: typed CRUD/mutation routes now include attachments, work-item relations, and unified search; project mode/feature-flags are enforced on currently mutable optional modules (comments/mentions/notifications/subtasks/relations/attachments).
- [ ] Persistence migration completion: one-time local-to-server import and server snapshot export/import are in place, but full server-authoritative restore hardening and rollback QA are still pending.
- [ ] Authorization boundaries: role checks are enforced on core mutation routes; cross-workspace and cross-project test coverage is still pending.
- [x] Validation and errors baseline: Zod is in use at API boundaries for core payloads, with consistent error helpers.
- [x] Server-derived activity baseline: core work-item/project/note/comment mutations now generate activity events.
- [ ] Collaboration completion: members/roles/comments/mentions are live, while invitation lifecycle and deeper project membership workflows remain.
- [ ] Files and uploads: task/note attachment authorization + signed upload URL flow are live; storage/upload pipeline hardening is still pending.
- [x] Search baseline: workspace-scoped search API now covers work items, notes, projects, and labels.
- [x] Notifications: durable in-app notification records now back mentions, assignments, due/status updates, and comments. Email delivery remains deferred.
- [ ] Production build hygiene completion: package manager and start script normalization are done; CI/deployment validation gates are still pending. (partial: GitHub Actions CI baseline committed)
- [ ] Operations: environment validation, migrations, backups, logging, error reporting, rate limits, and rollback procedure.

## External Repo Lessons

### Plane

Use Plane as the main reference for work-item shape and view architecture.

- `adopt now`: Treat list, kanban, calendar, spreadsheet/table, and timeline as views over one work-item model.
- `adopt now`: Store view preferences separately from work items: layout, group by, order by, display properties, filters, and pagination.
- `adapt locally`: Use a simpler version of Plane's work item fields: status/state, priority, labels, assignees, project, parent, start date, due date, completed date, sort order, and timestamps.
- `defer`: Cycles, modules, epics, analytics, and workspace-wide advanced views.
- `skip`: Copying Plane's multi-package architecture into this smaller Next.js app.

### Vikunja

Use Vikunja as the main reference for durable task semantics.

- `adopt now`: Model task completion with both status/done and `completedAt`.
- `adopt now`: Keep `startDate`, `dueDate`, and later `endDate` explicit.
- `adapt locally`: Add labels, assignees, reminders, relations, comments, attachments, and per-view positions incrementally.
- `defer`: Recurrence, CalDAV, unread state, favorites, and advanced reminders.
- `skip`: A separate Go API service unless the Next.js backend becomes a real bottleneck.

### Memos

Use Memos as the main reference for notes and quick capture.

- `adopt now`: Keep notes Markdown-first and fast to create.
- `adopt now`: Derive useful metadata from content, especially tags and checklist/task-list presence.
- `adapt locally`: Add note visibility, pinning, parent/comment relationships, and share links only after auth exists.
- `defer`: RSS, gRPC, MCP, and public memo sharing.
- `skip`: Rebuilding FlowBoard as a notes-first app. Notes support the project loop; they are not the whole product.

### Focalboard

Use Focalboard selectively for board and saved-view mechanics.

- `adopt now`: Boards/cards/views are a useful mental model for saved view state.
- `adapt locally`: Store per-view group, sort, filter, visible properties, hidden groups, collapsed groups, and card order.
- `defer`: Templates and complex per-board custom property systems.
- `skip`: Wholesale adoption. The standalone repo is marked unmaintained, so it should be inspiration only.

### Leantime

Use Leantime for product scope, not immediate feature breadth.

- `adopt now`: Keep the product approachable for non-project managers with progressive disclosure.
- `adapt locally`: Bring strategy, risks, retrospectives, goals, and timesheets in only as optional project modules later.
- `defer`: Plugin marketplace, broad enterprise admin, two-factor setup UI, LDAP/OIDC admin depth, and canvas-heavy planning.
- `skip`: Adding all PM features before the core work loop is server-backed and reliable.

## What to Update or Remove

- [x] Replace `src/app/api/route.ts` hello-world behavior with real health and initial workspace bootstrap API routes.
- [x] Replace Prisma sample `User`/`Post` schema with FlowBoard domain models.
- [x] Add initial Prisma-backed CRUD API routes for projects, work items, and notes.
- [x] Add initial `workspace/import-local` API route for local-to-server migration.
- [x] Add initial Prisma-backed CRUD API routes for labels, saved views, and user settings.
- [x] Enforce workspace scoping on update/delete routes for core entities.
- [x] Replace mocked `auth-context.tsx` with Firebase-backed Google auth support and server session token handoff.
- [x] Add `GET /api/auth/session` server session scaffold for workspace/user resolution in API-backed views.
- [ ] Remove or keep disabled any Team, Activity, Reports, Connections, Board, and Work Items actions that do not read/write real data.
- [x] Update README status so it no longer says local persistence is still the next milestone.
- [x] Update `AGENTS.md` so project instructions point to the full-stack foundation.
- [ ] Update build/start scripts to be Windows-safe and deployment-safe. (partial: `start` now uses cross-platform Node standalone command and CI baseline exists; broader deployment validation gates pending)
- [x] Remove `typescript.ignoreBuildErrors` from `next.config.ts` before production.
- [x] Normalize package-manager usage before dependency cleanup.

## Production Roadmap

### Phase 0 - Frontend Core Loop

Status: done.

- [x] Shared frontend task state.
- [x] Local persistence.
- [x] Honest primary navigation.
- [x] Home, Inbox, Projects, My Tasks, Notes, Calendar, and Timeline connected to the same client state.
- [x] Basic workspace model tests.

### Phase 1 - Full-Stack Foundation

Goal: make the app structurally ready for real persistence.

- [x] Choose deployment target and database path for v1 production. Decision (updated on May 21, 2026): Firebase App Hosting for Next.js runtime plus managed PostgreSQL (Neon) via Prisma. Keep SQLite for local development.
- [x] Replace sample Prisma schema with FlowBoard schema.
- [x] Add Zod schemas for core create/update payloads.
- [x] Define API contracts for work items, projects, notes, labels, saved views, settings, and activity.
- [x] Add auth provider decision and environment validation baseline. (`firebase` and `nextauth` modes are wired, production env guard script is enforced in build/start, and `/api/auth/session` + `/api/health` now surface auth misconfiguration early)
- [ ] Fix project-level red gates: TypeScript build errors must fail builds, build/start scripts must be cross-platform, and package-manager usage must be consistent. (partial: TypeScript ignore gate removed and start script normalized; package-manager normalization pending)

Done when: Prisma can migrate a real FlowBoard schema, API contracts are documented, and the app can still run the frontend loop.

### Phase 2 - Backend Core Loop

Goal: move the current local-first loop onto the server without expanding scope.

- [ ] Implement authenticated workspace bootstrap. (partial: session bootstrap now supports Firebase ID-token verification and NextAuth sessions)
- [x] Implement CRUD for projects, work items, notes, labels, saved views, and settings.
- [x] Connect Home, Inbox, Projects, My Tasks, Notes, Calendar, and Timeline to server data.
- [ ] Preserve optimistic UI where it is already useful, but reconcile with server state.
- [x] Add one-time localStorage import/reset affordance. Settings now provides `append`/`replace` migration controls backed by `workspace/import-local`.
- [x] Generate activity records from create/update/complete/delete/move/comment mutations for core entities.

Done when: a signed-in user can create, edit, move, complete, delete, refresh, sign out, sign back in, and see the same data.

### Phase 3 - Collaboration MVP

Goal: support small teams without turning the app into enterprise admin software.

- [x] Add workspace members and project memberships. (workspace member CRUD APIs implemented; project-specific membership still pending)
- [x] Add roles: owner, admin, member, viewer. (role model and server authorization gates implemented on core mutation routes)
- [ ] Generate server-derived activity and task history from real mutations.
- [ ] Add assignment, comments, mentions, and simple invitations. (partial: comments and mention parsing are live; invitations and full assignment workflows remain)
- [x] Add in-app notifications for mentions, assignment, due changes, and comments.
- [ ] Make Team, Activity, and Notifications real or keep them out of primary navigation.
- [ ] Add authorization tests for cross-workspace and cross-project access.

Done when: two users can collaborate in one workspace without seeing data from another workspace.

### Phase 4 - Production Data Features

Goal: add the data features expected of a dependable PM tool.

- [ ] Add attachments with local development storage and production object storage. (partial: attachment CRUD/auth + project-flag guards + signed upload URL route implemented)
- [x] Add search across projects, work items, notes, and labels.
- [ ] Add saved custom views using the Plane/Focalboard-inspired view preference model.
- [x] Add task relations: parent, blocked by, blocking, related.
- [x] Add server-backed settings import/export and workspace JSON export.
- [x] Add project-level feature flags before exposing optional modules such as docs, custom fields, SLA, and service-desk mode. (`Project.mode` + `featureFlags` plus comments/mentions/notifications/subtasks/relations/attachments enforcement on mutable routes; docs/custom-fields/SLA remain unsurfaced)

Done when: users can organize, retrieve, and link work without relying on browser-local state.

### Phase 5 - Reporting and Planning

Goal: make advanced surfaces real after the core product is durable.

- [ ] Reports from real task/project/activity data.
- [ ] Timeline dependencies once task relations exist.
- [ ] Calendar planning improvements after server due-date edits are stable.
- [ ] Lightweight goals/risks/retrospectives only if they support actual project workflows.
- [ ] CSV import/export after the data model stabilizes.

Done when: advanced screens summarize real data and no longer contradict primary views.

### Phase 6 - Production Hardening

Goal: prepare for real users.

- [ ] CI for lint, TypeScript, unit tests, Prisma validation, and a small Playwright smoke suite. (partial: GitHub Actions lint+typecheck baseline implemented)
- [ ] Database migration and backup procedure.
- [ ] Logging, error reporting, and request tracing.
- [ ] Rate limiting and abuse controls for auth and mutations.
- [ ] Security review for auth, authorization, file upload, secrets, and tenant boundaries.
- [x] Deployment runbook baseline for Firebase App Hosting is documented (`docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`).

Done when: the app can be deployed, monitored, upgraded, backed up, and rolled back with documented procedures.

## Recommended Next Slice

Continue with the collaboration foundation from `flowboard-collaboration-foundation-plan.md`:

1. Complete production auth validation for Firebase Google login mode (sign-in, sign-out, refresh/expiry, and protected-route behavior).
2. Add authorization tests for cross-workspace and cross-project access on collaboration and optional-module routes.
3. Harden attachment storage/upload path (dev + production object storage) and associated security boundaries.
4. Complete production auth lifecycle validation across all core routes.
