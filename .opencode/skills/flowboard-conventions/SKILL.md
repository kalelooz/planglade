---
name: flowboard-conventions
description: Use when working on the FlowBoard project management app. Covers project structure, tech stack conventions, component patterns, and development workflows. Trigger keywords: FlowBoard, project management, kanban, gantt, timeline, tasks, notes.
---

# FlowBoard Project Conventions

## Project Overview

FlowBoard is a project management application similar to Linear and Plane. It provides kanban boards, Gantt charts, calendar views, timeline views, notes, team management, and task tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, RSC) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + CSS variables |
| UI Components | shadcn/ui (new-york style) + Radix UI primitives |
| Icons | Lucide React |
| State | Zustand (frontend slices only) |
| Data Fetching | TanStack React Query |
| Tables | TanStack Table |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable |
| Forms | React Hook Form + Zod v4 |
| Auth | NextAuth v4 |
| Database | Prisma ORM |
| Charts | Recharts |
| Animations | Framer Motion |
| Markdown | @mdxeditor/editor, react-markdown |
| Date | date-fns, react-day-picker |
| Notifications | Sonner |

## Directory Structure

```
src/
  app/              # Next.js App Router pages
  components/
    flowboard/      # Feature-specific components
    ui/             # shadcn/ui primitives
    notes/          # Note editor components
    lovable/        # Legacy/bridge components
  hooks/            # Custom React hooks
  lib/              # Utilities, store, db, mock data
```

## Component Conventions

### File Naming
- Components: `kebab-case.tsx` (e.g., `kanban-board.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-mobile.ts`)
- Utils: `camelCase.ts` (e.g., `utils.ts`)

### Component Patterns
1. **Server Components by default** - Use `'use client'` only when needed (state, effects, event handlers)
2. **Colocate related logic** - Keep drawer data, schemas, and view logic together
3. **Use shadcn/ui primitives** - Import from `@/components/ui/*`, never hand-roll dialogs, dropdowns, etc.
4. **Zustand stores** - Scope to feature slices, not global app state
5. **TanStack Table** - Use for any list/table with sorting, filtering, or pagination

### Styling Rules
- Use Tailwind CSS utility classes exclusively
- Reference CSS variables: `var(--background)`, `var(--primary)`, `var(--radius)`
- Base color: `neutral` (set in components.json)
- Dark mode: class-based (`darkMode: "class"`)
- Use `cn()` from `@/lib/utils` for conditional class merging
- Prefer `class-variance-authority` for component variants

## UI/UX Standards

- Clean, restrained, product-grade UI (Linear/Plane aesthetic)
- Dense but readable layouts
- Crisp borders, compact controls, consistent spacing
- Calm neutral surfaces - no decorative gradients or chrome
- Avoid: fake demo data, vanity metrics, generic dashboards, unnecessary cards

## State Management

- **Zustand**: Only for frontend UI state that needs sharing across components
- **TanStack Query**: For server state and data fetching
- **React Context**: For theme, auth, drawer context
- **URL state**: Prefer search params for filters, views, and navigation state

## Database & API

- Prisma schema in `prisma/schema.prisma`
- Database client in `src/lib/db.ts`
- Server actions for mutations (when implemented)
- Mock data in `src/lib/mock-data.ts` for frontend development

## Development Workflow

1. Work incrementally with TODO lists
2. Validate each item before moving to the next
3. Frontend UI/UX is priority; backend waits unless needed
4. Keep dev server running for UI review
5. Use targeted verification (TypeScript on touched files, ESLint on touched files)
6. Commit validated slices locally with clear messages

## Import Aliases

```
@/components/*  -> src/components/*
@/lib/*         -> src/lib/*
@/hooks/*       -> src/hooks/*
@/app/*         -> src/app/*
```

## Common Patterns

### Drawer Pattern
- Data preparation in `drawer-data.ts`
- Context in `drawer-context.tsx`
- Universal drawer component handles all entity types

### View Pattern
- Each route has a `page.tsx` that imports a view component
- View components live in `src/components/flowboard/`
- Views are client components when they need interactivity

### Schema Pattern
- Zod schemas in `schemas.ts` for form validation
- Use `@hookform/resolvers/zod` to connect to React Hook Form
