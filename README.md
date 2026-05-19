# FlowBoard

FlowBoard is a frontend-first project management prototype built with Next.js 16, TypeScript, Tailwind CSS, and shadcn/ui. The current goal is to turn the existing polished demo into a simple, fast, trustworthy product for solo users and small teams.

The product direction is intentionally narrow: help someone capture work quickly, know what matters now, organize tasks without friction, and avoid losing context.

## Current Status

FlowBoard is not production-ready yet.

- Data is mostly mock or in-memory.
- Auth is mocked.
- Prisma and the API route are placeholders, not the product backend.
- Several views look functional before the underlying actions are durable.
- The next milestone is a reliable frontend loop with shared client state and local persistence.

Treat the app as a UI/UX prototype until the core task/project/note model is centralized and persisted.

## Development Workflow

Work incrementally. Each session should start with a short TODO list, then solve and validate one item at a time before moving to the next.

Use the fast lane by default: keep investigation narrow, make the smallest useful slice, and run only the checks that prove that slice. Full lint/build/test runs and broad browser sweeps are reserved for shared infrastructure, routing, persistence, cross-page state, or explicit user requests.

Current priority:

1. UI/UX frontend refinement.
2. Honest, working first-screen flows.
3. Shared frontend state for tasks, projects, notes, and settings.
4. Local persistence.
5. Backend, auth, and database work only after the frontend loop is real.

For UI work, prefer existing shadcn/ui, Radix, Tailwind variables, Lucide icons, TanStack Table, and Zustand patterns. Avoid decorative dashboards, fake chrome, vanity metrics, and custom widgets where a proven primitive already fits.

## Documentation Map

- `AGENTS.md` - operating instructions for agents working in this repo.
- `AUDIT_AND_ROADMAP.md` - strategic audit, Reddit synthesis, competitor gaps, and long-range roadmap.
- `docs/PAGE-BY-PAGE-PLAN.md` - execution order and acceptance criteria for page-by-page UI work.
- `docs/QUALITY-GATES.md` - validation rules before a slice is called complete.
- `worklog.md` - historical implementation note; do not treat it as current verification.
- `Reddit/` - protected voice-of-customer research. Do not delete.

## Product Priorities

### Build First

- Home/Today screen with Quick Capture.
- Inbox for unorganized captured work.
- Projects/Kanban with honest task actions.
- My Tasks as a reliable personal work surface.
- Notes with search and task linking direction.
- Calendar and Timeline driven by real task dates.

### Defer

- Graph View polish.
- Team management polish.
- Project reports and analytics.
- Landing-page marketing work.
- Backend/auth/database depth.
- Advanced automation and settings.

## Current Views

- Dashboard/Home - currently demo-heavy; should become Today, Inbox, Overdue, and Quick Capture.
- Projects/Kanban - visually useful, but must be wired to shared task/project state.
- Timeline/Gantt - useful later, but date logic must come from real task fields.
- My Tasks - should become the main table/list work surface; fake bulk actions must become real or be disabled.
- Notes - good direction, but should gain search and stronger task linkage.
- Calendar - should use real task dates and support planning workflows.
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

## Known Quality Issues

- `npm run build` is not currently Windows-safe because the build script uses Linux `cp`.
- `npm run lint` has known failures from the audit.
- `next.config.ts` currently ignores TypeScript build errors.
- Package-manager usage should be normalized before dependency cleanup.

See `AUDIT_AND_ROADMAP.md` and `docs/QUALITY-GATES.md` before claiming a slice is complete.

## License

MIT
