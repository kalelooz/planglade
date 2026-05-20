# FlowBoard Agent Instructions

## Autonomous Operation

- You receive plain English instructions and decide what tools, MCPs, and skills to use.
- Always run the autonomous tool selection checklist before starting any task.
- Invoke relevant MCPs and skills proactively — never wait to be asked.
- Use parallel tool calls for independent operations.
- Load skills via the `skill` tool when their trigger conditions are met.

## Product Direction

- Work incrementally. Start each work session with a short TODO list.
- Solve TODOs one by one. Validate each meaningful item before moving to the next.
- The frontend MVP loop is complete for the local-first prototype.
- Current priority is the full-stack foundation in `docs/ACTIVE_PLAN.md` and `docs/FULLSTACK_ROADMAP.md`.
- Backend, auth, database, and deeper persistence work are now in scope when they support the production roadmap without expanding the product surface.

## Canonical Planning

- `docs/ACTIVE_PLAN.md` is the single source of truth for the current roadmap and execution order.
- Read `docs/ACTIVE_PLAN.md` after this file and before changing code.
- Do not treat `docs/audits/`, `docs/archive/`, root rollback patches, worklogs, or completed slice plans as active roadmap instructions.
- If another document conflicts with `docs/ACTIVE_PLAN.md`, follow `docs/ACTIVE_PLAN.md` and update or archive the conflicting document.

## UI/UX Standard

- Aim for clean, restrained, product-grade UI similar to mature tools such as Plane and Linear.
- Prefer proven libraries, existing shadcn/Radix primitives, and established component patterns over hand-designed custom widgets.
- Do not invent decorative design systems from scratch when a ready component/library pattern can solve the problem.
- Use dense but readable layouts, crisp borders, compact controls, consistent spacing, and calm neutral surfaces.
- Avoid fake demo chrome, vanity metrics, generic dashboards, decorative gradients, and unnecessary cards.

## Implementation Workflow

- Default to a fast lane. Keep exploration, edits, and validation scoped to the files and user-visible surface being changed.
- Do not run broad project checks by default. Avoid full `npm run lint`, full builds, full test suites, or multi-viewport browser passes unless the change touches shared infrastructure, routing, build config, persistence, cross-page state, or production foundation work.
- Prefer targeted verification: TypeScript for touched TS/TSX when relevant, ESLint on touched TS/TSX files, and one browser check for the changed UI surface when visual risk is real.
- Skip redundant validation when a faster command already proves the slice. Record known unrelated failures instead of expanding the task to fix them.
- Keep status updates brief. Do not narrate routine file reads or every minor command unless work takes longer than expected.
- Use MCP/tools when they materially improve the work, especially for browser validation, current library documentation, or design-system extraction.
- Use local git for control. Commit validated incremental slices locally with clear messages.
- Before claiming a slice is done, run the relevant checks for that slice.
- Keep the dev server running when the user wants to review UI.

## Current Libraries To Prefer

- shadcn/ui and Radix primitives for UI controls.
- Tailwind CSS variables and existing tokens for styling.
- Lucide icons for iconography.
- TanStack Table for table/list work where appropriate.
- Zustand only where state is needed for a frontend slice.
