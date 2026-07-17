"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Plus, MoreHorizontal, Trash2, ArrowRight, GripVertical, LayoutGrid, List, Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Over,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "@/components/lovable/shell";
import { ProjectViewTitle, Toolbar, Chip } from "@/components/lovable/page";
import { Avatar, StatusIcon } from "@/components/lovable/icons";
import { PriorityIndicator } from "@/components/lovable/priority-indicator";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { DependencyBadge } from "@/components/lovable/dependency-badge";
import { formatDueLabel } from "@/lib/dates";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { type Status, type WorkItem } from "@/lib/mock-data";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import {
  type ApiNote,
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiNotePreview,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getParentTask, subtaskProgress } from "@/lib/work-item-hierarchy";
import { getDemoFixtures } from "@/lib/demo-data";
import { blockReadOnlyMutation, handleDemoReadOnlyResponse } from "@/lib/demo-readonly";

const cols: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const columnIds = new Set(cols as string[]);

function resolveTargetStatus(over: Over | null | undefined, scopedWorkItems: WorkItem[]): Status | null {
  if (!over) return null;
  const overId = String(over.id);
  if (columnIds.has(overId)) {
    return overId as Status;
  }

  const overItem = scopedWorkItems.find((w) => w.id === overId);
  if (overItem) {
    return overItem.status;
  }

  const containerId = over.data.current?.sortable?.containerId;
  if (typeof containerId === "string" && columnIds.has(containerId)) {
    return containerId as Status;
  }

  return null;
}

function reorderLocalWorkItems(
  workItems: WorkItem[],
  id: string,
  targetStatus: Status,
  beforeId: string | null,
  scopeProjectId?: string | null
) {
  const moved = workItems.find((workItem) => workItem.id === id);
  if (!moved) return workItems;
  const without = workItems.filter((workItem) => workItem.id !== id);
  const updated: WorkItem = { ...moved, status: targetStatus };
  const inScope = (workItem: WorkItem) =>
    workItem.status === targetStatus && (!scopeProjectId || workItem.project === scopeProjectId);

  let insertAt: number;
  if (beforeId) {
    const idx = without.findIndex((workItem) => workItem.id === beforeId);
    if (idx !== -1) {
      insertAt = idx;
    } else {
      let lastScopedIdx = -1;
      for (let i = without.length - 1; i >= 0; i -= 1) {
        if (inScope(without[i])) {
          lastScopedIdx = i;
          break;
        }
      }
      insertAt = lastScopedIdx === -1 ? without.length : lastScopedIdx + 1;
    }
  } else {
    let lastIdx = -1;
    for (let i = without.length - 1; i >= 0; i -= 1) {
      if (inScope(without[i])) {
        lastIdx = i;
        break;
      }
    }
    insertAt = lastIdx === -1 ? without.length : lastIdx + 1;
  }

  return [...without.slice(0, insertAt), updated, ...without.slice(insertAt)];
}

export function BoardPageContent() {
  const pathname = usePathname() ?? "";
  const isDemoMode = pathname.startsWith("/demo");
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);
  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations) : []);
  const [projects, setProjects] = useState<Array<ReturnType<typeof toUiProject>>>(() => demoData ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user")) : []);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : []);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; tag: string; updated: string; excerpt: string }>>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const scopedProjectId = routeProjectId ?? activeProjectId;
  const routePrefix = isDemoMode ? "/demo" : "/app";
  const listHref = scopedProjectId ? `${routePrefix}/tasks?project=${encodeURIComponent(scopedProjectId)}` : `${routePrefix}/tasks`;
  const mapHref = scopedProjectId ? `/app/tasks?view=map&project=${encodeURIComponent(scopedProjectId)}` : "/app/tasks?view=map";
  const activeProject = scopedProjectId ? projects.find((p) => p.id === scopedProjectId) ?? null : null;
  const scopedWorkItems = useMemo(
    () => (scopedProjectId ? workItems.filter((w) => w.project === scopedProjectId) : workItems),
    [scopedProjectId, workItems]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusNew, setFocusNew] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const openDrawer = (id: string) => setSelectedId(id);
  const closeDrawer = () => {
    const triggerId = selectedId;
    setSelectedId(null);
    setFocusNew(false);
    if (triggerId) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-task-open="${globalThis.CSS.escape(triggerId)}"]`)?.focus();
      });
    }
  };

  const selected = selectedId ? scopedWorkItems.find((w) => w.id === selectedId) ?? null : null;
  const activeDragItem = activeDragId ? scopedWorkItems.find((w) => w.id === activeDragId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    return pointerHits.length > 0 ? pointerHits : closestCorners(args);
  };

  useEffect(() => {
    if (isDemoMode) return;
    if (routeProjectId && routeProjectId !== activeProjectId) {
      updateSettings({ activeProjectId: routeProjectId });
    }
  }, [activeProjectId, routeProjectId, updateSettings]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        if (session.workspace.taskPriorityDisplayStyle) {
          updateSettings({ priorityDisplayStyle: session.workspace.taskPriorityDisplayStyle });
        }
        setCurrentUserId(session.user.id);
        setMembers(
          (session.members ?? []).map((member) => ({
            id: member.id,
            name: member.name || member.email,
          }))
        );

        const [projectsRes, workItemsRes, notesRes, relationsRes] = await Promise.all([
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }),
          apiFetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }),
        ]);

        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load board tasks");
        if (!notesRes.ok) throw new Error("Failed to load notes");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const mapped = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mapped, relationsPayload.relations));
        setNotes(notesPayload.notes.map(toUiNotePreview));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load board data");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isDemoMode, updateSettings]);

  const patchTaskStatus = async (id: string, status: Status, snapshot?: WorkItem[]) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const response = await apiFetch(
      `/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
        body: JSON.stringify({
          status: toApiWorkStatus(status),
          completedAt: status === "Done" ? new Date().toISOString() : null,
        }),
      }
    );
    if (!response.ok) {
      if (snapshot) setWorkItems(snapshot);
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to move task");
    }
  };

  const createAndFocus = async (status: Status) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const targetProjectId = scopedProjectId ?? projects[0]?.id ?? null;
    if (!targetProjectId) {
      setError("Create a project first, then add board tasks.");
      return;
    }

    const response = await apiFetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        projectId: targetProjectId,
        title: "New task",
        status: toApiWorkStatus(status),
        priority: "MEDIUM",
      }),
    });
    if (!response.ok) {
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to create task");
      return;
    }

    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId);
    setWorkItems((current) => [next, ...current]);
    setSelectedId(next.id);
    setFocusNew(true);
    toast.success("Task created", { description: `Added to ${status}` });
  };

  const handleDelete = async (item: WorkItem) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((workItem) => workItem.id !== item.id));
    const response = await apiFetch(
      `/api/work-items/${encodeURIComponent(item.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "DELETE",
        headers: { "x-flowboard-user-id": currentUserId ?? "" },
      }
    );
    if (!response.ok) {
      setWorkItems(snapshot);
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to delete task");
      return;
    }

    if (selectedId === item.id) {
      setSelectedId(null);
      setFocusNew(false);
    }
    toast.success("Task deleted", { description: item.title });
  };

  const onDragStart = (e: DragStartEvent) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    setActiveDragId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (blockReadOnlyMutation(isDemoMode)) { setActiveDragId(null); return; }
    setActiveDragId(null);
    const activeId = String(e.active.id);
    if (!e.over) return;

    const moved = scopedWorkItems.find((w) => w.id === activeId);
    if (!moved) return;

    const targetStatus = resolveTargetStatus(e.over, scopedWorkItems);
    if (!targetStatus) return;

    // Drop on a column droppable (empty area / column header zone) and append to end.
    if (columnIds.has(String(e.over.id))) {
      const list = scopedWorkItems.filter((w) => w.status === targetStatus);
      if (moved.status === targetStatus && list[list.length - 1]?.id === activeId) return;
      setWorkItems((current) => reorderLocalWorkItems(current, activeId, targetStatus, null, scopedProjectId));
      if (moved.status !== targetStatus) {
        void patchTaskStatus(activeId, targetStatus, workItems);
        toast.success("Task moved", { description: `Moved to ${targetStatus}` });
      }
      return;
    }

    // Drop on another card and place before or after based on pointer position.
    const overId = String(e.over.id);
    if (overId === activeId) return;
    const overItem = scopedWorkItems.find((w) => w.id === overId);
    if (!overItem) {
      // Fallback: if we're over the column shell but not a concrete card, append in target status.
      setWorkItems((current) => reorderLocalWorkItems(current, activeId, targetStatus, null, scopedProjectId));
      if (moved.status !== targetStatus) {
        void patchTaskStatus(activeId, targetStatus, workItems);
        toast.success("Task moved", { description: `Moved to ${targetStatus}` });
      }
      return;
    }
    const activeRect = e.active.rect.current.translated;
    const overRect = e.over?.rect;
    const isBelowTarget = activeRect && overRect
      ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
      : false;

    if (isBelowTarget) {
      const columnItems = scopedWorkItems.filter((w) => w.status === targetStatus);
      const overIndex = columnItems.findIndex((w) => w.id === overItem.id);
      const nextItem = overIndex === -1 ? null : columnItems[overIndex + 1]?.id ?? null;
      setWorkItems((current) => reorderLocalWorkItems(current, activeId, targetStatus, nextItem, scopedProjectId));
    } else {
      setWorkItems((current) => reorderLocalWorkItems(current, activeId, targetStatus, overItem.id, scopedProjectId));
    }

    if (moved.status !== targetStatus) {
      void patchTaskStatus(activeId, targetStatus, workItems);
      toast.success("Task moved", { description: `Moved to ${targetStatus}` });
    }
  };

  return (
    <AppShell
      title={<ProjectViewTitle projectName={activeProject?.name} view="Tasks" />}
      toolbar={
        <Toolbar>
          <div className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5">
            <Link
              href={listHref}
              className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
            >
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </Link>
            <span className="inline-flex h-7 items-center gap-1.5 rounded bg-[var(--color-hover)] px-2 text-[12px] text-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Board</span>
            </span>
            {!isDemoMode ? (
              <Link
                href={mapHref}
                className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
              >
                <Waypoints className="h-3.5 w-3.5" />
                <span>Map</span>
              </Link>
            ) : null}
          </div>
          {error && <span className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-700">{error}</span>}
          {loading && <span className="text-[12px] text-muted-foreground">Loading board...</span>}
          <span className="text-[12px] text-muted-foreground">
            {scopedWorkItems.length} task{scopedWorkItems.length === 1 ? "" : "s"} on board
          </span>
          <span className="ml-auto" />
          <button
            onClick={() => { void createAndFocus("Backlog"); }}
            className="lov-btn lov-btn-primary"
          >
            <Plus className="h-3 w-3" /> New task
          </button>
        </Toolbar>
      }
    >
      <div className="kimi-board relative flex h-full min-h-0 min-w-0 w-full overflow-hidden" data-board-workspace="true">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="h-full max-w-full overflow-x-auto overflow-y-hidden" data-board-scroll-region="true">
              <div className="flex h-full min-w-max items-start gap-3 px-4 pb-3 sm:px-6" data-board-grid="true">
                {cols.map((col) => {
                  const items = scopedWorkItems.filter((w) => w.status === col);
                  return (
                    <Column
                      key={col}
                      status={col}
                      items={items}
                      selectedId={selectedId}
                      onSelect={openDrawer}
                      onAdd={() => { void createAndFocus(col); }}
                      onMove={(id, s) => {
                        if (blockReadOnlyMutation(isDemoMode)) return;
                        const snapshot = workItems;
                        setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, status: s } : workItem)));
                        void patchTaskStatus(id, s, snapshot);
                      }}
                      onDelete={(item) => { void handleDelete(item); }}
                      members={members}
                      allItems={workItems}
                      readOnly={isDemoMode}
                    />
                  );
                })}
              </div>
            </div>
            <DragOverlay>
              {activeDragItem ? <CardGhost item={activeDragItem} members={members} /> : null}
            </DragOverlay>
          </DndContext>
        </div>

        <TaskDrawer
          readOnly={isDemoMode}
          presentation="board"
          item={selected}
          focusTitle={focusNew}
          onTitleFocused={() => setFocusNew(false)}
          onClose={closeDrawer}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          notesOverride={notes}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setSelectedId}
          onItemPatched={(id, patch) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, ...patch } : workItem)));
          }}
          onItemReplaced={(next) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === next.id ? next : workItem)));
          }}
        />
      </div>
    </AppShell>
  );
}

function Column({
  status,
  items,
  selectedId,
  onAdd,
  onSelect,
  onMove,
  onDelete,
  members,
  allItems,
  readOnly,
}: {
  status: Status;
  items: WorkItem[];
  selectedId: string | null;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onMove: (id: string, status: Status) => void;
  onDelete: (item: WorkItem) => void;
  members: Array<{ id: string; name: string }>;
  allItems: WorkItem[];
  readOnly: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-[248px] shrink-0 flex-col" data-board-column={status}>
      <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium">
        <StatusIcon s={status} />
        <span>{status}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
        <button onClick={onAdd} className="lov-icon-btn ml-auto h-6 w-6" title={`Quick add to ${status}`}>
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-md px-1 pb-2 transition-colors ${isOver ? "bg-accent/50" : ""}`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((w) => (
            <Card
              key={w.id}
              item={w}
              selected={selectedId === w.id}
              onSelect={() => onSelect(w.id)}
              onMove={(s) => onMove(w.id, s)}
              onDelete={() => onDelete(w)}
              members={members}
              allItems={allItems}
              readOnly={readOnly}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-md border border-dashed border-border px-2 py-6 text-center text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
          >
            {isOver ? "Drop here" : `Add to ${status}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  item,
  selected,
  onSelect,
  onMove,
  onDelete,
  members,
  allItems,
  readOnly,
}: {
  item: WorkItem;
  selected: boolean;
  onSelect: () => void;
  onMove: (status: Status) => void;
  onDelete: () => void;
  members: Array<{ id: string; name: string }>;
  allItems: WorkItem[];
  readOnly: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: readOnly });
  const m = members.find((member) => member.id === item.assignee) ?? { id: "unassigned", name: "Unassigned" };
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };
  const checklist = item.checklist ?? [];
  const parentTask = getParentTask(item, allItems);
  const progress = subtaskProgress(item, allItems);

  return (
    <div
      ref={setNodeRef}
      data-task-card="true"
      data-task-id={item.id}
      data-task-status={item.status}
      style={style}
      className={`group relative min-w-0 overflow-hidden rounded-md border bg-card p-3 text-[12px] transition-shadow ${selected ? "border-primary/40 ring-1 ring-primary/30" : "hover:border-foreground/20 hover:shadow-sm"}`}
    >
      {/* Row 1: controls plus canonical metadata order */}
      <div className="mb-2 flex min-w-0 items-center gap-2 overflow-hidden">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          onPointerDown={() => { if (readOnly) blockReadOnlyMutation(true); }}
          onClick={() => { if (readOnly) blockReadOnlyMutation(true); }}
          title={readOnly ? "Demo mode - changes are disabled." : "Drag task"}
          aria-label={`Drag ${item.title}`}
          className="lov-icon-btn h-7 w-7 shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {item.parentId && <span className="shrink-0"><Chip>Subtask</Chip></span>}
        <PriorityIndicator priority={item.priority} />
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Avatar id={m.id} name={m.name} size={18} />
          <span className="truncate">{m.name}</span>
        </div>
        {item.label && <span className="min-w-0 overflow-hidden [&_.flow-meta-pill]:max-w-full [&_.flow-meta-pill]:overflow-hidden [&_.flow-meta-pill]:text-ellipsis"><Chip>{item.label}</Chip></span>}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{formatDueLabel(item.due)}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="More actions"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="lov-icon-btn ml-auto h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">Task actions</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onSelect}>Open details</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRight className="h-3.5 w-3.5" /> Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {cols.filter((s) => s !== item.status).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                    <StatusIcon s={s} /> {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: title */}
      <button
        type="button"
        onClick={onSelect}
        data-task-open={item.id}
        className="mb-2.5 block w-full min-w-0 overflow-hidden rounded text-left text-[13.5px] font-medium leading-[1.4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {item.parentId && <span className="shrink-0 text-muted-foreground">↳</span>}
          <span className="truncate">{item.title}</span>
        </span>
      </button>
      {parentTask && <div className="-mt-1 mb-2 truncate text-[11px] text-muted-foreground">Parent: {parentTask.title}</div>}

      {/* Row 3: dependencies and subtask progress */}
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {progress.total > 0 && <Chip tone={progress.open > 0 ? "warning" : "success"}>{progress.done}/{progress.total}</Chip>}
        <span className="ml-auto">
          <DependencyBadge item={item} allItems={allItems} />
        </span>
      </div>
    </div>
  );
}

function CardGhost({ item, members }: { item: WorkItem; members: Array<{ id: string; name: string }> }) {
  const m = members.find((member) => member.id === item.assignee) ?? { id: "unassigned", name: "Unassigned" };
  return (
    <div className="w-[260px] rotate-1 rounded-md border bg-card p-3 text-[12px] shadow-xl ring-2 ring-primary/30">
      <div className="mb-2 flex items-center gap-2">
        <PriorityIndicator priority={item.priority} />
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Avatar id={m.id} name={m.name} size={18} />
          <span className="truncate">{m.name}</span>
        </div>
        {item.label && <Chip>{item.label}</Chip>}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDueLabel(item.due)}</span>
      </div>
      <div className="mb-2.5 text-[13.5px] font-medium leading-[1.4]">{item.title}</div>
    </div>
  );
}
