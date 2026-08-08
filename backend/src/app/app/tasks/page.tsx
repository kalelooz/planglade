"use client";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Plus, Search, LayoutGrid, List, GripVertical } from "lucide-react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "@/components/lovable/shell";
import { ProjectViewTitle, Toolbar } from "@/components/lovable/page";
import { StatusIcon } from "@/components/lovable/icons";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { BoardPageContent, reorderLocalWorkItems } from "@/app/board/board-page-content";
import { useStore } from "@/lib/store";
import { getDatePart, isSameLocalDate, parseLocalDate } from "@/lib/dates";
import type { Status, WorkItem } from "@/lib/mock-data";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiNotePreview,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getDemoFixtures } from "@/lib/demo-data";
import { blockReadOnlyMutation, handleDemoReadOnlyResponse } from "@/lib/demo-readonly";

const order: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const listStatusIds = new Set(order as string[]);
type ListDragTarget = { status: Status; index: number };
const sortOptions = ["Manual", "Due", "Priority", "Created"] as const;
type SortOption = (typeof sortOptions)[number];
const filters = ["all", "mine", "today", "upcoming", "overdue", "no-date", "blocked", "completed"] as const;
type TaskFilter = (typeof filters)[number];
const filterLabels: Record<TaskFilter, string> = {
  all: "All",
  mine: "Mine",
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  "no-date": "No date",
  blocked: "Blocked",
  completed: "Completed",
};

function priorityRank(priority: string) {
  return priority === "High" ? 0 : priority === "Medium" ? 1 : 2;
}

function isTaskFilter(value: string | null): value is TaskFilter {
  return value != null && (filters as readonly string[]).includes(value);
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function matchesTaskFilter(item: WorkItem, filter: TaskFilter, today: Date, currentUserId: string | null): boolean {
  const due = parseLocalDate(item.due);
  const todayStart = startOfLocalDay(today);
  const sameDay = isSameLocalDate(item.due, todayStart);
  const done = item.status === "Done";

  if (filter === "all") return true;
  if (filter === "mine") return Boolean(currentUserId) && item.assignee === currentUserId && !done;
  if (filter === "completed") return done;
  if (done) return false;
  if (filter === "blocked") return (item.blockerIds?.length ?? 0) > 0;
  if (filter === "overdue") return !!due && due < todayStart && !sameDay;
  if (filter === "today") return sameDay;
  if (filter === "upcoming") return !!due && due > todayStart && !sameDay;
  if (filter === "no-date") return !item.due;
  return true;
}

function WorkItemsInner({ basePath }: { basePath: "/app" | "/demo" }) {
  const params = useSearchParams();
  const projectFilter = params.get("project");
  const taskFilter = params.get("task");
  const viewParam = params.get("view");
  const urlFilter = params.get("filter");
  const activeFilter = isTaskFilter(urlFilter) ? urlFilter : "all";
  const focusParam = params.get("focus");
  const drawerFocus = focusParam === "comments" || focusParam === "history" ? focusParam : undefined;
  const storedActiveProjectId = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);
  const isDemoMode = basePath === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const activeProjectSetting = isDemoMode && !demoData?.apiProjects.some((project) => project.id === storedActiveProjectId)
    ? null
    : storedActiveProjectId;

  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : []);
  const [projects, setProjects] = useState<Array<ReturnType<typeof toUiProject>>>(() => demoData
    ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user"))
    : []);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);

  const [openCols, setOpenCols] = useState<Record<Status, boolean>>({
    Backlog: true,
    "To Do": true,
    "In Progress": true,
    "In Review": true,
    Done: true,
  });
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const [focusNew, setFocusNew] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("Manual");
  const [now, setNow] = useState(() => new Date());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<ListDragTarget | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  const dragTargetRef = useRef<ListDragTarget | null>(null);

  const scopedProjectId = projectFilter ?? activeProjectSetting;
  const boardHref = scopedProjectId ? `${basePath}/tasks?view=board&project=${encodeURIComponent(scopedProjectId)}` : `${basePath}/tasks?view=board`;
  const listHref = scopedProjectId ? `${basePath}/tasks?project=${encodeURIComponent(scopedProjectId)}` : `${basePath}/tasks`;
  const selectedId = taskFilter ?? manualSelectedId;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (projectFilter && projectFilter !== activeProjectSetting) {
      updateSettings({ activeProjectId: projectFilter });
    }
  }, [activeProjectSetting, projectFilter, updateSettings]);

  useEffect(() => {
    if (isDemoMode) return;
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
        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name })));

        const [projectsRes, workItemsRes, relationsRes] = await Promise.all([
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load tasks");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const mapped = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mapped, relationsPayload.relations));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isDemoMode, updateSettings]);

  const createAndFocus = async (status?: Status) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const targetProjectId = scopedProjectId ?? projects[0]?.id ?? null;
    if (!targetProjectId) {
      setError("Create a project first to add tasks.");
      return;
    }

    const response = await apiFetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        projectId: targetProjectId,
        title: "New task",
        status: toApiWorkStatus(status ?? "Backlog"),
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
    setManualSelectedId(next.id);
    setFocusNew(true);
    toast.success("Task created");
  };

  const patchTaskStatus = async (id: string, nextStatus: Status, beforeId?: string | null, snapshot = workItems) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const completedAt = nextStatus === "Done" ? new Date().toISOString() : null;
    if (beforeId === undefined) {
      setWorkItems((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    }

    const response = await apiFetch(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        status: toApiWorkStatus(nextStatus),
        completedAt,
        ...(beforeId === undefined ? {} : { beforeId }),
      }),
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to update task");
    }
  };

  const handleDelete = async (id: string) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setManualSelectedId(null);

    const response = await apiFetch(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      headers: { "x-flowboard-user-id": currentUserId ?? "" },
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to delete task");
    }
  };

  const filtered = useMemo(() => {
    return workItems.filter((w) => {
      if (scopedProjectId && w.project !== scopedProjectId) return false;
      if (!matchesTaskFilter(w, activeFilter, now, currentUserId)) return false;
      if (query && !w.title.toLowerCase().includes(query.toLowerCase()) && !w.id.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [workItems, scopedProjectId, activeFilter, now, currentUserId, query]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    if (sort === "Manual") {
      items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    } else if (sort === "Priority") {
      items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || getDatePart(a.due).localeCompare(getDatePart(b.due)));
    } else if (sort === "Created") {
      items.sort((a, b) => b.id.localeCompare(a.id));
    } else {
      items.sort((a, b) => getDatePart(a.due).localeCompare(getDatePart(b.due)) || priorityRank(a.priority) - priorityRank(b.priority));
    }
    return items;
  }, [filtered, sort]);

  const grouped = order.map((s) => ({ status: s, items: sorted.filter((w) => w.status === s) }));
  const project = projects.find((p) => p.id === scopedProjectId);
  const selected = selectedId ? workItems.find((w) => w.id === selectedId) ?? null : null;
  const activeDragItem = activeDragId ? workItems.find((workItem) => workItem.id === activeDragId) ?? null : null;
  const canReorder = sort === "Manual" && activeFilter === "all" && !query.trim();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    return pointerHits.length > 0 ? pointerHits : closestCorners(args);
  };
  const setNextDragTarget = (next: ListDragTarget | null) => {
    dragTargetRef.current = next;
    setDragTarget(next);
  };
  const getDragTarget = (event: DragOverEvent): ListDragTarget | null => {
    const activeId = String(event.active.id);
    const moved = workItems.find((item) => item.id === activeId);
    if (!moved || !event.over) return null;

    const overId = String(event.over.id);
    const status = overId.startsWith("list-status:")
      ? overId.replace("list-status:", "") as Status
      : workItems.find((item) => item.id === overId)?.status;
    if (!status || !listStatusIds.has(status)) return null;

    const targetItems = workItems.filter((item) => item.project === moved.project && item.status === status && item.id !== activeId);
    if (overId.startsWith("list-status:")) return { status, index: targetItems.length };
    const overIndex = targetItems.findIndex((item) => item.id === overId);
    if (overIndex === -1) return { status, index: targetItems.length };
    const activeRect = event.active.rect.current.translated;
    const isBelowTarget = activeRect && event.over.rect
      ? activeRect.top + activeRect.height / 2 > event.over.rect.top + event.over.rect.height / 2
      : false;
    return { status, index: overIndex + (isBelowTarget ? 1 : 0) };
  };
  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const item = workItems.find((workItem) => workItem.id === id);
    if (!item) return;
    setActiveDragId(id);
    setDragHeight(event.active.rect.current.initial?.height ?? 0);
    setNextDragTarget({
      status: item.status,
      index: workItems.filter((workItem) => workItem.project === item.project && workItem.status === item.status).indexOf(item),
    });
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const target = dragTargetRef.current;
    setNextDragTarget(null);
    const activeId = String(event.active.id);
    const moved = workItems.find((item) => item.id === activeId);
    if (!moved || !target) return;

    const targetItems = workItems.filter((item) => item.project === moved.project && item.status === target.status && item.id !== activeId);
    const beforeId = targetItems[target.index]?.id ?? null;
    const snapshot = workItems;
    setWorkItems((current) => reorderLocalWorkItems(current, activeId, target.status, beforeId, scopedProjectId));
    void patchTaskStatus(activeId, target.status, beforeId, snapshot);
    toast.success(moved.status === target.status ? "Task reordered" : "Task moved", {
      description: moved.status === target.status ? "Manual order updated" : `Moved to ${target.status}`,
    });
  };
  const filterCounts = useMemo(() => {
    const scoped = scopedProjectId ? workItems.filter((w) => w.project === scopedProjectId) : workItems;
    return filters.reduce<Record<TaskFilter, number>>((counts, filter) => {
      counts[filter] = scoped.filter((item) => matchesTaskFilter(item, filter, now, currentUserId)).length;
      return counts;
    }, {} as Record<TaskFilter, number>);
  }, [workItems, scopedProjectId, now, currentUserId]);

  if (viewParam === "board") {
    return <BoardPageContent />;
  }

  return (
    <AppShell
      title={<ProjectViewTitle projectName={project?.name} view="Tasks" />}
      toolbar={
        <Toolbar>
          <div className="lov-segment-group">
            <span className="lov-segment lov-segment-active">
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </span>
            <Link
              href={boardHref}
              className="lov-segment"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Board</span>
            </Link>
          </div>
          {activeFilter !== "all" && (
            <Link href={listHref} className="h-7 rounded px-2 py-1 text-[12px] text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1">
              Clear filter
            </Link>
          )}
          <label className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="h-7 rounded border bg-card px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 sm:text-[12px]">
              {sortOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="flex h-7 items-center gap-1.5 rounded border bg-card px-2 text-[12px] text-muted-foreground focus-within:ring-2 focus-within:ring-zinc-950 focus-within:ring-offset-1">
              <Search className="h-3 w-3" aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tasks" className="w-32 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-[13px]" placeholder="Search tasks" />
            </div>
            <button
              onClick={() => {
                void createAndFocus();
              }}
              className="lov-btn lov-btn-primary"
            >
              <Plus className="h-3 w-3" /> New task
            </button>
          </span>
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-6xl overflow-x-hidden py-4 sm:px-4 sm:py-6">
            <div className="app-workspace-canvas overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
            {error && <div role="alert" className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">Unable to load tasks. Refresh the page to try again. Your workspace data is unchanged.</div>}
            {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading tasks...</div>}
            <div className="mb-5 px-1">
              <h1 className="text-[15px] font-semibold tracking-tight">Tasks</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">All tasks in {project?.name ?? "this workspace"}.</p>
            </div>
            <div className="mb-5 flex items-center gap-1.5 overflow-x-auto text-[12px]">
              <div className="lov-segment-group flex-shrink-0">
                {filters.map((filter) => {
                  const href = scopedProjectId
                    ? `${basePath}/tasks?filter=${filter}&project=${encodeURIComponent(scopedProjectId)}`
                    : filter === "all"
                      ? `${basePath}/tasks`
                      : `${basePath}/tasks?filter=${filter}`;
                  const active = activeFilter === filter;
                  return (
                    <Link
                      key={filter}
                      href={href}
                      className={`lov-segment whitespace-nowrap ${active ? "lov-segment-active" : ""}`}
                    >
                      <span>{filterLabels[filter]}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{filterCounts[filter]}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div data-task-column-header className="hidden grid-cols-[auto_minmax(22rem,1fr)_96px_minmax(7rem,9rem)_112px_32px] items-center gap-x-3 border-y border-border bg-muted/35 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:grid">
              <span aria-hidden="true" />
              <span>Task</span>
              <span>Priority</span>
              <span>Assignee</span>
              <span>Due</span>
              <span className="sr-only">Actions</span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
              onDragStart={onDragStart}
              onDragOver={(event) => setNextDragTarget(getDragTarget(event))}
              onDragEnd={onDragEnd}
              onDragCancel={() => { setActiveDragId(null); setNextDragTarget(null); }}
            >
              <div className="border-x border-border">
              {grouped.map(({ status, items }) => (
                <ListStatusSection
                  key={status}
                  status={status}
                  items={items}
                  activeDragId={activeDragId}
                  holeAt={dragTarget?.status === status ? dragTarget.index : null}
                  dragHeight={dragHeight}
                  open={openCols[status]}
                  reorderable={canReorder && !isDemoMode}
                  selectedId={selectedId}
                  allItems={workItems}
                  members={members}
                  onToggle={() => setOpenCols((current) => ({ ...current, [status]: !current[status] }))}
                  onSelect={setManualSelectedId}
                  onMove={(id, nextStatus) => {
                    const snapshot = workItems;
                    setWorkItems((current) => reorderLocalWorkItems(current, id, nextStatus, null, scopedProjectId));
                    void patchTaskStatus(id, nextStatus, null, snapshot);
                  }}
                  onDelete={(id) => { void handleDelete(id); }}
                  onAdd={isDemoMode ? undefined : () => { void createAndFocus(status); }}
                />
              ))}
              </div>
              <DragOverlay>
                {activeDragItem ? <ListTaskGhost item={activeDragItem} /> : null}
              </DragOverlay>
            </DndContext>
            {sorted.length === 0 && (
              <div className="mt-2 flow-empty py-10">
                <p className="text-[14px] font-medium text-foreground">No tasks match this view.</p>
                <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                  {query.trim()
                    ? "Try a different search term, or clear the filter to see every task."
                    : activeFilter === "all"
                      ? "Create your first task to get started."
                      : "Try a different filter, or clear it to see every task."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      void createAndFocus();
                    }}
                    className="lov-btn lov-btn-primary h-8"
                  >
                    <Plus className="h-3.5 w-3.5" /> New task
                  </button>
                  {(activeFilter !== "all" || query.trim()) && (
                    <Link href={listHref} className="lov-btn lov-btn-ghost h-8">
                      Clear filter
                    </Link>
                  )}
                </div>
              </div>
            )}
            <div className="h-24" />
            </div>
          </div>
        </div>

        <TaskDrawer
          readOnly={isDemoMode}
          item={selected}
          focusTitle={focusNew}
          onTitleFocused={() => setFocusNew(false)}
          onClose={() => {
            setManualSelectedId(null);
            setFocusNew(false);
          }}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          notesOverride={demoData?.apiNotes.map(toUiNotePreview)}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setManualSelectedId}
          initialFocusSection={drawerFocus}
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

function EmptyStatus({ status, onAdd }: { status: string; onAdd?: () => void }) {
  return (
    <div className="flow-empty flow-empty-inline">
      <p className="text-[13px] font-medium text-foreground">No tasks in {status} yet.</p>
      <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Add one when you know the next step, or leave it for now.</p>
      {onAdd ? <div className="mt-3 flex items-center">
        <button
          onClick={onAdd}
          className="lov-btn lov-btn-ghost h-7 px-2 text-[11px]"
        >
          <Plus className="h-3 w-3" />
          Quick add to {status}
        </button>
      </div> : null}
    </div>
  );
}

function ListStatusSection({
  status,
  items,
  activeDragId,
  holeAt,
  dragHeight,
  open,
  reorderable,
  selectedId,
  allItems,
  members,
  onToggle,
  onSelect,
  onMove,
  onDelete,
  onAdd,
}: {
  status: Status;
  items: WorkItem[];
  activeDragId: string | null;
  holeAt: number | null;
  dragHeight: number;
  open: boolean;
  reorderable: boolean;
  selectedId: string | null;
  allItems: WorkItem[];
  members: Array<{ id: string; name: string }>;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onMove: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list-status:${status}`, disabled: !reorderable });
  const visibleItems = activeDragId ? items.filter((item) => item.id !== activeDragId) : items;

  return (
    <section ref={setNodeRef} className={isOver ? "bg-primary/[0.025]" : undefined}>
      <button
        onClick={onToggle}
        className="app-group-header hover:bg-muted/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950"
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <StatusIcon s={status} />
        <span>{status}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
      </button>
      {open && (
        <SortableContext items={visibleItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {visibleItems.length === 0 && holeAt === null ? (
            <EmptyStatus status={status} onAdd={onAdd} />
          ) : (
            <div>
              {visibleItems.map((item, index) => (
                <div key={item.id} data-slotwrap>
                  {holeAt === index && <ListDropHole height={dragHeight} />}
                  <ListSortableRow
                    item={item}
                    disabled={!reorderable}
                    allItems={allItems}
                    selected={selectedId === item.id}
                    members={members}
                    onSelect={() => onSelect(item.id)}
                    onMove={(nextStatus) => onMove(item.id, nextStatus)}
                    onDelete={() => onDelete(item.id)}
                  />
                </div>
              ))}
              {holeAt === visibleItems.length && <ListDropHole height={dragHeight} />}
            </div>
          )}
        </SortableContext>
      )}
    </section>
  );
}

function ListSortableRow({
  item,
  disabled,
  allItems,
  selected,
  members,
  onSelect,
  onMove,
  onDelete,
}: {
  item: WorkItem;
  disabled: boolean;
  allItems: WorkItem[];
  selected: boolean;
  members: Array<{ id: string; name: string }>;
  onSelect: () => void;
  onMove: (status: Status) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={disabled ? undefined : "cursor-grab touch-none active:cursor-grabbing"}
      {...attributes}
      {...listeners}
    >
      <span className="sr-only">Drag {item.title} to change its status or manual order.</span>
      <WorkItemRow
        item={item}
        allItems={allItems}
        selected={selected}
        membersOverride={members}
        onClick={onSelect}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  );
}

function ListDropHole({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      data-task-drop-hole="true"
      className="mx-2 my-1 rounded border border-dashed border-primary/40 bg-primary/5"
      style={{ height: Math.max(height, 44) }}
    />
  );
}

function ListTaskGhost({ item }: { item: WorkItem }) {
  return (
    <div className="w-[min(34rem,calc(100vw-2rem))] rounded border border-primary/40 bg-card px-3 py-2 text-[13px] font-medium shadow-xl">
      <span className="mr-2 inline-flex align-middle text-muted-foreground"><GripVertical className="h-3.5 w-3.5" /></span>
      {item.title}
    </div>
  );
}

export default function WorkItemsPage() {
  const basePath = usePathname().startsWith("/demo") ? "/demo" : "/app";
  return (
    <Suspense fallback={null}>
      <WorkItemsInner basePath={basePath} />
    </Suspense>
  );
}
