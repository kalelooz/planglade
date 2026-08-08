# Visual presentations: implemented contract

Status: current agreed build, 2026-07-31.

PlanGlade captures a task once and presents the same record set through six views: List, Board, Calendar, Map, Timeline, and Overview. “View” is the interface term; “visual planning” is the product direction.

## Shared presentation state

The production frontend owns one versioned `TaskPresentation` contract. It includes layout, search, quick filters, project and priority filters, completed visibility, sort, grouping, density, and visible fields. The URL is canonical. Reloading or sharing that URL restores the same presentation, and unsupported layout values safely fall back to List.

Saved views persist the same contract through the backend `SavedView` model and API. Saved views are personal to their creator, even inside a shared workspace. A user can save, update, rename, delete, pin or unpin, reorder, and select one default. At most four saved views are pinned in the task toolbar; the searchable `+ View` gallery holds the full catalog and overflow.

The JSON stored in `filters` and `display` is versioned with `version: 1`. Readers ignore unknown keys and use safe defaults for invalid values. Legacy `kanban` layouts map to Board.

## View behavior

- List is the default scanning surface. It supports flat or grouped presentation, compact or comfortable density, and configurable project, status, due-date, and priority fields.
- Board uses the same active record filters and display preferences. Dragging changes status and order without creating or losing records.
- Calendar uses the shared filtered record set, supports drag-to-reschedule, and keeps undated work in its unscheduled section.
- Map uses the shared filtered record set and remains the relationship-focused signature view.
- Timeline uses real start and due dates, project lanes, dependency indicators, pointer drag/resize scheduling, and keyboard scheduling (`Alt+Arrow` to move, `Alt+Shift+Arrow` to resize). Undated work is reported explicitly.
- Overview derives open, done, due-this-week, at-risk, stage distribution, and attention lists from live tasks. It does not invent productivity scores.

Search, filters, and completed visibility keep the same language across all six views. Sort is shown where sequence matters; grouping and display controls appear only where they have a defined outcome. The command palette opens every view without requiring pointer input.

## Persistence, security, and portability

All saved-view operations verify authentication, workspace membership, workspace scope, project scope when present, and record ownership. Setting a default atomically clears the user’s previous default. Public self-hosting uses the same API and requires no provider-specific service.

Workspace export includes the current actor’s saved views. Import preview counts them, flags simple-name duplicates and missing project references, and import restores them under the authenticated actor while remapping project IDs. A replace import removes only that actor’s saved views, not another member’s personal configuration.

## Evidence-gated views

Table remains deferred until configurable List fields prove insufficient. Dashboard remains a composition model, not a peer layout; Home should mature into a curated overview first. Workload waits for mature assignee and capacity semantics. Charts require transparent aggregations over real saved-view data.

The detailed rationale and competitor evidence remain in [planglade-visual-presentations-strategy.html](planglade-visual-presentations-strategy.html) and [VISUAL_PRESENTATIONS_COMPETITOR_RESEARCH.md](VISUAL_PRESENTATIONS_COMPETITOR_RESEARCH.md).
