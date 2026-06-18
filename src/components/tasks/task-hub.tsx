"use client";

import { type MouseEvent as ReactMouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, GripVertical, LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { DueMeta, PriorityBadge, ProjectTagMeta, StatusBadge, StatusSelect, TASK_STATUSES, TaskMetaChip } from "@/components/tasks/task-metadata";
import { cn } from "@/lib/utils";
import { isSameLocalDate, parseLocalDate } from "@/lib/dates";
import { getServerSession } from "@/lib/server-session-client";
import type { Project, Status, WorkItem } from "@/lib/mock-data";
import { type ApiNote, type ApiProject, type ApiWorkItem, toApiWorkStatus, toUiNotePreview, toUiProject, toUiWorkItem } from "@/lib/server-ui-mappers";

type Filter = "all" | "today" | "upcoming" | "overdue" | "no-date" | "blocked" | "completed";
type View = "list" | "board";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "no-date", label: "No date" },
  { id: "blocked", label: "Blocked" },
  { id: "completed", label: "Completed" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isBlocked(task: WorkItem) {
  return Boolean(task.blockerIds?.length);
}

function isOverdue(task: WorkItem, today: Date) {
  const due = parseLocalDate(task.due);
  return Boolean(due && task.status !== "Done" && due < startOfDay(today) && !isSameLocalDate(task.due, today));
}

function matchesFilter(task: WorkItem, filter: Filter, today: Date) {
  const due = parseLocalDate(task.due);
  const done = task.status === "Done";

  if (filter === "all") return true;
  if (filter === "completed") return done;
  if (done) return false;
  if (filter === "today") return isSameLocalDate(task.due, today);
  if (filter === "upcoming") return Boolean(due && due > startOfDay(today) && !isSameLocalDate(task.due, today));
  if (filter === "overdue") return isOverdue(task, today);
  if (filter === "no-date") return !task.due;
  return isBlocked(task);
}

function projectName(projects: Project[], id: string) {
  return projects.find((project) => project.id === id)?.name ?? (id === "general" ? "General" : "");
}

export function TaskHub() {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/app/tasks";
  const router = useRouter();
  const routeView: View = searchParams.get("view") === "board" ? "board" : "list";
  const [view, setView] = useState<View>(routeView);
  const [filter, setFilter] = useState<Filter>("all");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<WorkItem[]>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; tag: string; updated: string; excerpt: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());
  const pointerDragTaskId = useRef<string | null>(null);

  useEffect(() => {
    setView(routeView);
  }, [routeView]);

  const setTaskView = (nextView: View) => {
    setView(nextView);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextView === "board") nextParams.set("view", "board");
    else nextParams.delete("view");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);

        const [itemsRes, projectsRes, notesRes] = await Promise.all([
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!itemsRes.ok) throw new Error("Failed to load tasks");
        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!notesRes.ok) throw new Error("Failed to load notes");

        const itemsPayload = (await itemsRes.json()) as { workItems: ApiWorkItem[] };
        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        if (!active) return;

        const nextTasks = itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setTasks(nextTasks);
        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        setNotes(notesPayload.notes.map(toUiNotePreview));
        setSelectedId((current) => current ?? nextTasks[0]?.id ?? null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => tasks.filter((task) => matchesFilter(task, filter, today)),
    [filter, tasks, today]
  );

  const counts = useMemo(() => {
    return Object.fromEntries(filters.map(({ id }) => [id, tasks.filter((task) => matchesFilter(task, id, today)).length])) as Record<Filter, number>;
  }, [tasks, today]);

  const selected = selectedId ? tasks.find((task) => task.id === selectedId) ?? null : null;

  const grouped = useMemo(
    () => TASK_STATUSES.map((status) => ({ status, tasks: filtered.filter((task) => task.status === status) })),
    [filtered]
  );

  const patchStatus = async (task: WorkItem, status: Status) => {
    if (!workspaceId) return;
    if (task.status === status) return;
    const snapshot = tasks;
    setError(null);
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)));

    const response = await fetch(`/api/work-items/${encodeURIComponent(task.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: toApiWorkStatus(status),
        completedAt: status === "Done" ? new Date().toISOString() : null,
      }),
    });

    if (!response.ok) {
      setTasks(snapshot);
      setError("Failed to update task status");
    }
  };

  const dropTask = (taskId: string, status: Status) => {
    const task = tasks.find((item) => item.id === taskId);
    pointerDragTaskId.current = null;
    setDraggedTaskId(null);
    setDragOverStatus(null);
    if (!task || task.status === status) return;
    void patchStatus(task, status);
  };

  const onPointerDragStart = (event: PointerEvent<HTMLElement>, taskId: string) => {
    pointerDragTaskId.current = taskId;
    setDraggedTaskId(taskId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerDragMove = (event: PointerEvent<HTMLElement>) => {
    if (!pointerDragTaskId.current) return;
    const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-task-status]");
    setDragOverStatus((column?.dataset.taskStatus as Status | undefined) ?? null);
  };

  const onPointerDragEnd = (event: PointerEvent<HTMLElement>) => {
    if (!pointerDragTaskId.current) return;
    const taskId = pointerDragTaskId.current;
    const column = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-task-status]");
    const status = column?.dataset.taskStatus as Status | undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (status) dropTask(taskId, status);
    else {
      pointerDragTaskId.current = null;
      setDraggedTaskId(null);
      setDragOverStatus(null);
    }
  };

  const onMouseDragStart = (event: ReactMouseEvent<HTMLElement>, taskId: string) => {
    pointerDragTaskId.current = taskId;
    setDraggedTaskId(taskId);
    event.preventDefault();

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const column = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>("[data-task-status]");
      setDragOverStatus((column?.dataset.taskStatus as Status | undefined) ?? null);
    };
    const onUp = (upEvent: globalThis.MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const column = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>("[data-task-status]");
      const status = column?.dataset.taskStatus as Status | undefined;
      if (status) dropTask(taskId, status);
      else {
        pointerDragTaskId.current = null;
        setDraggedTaskId(null);
        setDragOverStatus(null);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <AppShell title={<span className="font-medium">Tasks</span>}>
      <div className="h-full min-h-0 overflow-y-auto bg-zinc-50/50 animate-fade-in">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6 md:p-8 lg:p-12">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div> : null}

          <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Work registry</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Tasks</h1>
              <p className="mt-0.5 text-xs font-light text-zinc-500">{tasks.length} task{tasks.length === 1 ? "" : "s"} in this workspace</p>
            </div>
            <div className="inline-flex w-fit rounded-lg border border-zinc-200/80 bg-zinc-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTaskView("list")}
                className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 transition-colors", view === "list" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900")}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setTaskView("board")}
                className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 transition-colors", view === "board" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
            </div>
          </header>

          <div className="flex flex-wrap gap-1.5">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium",
                  filter === item.id
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                )}
              >
                {item.label}
                <span className={cn("text-[11px]", filter === item.id ? "text-zinc-300" : "text-zinc-400")}>{counts[item.id]}</span>
              </button>
            ))}
          </div>

          <main className={cn("grid min-h-0 grid-cols-1 gap-8", selected && "lg:grid-cols-[minmax(0,1fr)_360px]")}>
            <section className="min-w-0 rounded-md border border-zinc-200 bg-white">
              {loading ? (
                <div className="px-3 py-12 text-center text-[13px] text-zinc-500">Loading tasks...</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-12 text-center text-[13px] text-zinc-500">No tasks match this filter.</div>
              ) : view === "list" ? (
                <div className="divide-y divide-zinc-100">
                  {filtered.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      project={projectName(projects, task.project)}
                      selected={selectedId === task.id}
                      overdue={isOverdue(task, today)}
                      blocked={isBlocked(task)}
                      onSelect={() => setSelectedId(task.id)}
                      onComplete={() => void patchStatus(task, task.status === "Done" ? "In Progress" : "Done")}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                  {grouped.map((column) => (
                    <div
                      key={column.status}
                      data-task-status={column.status}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragOverStatus !== column.status) setDragOverStatus(column.status);
                      }}
                      onDragLeave={() => setDragOverStatus((current) => (current === column.status ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropTask(event.dataTransfer.getData("text/plain") || draggedTaskId || "", column.status);
                      }}
                      className={cn(
                        "flex min-h-40 min-w-0 flex-col rounded-md border bg-zinc-50 transition-colors lg:max-h-[calc(100vh-240px)]",
                        dragOverStatus === column.status ? "border-zinc-950 bg-zinc-100" : "border-zinc-200"
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-zinc-200 px-2.5 py-2">
                        <StatusBadge status={column.status} />
                        <span className="text-[11px] text-zinc-500">{column.tasks.length}</span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {column.tasks.length === 0 ? <p className="px-1 py-4 text-center text-[12px] text-zinc-400">No tasks</p> : null}
                        {column.tasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(event) => {
                              setDraggedTaskId(task.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", task.id);
                            }}
                            onDragEnd={() => {
                              setDraggedTaskId(null);
                              setDragOverStatus(null);
                            }}
                            className={cn(
                              "w-full cursor-grab rounded-md border bg-white p-2 text-left shadow-sm active:cursor-grabbing",
                              selectedId === task.id ? "border-zinc-950 ring-1 ring-zinc-950" : "border-zinc-200 hover:border-zinc-300",
                              draggedTaskId === task.id && "opacity-60"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <button type="button" onClick={() => setSelectedId(task.id)} className="line-clamp-2 min-w-0 flex-1 text-left text-[12px] font-medium text-zinc-950">
                                {task.title}
                              </button>
                              <span
                                role="button"
                                tabIndex={0}
                                title="Drag task"
                                onPointerDown={(event) => onPointerDragStart(event, task.id)}
                                onPointerMove={onPointerDragMove}
                                onPointerUp={onPointerDragEnd}
                                onMouseDown={(event) => onMouseDragStart(event, task.id)}
                                aria-label={`Drag ${task.title}`}
                                className="shrink-0 cursor-grab rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-[11px] text-zinc-500">{projectName(projects, task.project) || task.label}</span>
                              <DueMeta due={task.due} overdue={isOverdue(task, today)} />
                            </div>
                            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                              <PriorityBadge priority={task.priority} />
                              <StatusSelect value={task.status} onChange={(status) => { void patchStatus(task, status); }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <TaskDrawer
              item={selected}
              onClose={() => setSelectedId(null)}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              projectsOverride={projects}
              notesOverride={notes}
              onItemPatched={(id, patch) => {
                setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
              }}
              onItemReplaced={(next) => {
                setTasks((current) => current.map((task) => (task.id === next.id ? next : task)));
              }}
            />
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function TaskRow({
  task,
  project,
  selected,
  overdue,
  blocked,
  onSelect,
  onComplete,
}: {
  task: WorkItem;
  project: string;
  selected: boolean;
  overdue: boolean;
  blocked: boolean;
  onSelect: () => void;
  onComplete: () => void;
}) {
  return (
    <div className={cn("grid grid-cols-[24px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs md:grid-cols-[24px_minmax(0,1fr)_auto_auto_76px]", selected ? "bg-zinc-100/80" : "hover:bg-zinc-50/80")}>
      <button type="button" onClick={onComplete} aria-label={`${task.status === "Done" ? "Reopen" : "Complete"} ${task.title}`} className="mt-0.5 text-zinc-400 hover:text-zinc-950">
        {task.status === "Done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium text-zinc-950", task.status === "Done" && "text-zinc-500 line-through")}>{task.title}</span>
          {blocked ? <TaskMetaChip className="border-amber-200 bg-amber-50 text-amber-700">Blocked</TaskMetaChip> : null}
          {overdue ? <TaskMetaChip className="border-red-200 bg-red-50 text-red-700">Overdue</TaskMetaChip> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
          <ProjectTagMeta project={project} tag={task.label} />
        </div>
      </button>
      <span className="hidden md:block"><StatusBadge status={task.status} /></span>
      <span className="hidden md:block"><PriorityBadge priority={task.priority} /></span>
      <span className="hidden md:block"><DueMeta due={task.due} overdue={overdue} /></span>
    </div>
  );
}
