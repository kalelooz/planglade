# FlowBoard

A modern, full-featured project management application built with Next.js 16, TypeScript, and shadcn/ui. FlowBoard provides a comprehensive workspace for managing projects, tasks, notes, and team collaboration - all in a single, polished interface.

## Development Workflow

FlowBoard is built incrementally. Each session should define a short TODO list, then solve and validate one TODO at a time before starting the next. The current priority is UI/UX frontend refinement first; backend, auth, and deeper persistence work should wait unless they are required to support or validate a frontend slice.

For UI/UX work, prefer proven libraries and mature component patterns over hand-designed custom UI. Use the existing shadcn/ui, Radix, Tailwind, Lucide, TanStack, and Zustand stack first, and use MCP/tools when they help validate browser behavior, inspect current docs, or reuse a design-system pattern. Commit validated incremental slices locally so the project always has a recoverable checkpoint.

## Features

### Views

- **Dashboard** — KPI cards, project list with progress bars, upcoming tasks, and activity feed with entity chips
- **Projects (Kanban)** — Drag-and-drop Kanban board with 4 columns (Backlog, In Progress, In Review, Done), task cards with priority borders, tag chips, CSV export/import
- **Timeline (Gantt)** — Interactive Gantt chart with day/week/month zoom levels, scroll synchronization, today line, overdue indicators, task tooltips
- **My Tasks** — Personal task queue (placeholder for future development)
- **Notes** — Two-panel markdown notes with linked tasks, linked notes, tag chips, import/export
- **Graph View** — Interactive SVG relationship graph with zoom/pan, hover highlights, node click navigation, task detail popovers
- **Activity Log** — Filterable activity feed with date grouping, search, user/project/action filters, CSV export
- **Team Members** — Member cards with availability indicators, workload charts (Recharts stacked bar), current tasks list
- **Project Report** — Print-ready report with burndown chart, donut chart, workload bar chart, sortable task table
- **Settings** — General, Appearance (theme + accent color), Notifications, Data (export/import/clear)

### Core Features

- **Universal Detail Drawer** — Slide-in Sheet panel for tasks, projects, notes, and members. Click any entity name or avatar across all views to open its detail panel.
- **Command Palette** — `Cmd+K` / `Ctrl+K` to search and navigate across views, projects, tasks, notes, and reports
- **Dark Mode** — Full dark/light/system theme support via next-themes
- **Accent Colors** — 6 accent color presets (Teal, Blue, Purple, Orange, Rose, Green) that update CSS variables globally
- **Entity Chips** — Two variants: "default" (colored pill) and "subtle" (whisper-style inline highlight). Clickable chips open the detail drawer.
- **Toast Notifications** — Sonner toasts on every meaningful action (task moves, settings changes, exports, imports)
- **Confirmation Dialogs** — AlertDialog for destructive actions (e.g., Clear All Data in Settings)
- **Responsive Sidebar** — Collapsible sidebar with nav items, active view highlighting, and mobile auto-close

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + CSS custom properties |
| **UI Components** | shadcn/ui (37 Radix primitives) |
| **State Management** | Zustand 5 |
| **Theme** | next-themes (class-based) |
| **Animations** | Framer Motion |
| **Charts** | Recharts 2 |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable |
| **Markdown** | react-markdown |
| **CSV** | PapaParse |
| **Toasts** | Sonner |
| **Font** | Satoshi (via fontshare) |

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Tailwind v4 theme + CSS variables
│   ├── layout.tsx           # Root layout with ThemeProvider
│   └── page.tsx             # View router + DrawerProvider
├── components/
│   ├── flowboard/
│   │   ├── activity-log.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── command-palette.tsx
│   │   ├── dashboard.tsx
│   │   ├── drawer-context.tsx
│   │   ├── drawer-data.tsx
│   │   ├── entity-chips.tsx
│   │   ├── gantt-view.tsx
│   │   ├── graph-view.tsx
│   │   ├── header.tsx
│   │   ├── kanban-board.tsx
│   │   ├── nav-store.tsx
│   │   ├── notes-view.tsx
│   │   ├── project-report.tsx
│   │   ├── settings-view.tsx
│   │   ├── team-view.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── universal-drawer.tsx
│   └── ui/                  # shadcn/ui primitives
├── hooks/
└── lib/
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## Architecture Notes

- **All data is mock/in-memory** — FlowBoard uses hardcoded mock data for demonstration. No database or API is required.
- **Zustand navigation store** — `nav-store.tsx` manages `activeView`, `selectedNoteId`, and `selectedProjectId` state.
- **DrawerContext** — `drawer-context.tsx` provides `openDrawer(type, id)` / `closeDrawer()` for the universal slide-in panel.
- **EntityChip** — `entity-chips.tsx` renders inline entity references with two visual variants and optional drawer integration via `entityId`.
- **CSS variable theming** — The accent color system overrides CSS custom properties on `:root` and `.dark` via a dynamically injected `<style>` tag, ensuring theme switching works correctly.
- **Print stylesheet** — `globals.css` includes print styles that hide the sidebar/header and format the Project Report for printing.

## License

MIT
