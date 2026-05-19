# FlowBoard Consolidated Audit

> Date: 2026-05-19
> Sources merged: `audit qwen.md`, `audit deepseek.md`, `audit gpt codex.md`
> Benchmark repos referenced: `external/pm-repos/plane`, `memos`, `vikunja`, `leantime`, `focalboard`, plus the Mohamy benchmark referenced in the DeepSeek audit.

---

## Executive Summary

FlowBoard has a strong product direction and a modern frontend stack, but the current implementation is still closer to a polished prototype than a durable product.

The strongest finding across all three audits is consistent: the visual direction is competitive, while the interaction layer, state model, quality gates, and architecture need tightening. The app looks like a serious product, but too many user actions are still mock-only, brittle, or scattered across large components.

The most important near-term goal should be making the core solo workflow real:

1. Capture work quickly.
2. Triage it in Inbox.
3. See it on Today and My Tasks.
4. Switch views on the same underlying data.
5. Persist changes reliably.

Until that loop works end-to-end, deeper backend, auth, team, reporting, and analytics work should stay secondary.

---

## Overall Verdict

FlowBoard is visually ahead of its engineering maturity.

It has the right stack for the desired product:

- Next.js App Router
- React
- Tailwind CSS
- shadcn/Radix primitives
- Zustand
- TanStack Table
- dnd-kit
- Prisma scaffold

But the current risk areas are significant:

- Several actions still behave like demos instead of real product interactions.
- The backend/API layer is effectively empty.
- State is still too array-heavy and mock-oriented.
- Quality gates are loose or bypassed.
- Key UI files are too large.
- Board, Calendar, Timeline, and Table are separate destinations instead of view lenses over the same data.
- The app contains team/admin surfaces before the solo loop is trustworthy.

The gap is not mostly aesthetic. The gap is what happens after the user clicks.

---

## Architecture Comparison

| Dimension | FlowBoard | Stronger Reference Pattern |
|---|---|---|
| Frontend | Next.js 16, React, Tailwind, shadcn | Modern and appropriate |
| Backend | Next.js API routes mostly unused | Memos/Vikunja: simple Go + SQLite; Plane: heavier Django/Postgres |
| State | Zustand with persistence started | Plane/Vikunja: normalized maps; Memos: React Query mutations |
| Data model | Starter Prisma plus frontend mock domain | Vikunja relations, Plane state groups, Focalboard view configs |
| API | `/api` is not meaningful yet | REST/RPC with clear contracts |
| Real-time | None | Memos SSE; Plane/Vikunja/Focalboard WebSocket |
| Routing | Real App Router routes | Good, but view routing needs consolidation |
| Tests | Minimal or none | Vikunja, Memos, Focalboard have stronger test cultures |

FlowBoard should keep the Next.js App Router structure. It is better than single-page state-machine routing for this product. The problem is not routing itself; the problem is that related views currently behave like separate products instead of lenses over shared project/task data.

---

## Product And IA Findings

### What FlowBoard Gets Right

- The solo-first direction is correct.
- Today, Inbox, My Tasks, Projects, Notes, and Calendar are a strong primary navigation set.
- Notes plus tasks in one app is a meaningful product bet.
- The restrained UI direction fits mature PM tools such as Linear and Plane.
- The current roadmap is more honest than the current implementation, which is a good sign.

### What FlowBoard Gets Wrong

- Inbox mixes triage with awareness content.
- Recent Notes and Recently Changed belong on Today or project detail, not Inbox.
- Board, Calendar, Timeline, and Table should be view tabs/configurations over the same data, not disconnected top-level mental models.
- Team, workload, reporting, and fake metrics appear before the personal loop is complete.
- The first screen still risks feeling like a dashboard with placeholder product signals rather than a working command center.

### Recommended IA Split

| Zone | Pages | Purpose |
|---|---|---|
| Personal | Today, My Tasks, Inbox, Notes | What needs me now |
| Project execution | Projects, Tasks, Board, Calendar, Timeline | What is happening in the work |
| Awareness | Activity, Connections | What changed recently |
| Admin | Team, Reports, Settings | Configuration and oversight |

Inbox should stay narrow: captures and notifications that need processing. Today should carry the awareness widgets.

---

## Code Quality Findings

### Main Hotspots

| File | Problem |
|---|---|
| `src/components/flowboard/kanban-board.tsx` | Monolithic board logic, cards, modals, import, and DnD in one large file |
| `src/components/flowboard/my-tasks-view.tsx` | Inline table behavior that should be abstracted into a reusable DataTable |
| `src/components/lovable/shell.tsx` | Large shell/sidebar file and possible overlap with another sidebar implementation |
| `src/lib/store.ts` | Useful progress, but likely to become too broad without domain separation |
| `src/app/inbox/page.tsx` | Inline chips/components and mixed IA responsibilities |

### Stronger Patterns To Borrow

From Memos:

- Small components.
- React Query mutations with optimistic updates.
- Inline capture/editor as a primary interaction.
- Draft persistence.
- Tags as filters.
- Simple real-time via SSE.

From Plane:

- Peek side panel for item detail.
- Normalized entity maps.
- State groups rather than freeform statuses.
- Strong monorepo quality culture.
- Semantic surface/layer tokens.

From Vikunja:

- Bidirectional task relations.
- URL-synced filter/sort/search state.
- Fractional position sorting.
- Natural-language quick add.
- Robust task engine behavior.

From Focalboard:

- View-as-configuration.
- Board/card templates.
- Mutator/undo manager pattern.
- Nested filter builder.

From Leantime:

- Friendly onboarding.
- Action-oriented workflows.
- Inline editing on cards.

From Mohamy:

- Generic reusable board component.
- Reusable DataTable wrapper.
- Smaller page/component boundaries.
- SSR-safe `usePersistedState` for UI-only preferences.
- Board/table toggles over the same data.

---

## Data Model Recommendations

### Normalize Entities

Move toward entity maps:

```ts
tasksById: Record<string, Task>
projectsById: Record<string, Project>
notesById: Record<string, Note>
```

Then derive arrays for display. Avoid storing duplicated task arrays across pages.

### Use State Groups

Adopt grouped task states:

```ts
type StateGroup =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "cancelled";
```

Custom statuses can still exist, but they should map to these groups. This makes Kanban, filters, reporting, and completion logic consistent.

### Use Bidirectional Relations

Use explicit relation records for dependencies and hierarchy:

```ts
type TaskRelationType =
  | "subtask"
  | "parent"
  | "blocking"
  | "blocked"
  | "precedes"
  | "follows";
```

Avoid one-way arrays such as `blockedByTaskIds` as the final model. Bidirectional rows make queries simpler and less brittle.

### Store Views As Configuration

Views should be data:

```ts
type ViewConfig = {
  id: string;
  entityId: string;
  type: "board" | "table" | "calendar" | "timeline";
  groupBy?: string;
  sort?: Array<{ propertyId: string; direction: "asc" | "desc" }>;
  visiblePropertyIds?: string[];
  filter?: unknown;
};
```

This is one of the most important structural changes. It turns Board, Table, Calendar, and Timeline into lenses instead of separate app areas.

---

## State Management Recommendations

### Keep Zustand, But Tighten It

Zustand is appropriate for the current solo-first frontend slice. Plane-style MobX complexity is not needed now.

Recommended direction:

- Keep Zustand for client/domain state.
- Add normalized maps.
- Split domain actions as the store grows.
- Use `persist` for local-first durability.
- Add migration paths for store schema changes.
- Use small SSR-safe persisted hooks for UI-only state such as collapsed panels.

### Add Real Mutations Before Backend Expansion

React Query is already installed, but currently underused. Do not wire a heavy API layer until the local interaction model is clean.

Recommended order:

1. Make Zustand actions real for capture, edit, complete, move, and delete.
2. Persist the local store.
3. Add optimistic mutation wrappers when API routes become real.
4. Add server sync after the frontend behavior is stable.

---

## UI/UX Recommendations

### Highest Priority UI Changes

1. Move Recent Notes and Recently Changed out of Inbox and into Today.
2. Add a real Quick Capture surface to Today.
3. Make Inbox a focused triage queue only.
4. Convert fake toasts/actions into real store mutations.
5. Add view toggles where the same data can be shown as board/table/calendar/timeline.
6. Use peek side panels for task detail instead of forcing navigation or modal-heavy flows.
7. Add notes search.
8. Use compact empty states and first-run guidance.

### Interaction Principles

- Capture should take under 5 seconds.
- Every visible command should change real state.
- Avoid fake metrics until real data exists.
- Keep layouts dense, calm, and scannable.
- Prefer shadcn/Radix primitives over custom widgets.
- Use lucide icons for controls.
- Avoid decorative dashboards while core workflows are unfinished.

---

## Quality Gate Findings

The GPT Codex audit highlighted an important structural issue: FlowBoard currently favors speed over enforceable quality.

Known risks called out:

- Build/type errors may be ignored in config.
- ESLint rules are broad or loose.
- Build scripts may not be cross-platform.
- No minimal must-pass command set is clearly enforced.
- Working tree drift is high.

Recommended minimal quality gate:

1. ESLint only on touched TS/TSX files.
2. TypeScript check when type-affecting code changes.
3. One browser check for changed UI surfaces when visual risk is real.
4. Avoid broad lint/build/test by default unless shared infrastructure changed.
5. Commit small validated slices locally.

For production-facing readiness, build and type errors should not be ignored. During fast prototyping, they can be temporarily tolerated only if tracked explicitly and not treated as complete.

---

## What Not To Copy

Avoid these patterns from the benchmark apps:

| Pattern | Reason |
|---|---|
| Leantime's older jQuery/Bootstrap-heavy UI | Too dated and heavy for FlowBoard's direction |
| Focalboard's older React/Redux/SCSS architecture | Useful concepts, but not the right stack to imitate |
| Plane's full MobX/store complexity | Too much for solo-first FlowBoard today |
| Leantime's EAV/canvas complexity | Powerful but premature |
| Focalboard's full block model | Too complex for the current task/card scope |

Also avoid copying AGPL-family code directly unless the licensing implications are intentional. Borrow product and architecture ideas, not code.

---

## Priority Roadmap

### P0: Make The Core Loop Real

1. Move Inbox awareness widgets to Today.
2. Add real Quick Capture to Today.
3. Route Quick Capture, Inbox triage, My Tasks, and Today through the same store.
4. Add localStorage persistence for core entities.
5. Remove or hide fake metrics/actions.
6. Fix hardcoded Calendar/Timeline date logic.
7. Add notes search.

### P1: Reduce Architecture Risk

1. Normalize tasks/projects/notes into maps.
2. Extract a generic Board component from the Kanban implementation.
3. Create a reusable DataTable wrapper.
4. Resolve sidebar duplication.
5. Extract large inline components from page files.
6. Add URL-synced state for filters, search, and sort.
7. Introduce task state groups.

### P2: Product Depth

1. Add bidirectional task relations.
2. Add subtasks/checklists backed by real data.
3. Add peek task detail panels.
4. Add view-as-configuration.
5. Add natural-language quick add.
6. Add undo/redo for destructive and high-frequency mutations.
7. Add first-run onboarding.

### P3: Later

1. Real backend persistence.
2. Auth.
3. Real-time sync.
4. Team and reporting features.
5. Deeper analytics.
6. Import/export workflows.

---

## My Evaluation

The audits are directionally useful and mostly agree with each other. The strongest one is `audit qwen.md` because it connects product direction, IA, Reddit signal, and external repo patterns into one coherent plan. The DeepSeek audit is useful for concrete refactoring targets, especially the generic board and DataTable recommendations. The GPT Codex audit is useful because it focuses on engineering governance: build portability, lint discipline, and quality gates.

My evaluation is that FlowBoard should not start by copying a competitor's backend or building a full persistence layer. The fastest path to a better product is to make the current frontend honest. That means every visible primary action should mutate shared local state and survive refresh. Once that works, backend/API decisions will be much clearer.

The highest-leverage next slice is:

1. Move Recent Notes and Recently Changed from Inbox to Today.
2. Add a real Quick Capture to Today.
3. Wire capture, triage, complete, edit, and delete to the shared Zustand store.
4. Persist those entities locally.
5. Validate only that changed surface.

That slice directly fixes the biggest user trust issue: the app currently presents serious workflows before the underlying interactions are serious. After that, the architecture cleanup should target the biggest files and the duplicated view logic.

In short: keep the UI direction, narrow the product surface, make the solo loop real, then refactor the repeated board/table/view patterns into reusable primitives.
