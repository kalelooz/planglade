# FlowBoard Full-Stack Roadmap

Last updated: 2026-05-20

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

- [ ] Real auth: replace mocked session storage auth with production sessions, OAuth/email login, account lifecycle, and server-side authorization.
- [ ] Real data model: replace the sample Prisma `User` and `Post` models with FlowBoard models for workspace, membership, project, work item, note, label, saved view, activity, settings, comments, attachments, and task relations.
- [ ] API mutation layer: replace the placeholder `src/app/api/route.ts` with typed routes or server actions for create, update, move, complete, delete, search, and settings mutations.
- [ ] Persistence migration: migrate from client-only `localStorage` to Prisma-backed persistence, with a one-time import path for existing local workspace data.
- [ ] Authorization boundaries: enforce user/workspace/project permissions on every read and mutation.
- [ ] Validation and errors: use Zod schemas at API boundaries and return consistent field and request errors.
- [ ] Server-derived activity: generate activity entries from real mutations instead of static or inferred UI data.
- [ ] Collaboration basics: members, roles, assignments, comments, mentions, and invitations.
- [ ] Files and uploads: task/note attachments with local development storage and production object storage.
- [ ] Search: indexed search across work items, notes, projects, and labels.
- [ ] Notifications: in-app notification records first, email later.
- [ ] Production build hygiene: cross-platform start/build scripts, no ignored TypeScript errors, stable package-manager usage, CI checks, and deployment configuration.
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

- [ ] Replace `src/app/api/route.ts` hello-world behavior with real health and product API routes.
- [ ] Replace Prisma sample `User`/`Post` schema with FlowBoard domain models.
- [ ] Replace mocked `auth-context.tsx` with a production auth adapter and server session checks.
- [ ] Remove or keep disabled any Team, Activity, Reports, Connections, Board, and Work Items actions that do not read/write real data.
- [x] Update README status so it no longer says local persistence is still the next milestone.
- [x] Update `AGENTS.md` so project instructions point to the full-stack foundation.
- [ ] Update build/start scripts to be Windows-safe and deployment-safe.
- [ ] Remove `typescript.ignoreBuildErrors` from `next.config.ts` before production.
- [ ] Normalize package-manager usage before dependency cleanup.

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

- [ ] Choose deployment target and database path for v1 production. Recommended default: Next.js app plus PostgreSQL through Prisma.
- [ ] Replace sample Prisma schema with FlowBoard schema.
- [ ] Add Zod schemas for core create/update payloads.
- [ ] Define API contracts for work items, projects, notes, labels, saved views, settings, and activity.
- [ ] Add auth provider decision and environment validation.
- [ ] Fix project-level red gates: TypeScript build errors must fail builds, build/start scripts must be cross-platform, and package-manager usage must be consistent.

Done when: Prisma can migrate a real FlowBoard schema, API contracts are documented, and the app can still run the frontend loop.

### Phase 2 - Backend Core Loop

Goal: move the current local-first loop onto the server without expanding scope.

- [ ] Implement authenticated workspace bootstrap.
- [ ] Implement CRUD for projects, work items, notes, labels, saved views, and settings.
- [ ] Connect Home, Inbox, Projects, My Tasks, Notes, Calendar, and Timeline to server data.
- [ ] Preserve optimistic UI where it is already useful, but reconcile with server state.
- [ ] Add one-time localStorage import/reset affordance.
- [ ] Generate activity records from create/update/complete/delete/move mutations.

Done when: a signed-in user can create, edit, move, complete, delete, refresh, sign out, sign back in, and see the same data.

### Phase 3 - Collaboration MVP

Goal: support small teams without turning the app into enterprise admin software.

- [ ] Add workspace members and project memberships.
- [ ] Add roles: owner, admin, member, viewer.
- [ ] Add assignment, comments, mentions, and simple invitations.
- [ ] Make Team and Activity real or keep them out of primary navigation.
- [ ] Add authorization tests for cross-workspace and cross-project access.

Done when: two users can collaborate in one workspace without seeing data from another workspace.

### Phase 4 - Production Data Features

Goal: add the data features expected of a dependable PM tool.

- [ ] Add attachments with local development storage and production object storage.
- [ ] Add search across projects, work items, notes, and labels.
- [ ] Add saved custom views using the Plane/Focalboard-inspired view preference model.
- [ ] Add task relations: parent, blocked by, blocking, related.
- [ ] Add in-app notifications for mentions, assignment, due changes, and comments.

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

- [ ] CI for lint, TypeScript, unit tests, Prisma validation, and a small Playwright smoke suite.
- [ ] Database migration and backup procedure.
- [ ] Logging, error reporting, and request tracing.
- [ ] Rate limiting and abuse controls for auth and mutations.
- [ ] Security review for auth, authorization, file upload, secrets, and tenant boundaries.
- [ ] Deployment runbook with rollback steps.

Done when: the app can be deployed, monitored, upgraded, backed up, and rolled back with documented procedures.

## Recommended Next Slice

Start with Phase 1:

1. Replace the Prisma sample schema with the real FlowBoard domain schema.
2. Add Zod schemas for work item, project, note, and saved view payloads.
3. Replace the hello-world API route with a real health route plus initial workspace bootstrap route.
4. Keep the existing UI behavior intact while preparing server-backed data.
