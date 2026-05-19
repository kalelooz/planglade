---
name: project-memory
description: Use when starting work on FlowBoard to load project context, lessons learned, and known patterns. Contains accumulated knowledge from previous sessions. Trigger keywords: memory, context, lessons, history, what we know, previous work.
---

# Project Memory — FlowBoard

## Project State (May 2026)

### What Exists
- Next.js 16 App Router with standalone output
- Full shadcn/ui component library (new-york style)
- Kanban board with verified DnD pattern
- Calendar, timeline, Gantt, notes, team, settings views
- Zustand store for workspace state
- Prisma ORM with PostgreSQL
- NextAuth v4 for authentication
- TanStack React Query for data fetching
- Dark mode via next-themes
- Command palette
- Universal drawer for all entity types

### Architecture Decisions Made
- **Server components by default** — `'use client'` only when needed
- **Zustand for frontend state** — scoped to feature slices
- **Mock data** in `src/lib/mock-data.ts` for frontend dev
- **Standalone output** for Docker deployment
- **Bun** as runtime for production server
- **Tailwind CSS v4** with CSS variables

### Known Working Patterns

#### Kanban DnD
- See `flowboard-dnd-kanban` skill — DO NOT refactor
- Pattern: `onDragOver` for cross-column commits, `arrayMove` for same-column
- Whole card drag with 5px activation distance
- DragOverlay for ghost feedback

#### Drawer Pattern
- Data preparation in `drawer-data.ts`
- Context in `drawer-context.tsx`
- Universal drawer handles all entity types

#### View Pattern
- Route `page.tsx` imports view from `src/components/flowboard/`
- Views are client components when interactive

### Lessons Learned

1. **Don't refactor working DnD** — the kanban sortable pattern was hard-won; earlier simpler variants broke down-direction drags
2. **Targeted verification only** — don't run full lint/build for small changes
3. **Use existing shadcn components** — never hand-roll dialogs, dropdowns, popovers
4. **Frontend first** — backend/persistence waits unless needed to support frontend
5. **Dense, calm UI** — Linear/Plane aesthetic, not decorative

### File Map

```
src/app/                    # Routes (my-tasks, notes, timeline, calendar, team, settings, report)
src/components/flowboard/   # Feature components (dashboard, kanban, views, stores)
src/components/ui/          # shadcn primitives
src/lib/                    # Utils, store, db, mock data
src/hooks/                  # Custom hooks (use-mobile, use-toast)
prisma/schema.prisma        # Database schema
```

### Development Commands
- `npm run dev` — dev server on port 3000
- `npm run build` — standalone build
- `npm run lint` — ESLint
- `npm run db:push` — Prisma db push
- `npm run db:generate` — Prisma generate
- `npm run db:migrate` — Prisma migrate dev

### External Services
- Dev server hosted remotely (space-z.ai domain)
- Keep-alive scripts in project root
- Caddyfile for reverse proxy
