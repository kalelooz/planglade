# FlowBoard Agent Instructions

## Product Direction

- Work incrementally. Start each work session with a short TODO list.
- Solve TODOs one by one. Validate each meaningful item before moving to the next.
- Current priority is UI/UX frontend work first.
- Backend, auth, database, and deeper persistence work wait unless needed to support or validate a frontend slice.

## UI/UX Standard

- Aim for clean, restrained, product-grade UI similar to mature tools such as Plane and Linear.
- Prefer proven libraries, existing shadcn/Radix primitives, and established component patterns over hand-designed custom widgets.
- Do not invent decorative design systems from scratch when a ready component/library pattern can solve the problem.
- Use dense but readable layouts, crisp borders, compact controls, consistent spacing, and calm neutral surfaces.
- Avoid fake demo chrome, vanity metrics, generic dashboards, decorative gradients, and unnecessary cards.

## Implementation Workflow

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
