# FlowBoard Deep Project Audit & Critical Teardown

**Date:** May 20, 2026
**Target:** FlowBoard Project
**Scope:** Holistic codebase teardown, UI/UX critique, state management analysis, and architectural review.

---

## 1. The Brutal Truth: Prototype Facade vs. Production Reality

Let’s not sugarcoat it: FlowBoard is currently a beautifully painted movie set. From the outside, it looks like a polished, local-first project management application. Under the hood, however, it is entirely disconnected from its own production database schema and relies heavily on hardcoded mock data, fragmented state management, and optimistic "demo" actions. 

While the documentation (`docs/ACTIVE_PLAN.md` and `docs/FULLSTACK_ROADMAP.md`) claims that major views like "My Tasks" and "Projects" are now server-backed, **the source code tells a different story.** Major components (`my-tasks-view.tsx`, `kanban-board.tsx`, `dashboard.tsx`) are still importing static arrays from `drawer-data.ts` or relying on a local `zustand` store (`workspace-store.ts`) that persists to `localStorage`. 

The core mission right now must be destroying this facade and wiring the beautifully built UI to the `src/app/api/` routes and Prisma schema. 

---

## 2. Component-by-Component Teardown

### A. `dashboard.tsx` (Home / Command Center)
- **The Good:** The layout is restrained. The `QuickCapture` component is front-and-center, adhering to the "fast capture" product goal. 
- **The Bad:** It relies entirely on `useWorkspaceStore` (Zustand) and `selectHomeSections`. It has absolutely zero awareness of the server-side API or actual Prisma database. 
- **The Ugly:** The stats strip (`StatStrip`) is entirely disconnected from reality. It calculates "Today", "Overdue", and "Inbox" purely from local storage tasks. If a user logs in from another device, this dashboard will be empty. 
- **Verdict:** Needs a complete rewrite to fetch data via React Server Components (RSC) or React Query wrapping the `/api/work-items` endpoint.

### B. `kanban-board.tsx` (Projects / Kanban)
- **The Good:** The drag-and-drop mechanics using `@dnd-kit/core` are smooth and visually polished. The use of ghost cards during drag is a great UX touch.
- **The Bad:** This file is a staggering **1,343 lines long** and is bloated with hardcoded mock data (P1 through P5 projects, "Website Redesign" tasks, hardcoded tags). 
- **The Ugly:** Actions like `handleAddSubtask` and column dragging don't hit an API. They just mutate local state. Furthermore, the component is responsible for far too much—it handles DND context, CSV export, task creation dialogs, and rendering columns all in one massive file.
- **Verdict:** Extract the mock data immediately. Break the file down into `KanbanColumn.tsx`, `TaskCard.tsx`, and `BoardContainer.tsx`. Wire the drag-end events to trigger `PATCH /api/work-items/:id`.

### C. `my-tasks-view.tsx` (Personal Work Surface)
- **The Good:** TanStack Table integration is robust. Bulk actions and group headers by project look excellent and feel professional.
- **The Bad:** The file explicitly imports `tasks as allTasks` from `drawer-data.ts`. The documentation claims this is server-backed, but it is demonstrably false. 
- **The Ugly:** The bulk actions (`handleBulkAssign`, `handleBulkMove`, `handleBulkDelete`) literally fire `toast.success("... this is a demo action.")`. 
- **Verdict:** This page must be wired to fetch `GET /api/work-items?assignee=me`. The bulk actions need to hit real bulk mutation endpoints. 

### D. `universal-drawer.tsx` & `drawer-data.ts`
- **The Good:** Having a universal drawer for task/member details is a fantastic pattern that mimics high-end tools like Linear and Plane.
- **The Bad:** `drawer-data.ts` is a 1,000+ line file holding the entire structural integrity of the app's demo state.
- **The Ugly:** The app's dependency on `drawer-data.ts` means that ripping it out will break almost every view. 
- **Verdict:** `drawer-data.ts` must be treated as toxic debt. A transition plan must be made to replace every import of it with a real API call.

---

## 3. State Management & Persistence

### The LocalStorage Trap
FlowBoard is currently using `zustand/middleware`'s `persist` to save workspace data to `localStorage`. 
- While great for a local-first prototype, this fundamentally breaks the multi-user, collaborative nature of a PM tool.
- The `workspace/import-local` API route exists to migrate this data, but the app itself is not configured to act as a proper client to the server yet.

### The Missing Data Fetching Layer
There is no unified data fetching strategy. Next.js 14+ App Router encourages Server Components, yet almost all components (`"use client"`) manage their own local state. 
- **Recommendation:** Implement `@tanstack/react-query` or `SWR` for client-side data fetching, combined with Next.js Server Actions for mutations. 

---

## 4. Routing & Information Architecture Bloat

The `src/app` directory is bloated with routes that violate the "restrained MVP" mandate in `AGENTS.md`:
- `/activity`
- `/board`
- `/calendar`
- `/connections`
- `/inbox`
- `/my-tasks`
- `/notes`
- `/projects`
- `/report`
- `/settings`
- `/team`
- `/timeline`
- `/work-items`

**Critique:** Why do `/connections`, `/report`, and `/team` exist right now? The core loop (create task, view task, complete task) isn't even wired to the database yet. Having these routes creates a false sense of completion. 
**Action:** Move `/connections`, `/report`, and `/team` behind feature flags or delete them entirely until the core CRUD operations are stable.

---

## 5. API & Backend Deficiencies

### The Prisma Schema
The schema in `prisma/schema.prisma` is actually very well thought out.
- It correctly models Workspaces, Users, Projects, WorkItems, and Notes.
- It correctly handles relationships, cascading deletes, and enums.

### The Missing Middle
While the database schema is ready, and the API routes (e.g., `src/app/api/work-items/route.ts`) seem to have been scaffolded out, the frontend simply isn't talking to them. 
- **Authentication:** `auth-context.tsx` is mocking session storage. NextAuth is supposed to be in place according to the docs, but the UI is not gated properly by `getServerSession`.
- **Authorization:** There is no evidence of Row Level Security (RLS) or application-level workspace guards actively preventing User A from seeing User B's local storage data (because it's all local storage).

---

## 6. Styling & Design System

### The Good
- FlowBoard heavily relies on `shadcn/ui` and Tailwind CSS, keeping the visual identity tight.
- Micro-interactions (like hover states on priority badges and avatars) feel premium.
- Use of Lucide icons is consistent and clean.

### The Bad
- There are multiple hardcoded color values dispersed throughout components (e.g., `#01696f`, `#f59e0b` in `my-tasks-view.tsx`). These should be extracted to CSS variables in `globals.css` or Tailwind tokens to respect light/dark modes fully.
- Badge styles for priorities are copy-pasted into multiple files (`my-tasks-view.tsx`, `kanban-board.tsx`, `dashboard.tsx`). 

### The Action
- Create a `src/lib/design-tokens.ts` or centralize these styles in `globals.css` to prevent UI drift.

---

## 7. The Actionable Path Forward (Ripping off the Band-Aid)

If the goal is to make this a real, production-ready full-stack app, the following steps must be taken immediately and ruthlessly:

### Step 1: The Great Mock Purge
1. Delete `src/components/flowboard/drawer-data.ts` (or rename it to `deprecated-drawer-data.ts`).
2. Watch the TypeScript compiler explode. 
3. Fix the resulting errors by replacing the mock data with actual data fetching logic.

### Step 2: Wire the Core Loop
1. Wire `dashboard.tsx` to `GET /api/work-items`.
2. Wire `QuickCapture` to `POST /api/work-items`.
3. Wire `kanban-board.tsx` to fetch tasks by project from `GET /api/work-items?projectId={id}`.
4. Wire the DndKit `onDragEnd` event to a server action or API call that updates the task status and position in Postgres.

### Step 3: Auth & Session
1. Enforce NextAuth across the `src/app/layout.tsx`. If there is no session, redirect to `/login`.
2. Ensure every API route in `src/app/api` verifies the NextAuth session and workspace membership before returning data.

### Step 4: Component Refactoring
1. Break down `kanban-board.tsx` (1,343 lines is unacceptable).
2. Centralize shared UI logic (like `priorityBadgeStyle` and `taskStatusBadgeStyle`) into a shared `utils.ts` or component.

---

## Conclusion
FlowBoard has an A+ user interface and a D- backend integration. The gap between the roadmap's claims and the actual codebase is alarming. By stopping all new UI feature development (like reports and graphs) and focusing entirely on wiring the existing screens to the Prisma database, FlowBoard can become the fast, trustworthy tool it is meant to be. 
