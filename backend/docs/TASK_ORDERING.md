# Board workflow and ordering

**Official agreed build: 2026-07-31.** This document is the source of truth
for the Tasks board in the production frontend (`frontend`)
and its work-item API.

## Workflow

The board has exactly five persisted workflow columns, in this order:

1. Backlog
2. Planned
3. In Progress
4. In Review
5. Done

`Blocked` is a derived task condition, not a board workflow column. It can be
shown as an indicator on a card, but it must not displace or merge the persisted
`In Review` stage. In particular, `In Review` is always its own column between
`In Progress` and `Done`.

Inbox membership is separate from workflow status. Quick Capture creates a
`BACKLOG` work item with `isInbox: true`; triaging it or moving any board task
sets `isInbox: false`. Therefore moving a task to the board's Backlog column
must not return it to Inbox, and pending Inbox captures must not appear on the
board until they are triaged.

## Drag-and-drop contract

- A picked-up card stays represented by one measured drag overlay. The source
  card collapses from layout and a single destination hole opens in its place.
  The overlay retains the source card width; it must never collapse into a
  narrow vertical strip.
- The destination is calculated from column and card rectangles captured once
  at pickup. Moving cards are not re-measured while the hole opens, preventing
  feedback-loop jitter.
- Cards move within a column and across any of the five workflow columns. The
  neighbouring cards use a short tweened layout transition as the hole moves.
- Pointer, touch, and keyboard sensors are supported. Releasing outside the
  board or cancelling leaves the task unchanged.

## Persistence contract

Dropping a task sends its destination `status` plus `beforeId`:

- `beforeId` is the task that should follow the moved task.
- `beforeId: null` appends the task to the end of the destination column.
- The server validates that the sibling is in the same workspace and destination
  status. A sibling may belong to another project: the Tasks board is a
  workspace-wide board, so project-scoped validation would incorrectly reject
  valid drops.
- The server reindexes the workspace-wide destination status in one transaction
  using `WorkItem.position` values spaced by 1024. This makes the placement
  durable after a refresh.
- When legacy tasks have the same position (including `0`), the board and
  reindexing route both use creation time ascending as the deterministic tie
  breaker.

The client applies a local placement preview immediately and also updates its
cached task order optimistically. If the request fails, it restores the previous
order and shows the existing error feedback; a failed drop is never presented as
saved.

## View boundary

This contract applies to the **Board** view. The List view is an alternate task
presentation and does not currently provide manual drag reordering; do not claim
that list drag ordering is implemented until it has its own tested interaction.

## Acceptance check

Before changing board motion or ordering, verify all of the following in the
running frontend at `http://127.0.0.1:5173/`:

1. Move a card within a column; the chosen slot remains after a refresh.
2. Move a card into another workflow column, including In Review; it remains
   there after a refresh.
3. Repeat with adjacent cards from different projects; no validation toast or
   rollback occurs.
4. Confirm the lifted card keeps the same usable width as its source card and
   the board still shows only the five workflow columns above.

Relevant implementation files:

- Frontend drag surface: `frontend/src/pages/Board.tsx`
- Frontend placement helper: `frontend/src/lib/board-order.ts`
- API persistence route: `src/app/api/work-items/[workItemId]/route.ts`
