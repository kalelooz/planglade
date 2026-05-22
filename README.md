# FlowBoard

FlowBoard is a frontend-first project management prototype built with Next.js 16, TypeScript, Tailwind CSS, and shadcn/ui. The current goal is to turn the existing polished demo into a simple, fast, trustworthy product for solo users and small teams.

The product direction is intentionally narrow: help someone capture work quickly, know what matters now, organize tasks without friction, and avoid losing context.

## Current Status

FlowBoard is not production-ready yet.

- The frontend MVP loop is now local-first and wired through shared client state.
- User-created workspace data persists in `localStorage`.
- Auth now supports a production adapter path via NextAuth providers, with a dev-session fallback for local bootstrapping.
- Prisma contains FlowBoard domain models; migration/deployment hardening and broader server wiring are still pending.
- The API exposes health/bootstrap/session endpoints and server-backed CRUD; client wiring is still incomplete across views.
- Google login is now available through Firebase Auth when `FLOWBOARD_AUTH_MODE=firebase`.
- Initial server CRUD routes now exist for projects, work items, and notes.
- Initial server CRUD routes now exist for labels, saved views, and user settings.
- Initial `workspace/import-local` route now exists for local-to-server data migration.
- Settings now includes local-to-server migration actions (`append` / `replace`) that call `workspace/import-local`.
- Settings now supports server-backed workspace JSON snapshot export/import (active workspace only) and restores user settings from snapshot payloads.
- Project mode and feature-flag enforcement now gates comments/mentions/notifications/subtasks/relations/attachments on mutable routes.
- Firebase Storage attachment upload pipeline now supports signed upload URLs (`POST /api/attachments/upload-url`) and validated metadata persistence (`POST /api/attachments`).
- Attachment download now supports short-lived signed read URLs (`GET /api/attachments/:attachmentId/download-url`).
- Attachment storage now supports provider selection: `FLOWBOARD_STORAGE_PROVIDER=firebase` (production) or `FLOWBOARD_STORAGE_PROVIDER=local` (local signed binary upload/download routes).
- Relation authorization boundary tests now cover cross-workspace/cross-project project checks for work-item relation guards.
- Attachment authorization boundary tests now cover cross-workspace and feature-flag checks for project attachment access.
- Unified workspace search API now exists across projects/work-items/notes/labels (`GET /api/search`).
- `My Tasks` now reads from server work-items and uses server-backed complete/delete mutations.
- `Home` now reads server work-items/notes and uses server-backed complete + quick-capture task creation.
- `Projects` now reads server projects/work-items and uses server-backed project/task core mutations.
- Team, Activity, Reports, Connections, Board, and Work Items remain secondary until their data is real.
- The next milestone is the full-stack foundation: real schema, auth direction, typed API contracts, and server-backed persistence.

Treat the app as a strong local-first prototype until the core task/project/note model is persisted on the server.

## Development Workflow

Work incrementally. Each session should start with a short TODO list, then solve and validate one item at a time before moving to the next.

Use the fast lane by default: keep investigation narrow, make the smallest useful slice, and run only the checks that prove that slice. Full lint/build/test runs and broad browser sweeps are reserved for shared infrastructure, routing, persistence, cross-page state, or explicit user requests.

Current priority:

1. Preserve the completed frontend core loop.
2. Replace placeholder Prisma/API/auth pieces with real FlowBoard foundations.
3. Move tasks, projects, notes, settings, saved views, and activity from local client state to server-backed persistence.
4. Add collaboration only after single-user server persistence is durable.

For UI work, prefer existing shadcn/ui, Radix, Tailwind variables, Lucide icons, TanStack Table, and Zustand patterns. Avoid decorative dashboards, fake chrome, vanity metrics, and custom widgets where a proven primitive already fits.

## Documentation Map

- `AGENTS.md` - operating instructions for agents working in this repo.
- `docs/ACTIVE_PLAN.md` - canonical execution plan. Agents should read this before changing code.
- `docs/FULLSTACK_ROADMAP.md` - full-stack gap analysis, external repo lessons, and production roadmap.
- `docs/QUALITY-GATES.md` - validation rules before a slice is called complete.
- `docs/audits/` - strategic audits and research synthesis. Reference only, not active execution plans.
- `docs/archive/` - completed plans, rollback patches, and historical worklogs. Do not treat as current roadmap.
- `Reddit/` - protected voice-of-customer research. Do not delete.

## Product Priorities

### Completed Frontend Loop

- Home/Today screen with Quick Capture.
- Inbox for unorganized captured work.
- Projects/Kanban with honest task actions.
- My Tasks as a reliable personal work surface.
- Notes with search and task linking direction.
- Calendar and Timeline driven by real task dates.
- Shared Zustand workspace state with local persistence.

### Build Next

- Real Prisma schema for FlowBoard domain models.
- Production auth adapter and server session checks.
- Typed API/server-action mutation layer.
- Server-backed workspace bootstrap and CRUD.
- One-time localStorage import/reset path.
- Real activity records generated by mutations.

### Defer

- Graph View polish.
- Team management polish.
- Project reports and analytics.
- Landing-page marketing work.
- Advanced automation and settings.

## Current Views

- Home - daily command center with Quick Capture, Today, Overdue, Inbox, and Recent Notes.
- Projects/Kanban - connected to shared task/project state.
- Timeline/Gantt - driven by task start and due dates with current-date awareness.
- My Tasks - compact personal work surface with direct completion controls.
- Notes - searchable Markdown note surface with clearer capture/edit state.
- Calendar - driven by real task dates.
- Graph, Activity, Team, Reports - keep available only after their data is real, or move behind advanced navigation.
- Settings - only keep settings that are persisted or clearly useful to the current frontend slice.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS v4 and CSS custom properties |
| UI Components | shadcn/ui and Radix primitives |
| State Management | Zustand |
| Theme | next-themes |
| Icons | Lucide React |
| Tables | TanStack Table |
| Charts | Recharts |
| Drag and Drop | dnd-kit |
| Markdown | react-markdown |
| CSV | PapaParse |
| Toasts | Sonner |

## Project Structure

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    flowboard/
      app-sidebar.tsx
      command-palette.tsx
      dashboard.tsx
      kanban-board.tsx
      my-tasks-view.tsx
      notes-view.tsx
      calendar-view.tsx
      gantt-view.tsx
      universal-drawer.tsx
      workspace-model.ts
      workspace-store.ts
    ui/
  hooks/
  lib/
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

### Run Tests

```bash
npm test
```

### Auth Modes

- Default local mode: `FLOWBOARD_AUTH_MODE=dev` (or unset) uses the seeded dev session.
- Recommended production mode: set `FLOWBOARD_AUTH_MODE=firebase` and configure client + admin env vars:
  - Client: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` (optional: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`)
  - Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (or `FIREBASE_PRIVATE_KEY_BASE64`)
- Legacy provider mode: set `FLOWBOARD_AUTH_MODE=nextauth` and configure at least one provider:
  - `GITHUB_ID` + `GITHUB_SECRET`, or
  - `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- Also set `NEXTAUTH_SECRET` and `NEXTAUTH_URL` for provider mode.
- Keep client/server mode aligned by also setting `NEXT_PUBLIC_FLOWBOARD_AUTH_MODE` to the same value (`dev` / `firebase` / `nextauth`).
- Production guardrail: `npm run build` and `npm run start` now run `validate:auth-config` to fail fast on invalid auth/env configuration.

### Attachment Storage Modes

- Production: set `FLOWBOARD_STORAGE_PROVIDER=firebase` with `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET`.
- Local development: set `FLOWBOARD_STORAGE_PROVIDER=local` to use local signed binary routes:
  - `PUT /api/attachments/upload-binary`
  - `GET /api/attachments/download-binary`
- Optional local overrides:
  - `FLOWBOARD_LOCAL_STORAGE_DIR` (default `storage/local-attachments`)
  - `FLOWBOARD_STORAGE_SIGNING_SECRET` (recommended even in local mode)

## Deployment

- CI is configured in `.github/workflows/ci.yml`.
- Firebase App Hosting runtime config is in `apphosting.yaml`.
- Deployment runbook: `docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`.

## Known Quality Issues

- Prisma client regeneration can fail when query-engine binaries are locked by a running process; stop active dev servers before `npm run db:generate` if needed.
- Production auth lifecycle validation is still pending across sign-in/sign-out/refresh-expiry flows in `firebase` and `nextauth` modes.

See `docs/ACTIVE_PLAN.md`, `docs/FULLSTACK_ROADMAP.md`, and `docs/QUALITY-GATES.md` before claiming a slice is complete.

## License

MIT
