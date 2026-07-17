# Map production foundation

Status: review-only production foundation. Do not expose Map in the public demo or merge the XYFlow proof-of-concept PR.

## Product boundary

- Connections remains the separate read-only relationship graph at `/app/connections`.
- Map is a Tasks view at `/app/tasks?view=map`.
- A project Map uses `/app/tasks?view=map&project=<projectId>`.
- Tasks, Projects, parent/subtask links, and dependency records remain authoritative. Map stores presentation only.
- The public demo does not show Map.

## Persistence

Map data is normalized:

- `MapScope` identifies the shared workspace Map or one project Map and owns the schema version and revision.
- `MapTaskPlacement` stores task positions without adding columns to `WorkItem`.
- `MapProjectPlacement` stores real project-container positions and the workspace `No project` container.
- `MapSection` stores ordered visual-section metadata.
- `MapPreference` stores one user's viewport, status filter, and tray state.
- `MapCollapsedProject` and `MapCollapsedSection` store personal collapsed state without a layout JSON blob.

Task, Project, Workspace, User, section, and scope foreign keys use cascade or set-null cleanup appropriate to the relationship. Deleting a Task removes its placements. Deleting a Project removes its project Map and container/collapse records; workspace tasks whose project becomes null can appear in the `No project` area.

## Server boundary

`GET`, `PUT`, and `PATCH /api/map` use the existing authenticated route pattern.

Every request verifies:

1. the server-resolved authenticated actor;
2. workspace membership;
3. the requested workspace or project Map scope;
4. every referenced Task, Project, and section;
5. the role required for the operation.

Viewers may read shared layout and update only their own preferences. Members, Admins, and Owners may update shared placements and sections. Client-provided user IDs are never accepted.

Shared writes include the revision the client loaded. The revision advances atomically. A stale write returns HTTP `409` with code `MAP_LAYOUT_CONFLICT`; the client keeps local positions until the user explicitly loads the latest shared layout.

## Portability

- Full self-host backup and restore copy the SQLite database, so all shared Map records and personal preferences are preserved.
- Workspace JSON export includes shared Map scopes, revisions, placements, and visual sections.
- Workspace import remaps exported Task, Project, and section IDs to the destination workspace and skips missing entities safely.
- Future Map schema versions are rejected by import.
- Personal Map preferences are intentionally excluded from workspace JSON export/import because that format does not carry portable user identity. They remain covered by full backup and restore.

## Foundation UI

The production foundation selectively uses the proof-of-concept's XYFlow renderer, project containers, task nodes, relationship edges, project/status filters, pan/zoom/fit behavior, light/dark support, reduced-motion styling, mobile summary, and 250/500-node guards.

The foundation adds authorized persistent dragging, explicit save/saving/saved/conflict/failed states, personal viewport/filter persistence, and a read-only inspector. It does not mutate task truth.

## Verified UI

- [Workspace Map — light](assets/map-production/map-workspace-light.png)
- [Workspace Map — dark](assets/map-production/map-workspace-dark.png)
- [Mobile summary fallback](assets/map-production/map-mobile-fallback.png)

The focused browser walkthrough creates real Tasks, opens the workspace Map, drags and saves a node, verifies the persisted revision and placement, reloads the layout, checks both themes, confirms Connections still renders, confirms the demo does not expose Map, and verifies the mobile fallback without console, page, or server errors.

## Deferred

- create or edit Tasks from the canvas;
- status or Project changes by dragging;
- dependency or hierarchy editing;
- visual-section editing controls;
- notes, people, or labels as nodes;
- arbitrary drawing and shapes;
- real-time collaboration and multiplayer cursors;
- public demo Map.
