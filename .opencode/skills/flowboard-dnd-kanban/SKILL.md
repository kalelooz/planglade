---
name: flowboard-dnd-kanban
description: Use when working on the FlowBoard kanban board drag-and-drop functionality. Contains the verified working pattern for @dnd-kit sortable with cross-column moves. Trigger keywords: kanban, drag, drop, dnd, sortable, reorder, board, column, arrayMove.
---

# FlowBoard Kanban DnD Pattern

**Verified Working Pattern** - User signed off as "perfect, save this for reference".
Do not refactor away without checking.

## Problem Solved

Earlier attempts had two visible bugs:
1. **Drag-down within a column was a no-op** - removing the source shifted the target up by 1, so "insert before target" landed back at the original spot
2. **Cross-column drops were imprecise** - the destination column's SortableContext never saw the moved item during the drag

## Implementation Pattern

### Structure
- One `SortableContext` per column using `verticalListSortingStrategy`
- Cards use `useSortable({ id: item.id })`
- Each column ALSO uses `useDroppable({ id: status })` so the empty area/column body is a valid drop target
- `collisionDetection={closestCorners}`

### onDragOver (Cross-Column Move)
When the over column differs from the active item's current column:
- **Immediately commit** a cross-column move via `reorderWorkItem(activeId, overStatus, beforeId)`
- `beforeId` = the over-card's id (or `null` if hovering the column itself → append to end)
- This is **required** so the destination column's SortableContext includes the active item and target detection stays accurate as the cursor keeps moving

### onDragEnd (Drop)

**Drop on a card, same column:**
- Use `arrayMove` semantics — splice the active item from `oldIdx` and re-splice at `newIdx`
- Derive `beforeId` as the item that sits at `finalIdx + 1` in the reordered list (or `null` for end)
- Handles both up- and down-direction drags correctly

**Drop on a column id:**
- Append with `beforeId = null`

**Cross-column drop on a card:**
- The column was already committed in `onDragOver`
- The drop just inserts before the over card

### Store Action
`reorderWorkItem(id, targetStatus, beforeId)` does the global-array splice and logs activity only when status changed.

### UX Details
- Whole card carries the drag listeners (no dedicated grip handle)
- `PointerSensor` uses `activationConstraint: { distance: 5 }`
- Clicks under 5px movement fire the title's onClick (opens drawer)
- Drags over 5px engage sortable
- `DragOverlay` shows a ghost card following the cursor for feedback

## Key Files
- Kanban board: `src/components/flowboard/kanban-board.tsx`
- Store: `src/components/flowboard/workspace-store.ts`
- Drawer data: `src/components/flowboard/drawer-data.ts`
