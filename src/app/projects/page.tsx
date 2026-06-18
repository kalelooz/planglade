"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Activity, Clock3, FileText, Plus, X, FolderPlus, Pencil, Trash2, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { useStore } from "@/lib/store";
import { type ProjectStatus, type WorkItem } from "@/lib/mock-data";
import { compareLocalDateStrings, formatDueLabel, getDatePart, localDateKey } from "@/lib/dates";
import { Avatar, StatusIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { ProjectIcon, IconPicker } from "@/components/lovable/project-icon";
import { getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";

const STATUSES: ProjectStatus[] = ["Active", "In Review", "On Hold", "Archived"];
type ProjectActivityEvent = {
  id: string;
  action: "CREATED" | "UPDATED" | "MOVED" | "COMPLETED" | "DELETED" | "COMMENTED" | "ASSIGNED" | "UNASSIGNED";
  target: string;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};

const PROJECT_BOARD_COLUMNS: Array<{ key: string; label: string; statuses: WorkItem["status"][] }> = [
  { key: "todo", label: "To Do", statuses: ["Backlog", "To Do"] },
  { key: "progress", label: "In Progress", statuses: ["In Progress"] },
  { key: "review", label: "In Review", statuses: ["In Review"] },
];

function activityActionLabel(action: ProjectActivityEvent["action"]) {
  if (action === "CREATED") return "created";
  if (action === "UPDATED") return "updated";
  if (action === "MOVED") return "moved";
  if (action === "COMPLETED") return "completed";
  if (action === "DELETED") return "deleted";
  if (action === "COMMENTED") return "commented on";
  if (action === "ASSIGNED") return "assigned";
  return "unassigned";
}

function formatDueDate(due?: string) {
  return due ? formatDueLabel(due) : "-";
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function ProjectsInner() {
  const params = useSearchParams();
  const notes = useStore((s) => s.notes);
  const storeMembers = useStore((s) => s.members);
  const updateSettings = useStore((s) => s.updateSettings);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ReturnType<typeof toUiProject>[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(
    storeMembers.map((member) => ({ id: member.id, name: member.name }))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [iconEditingId, setIconEditingId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<"board" | "list">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projectActivity, setProjectActivity] = useState<ProjectActivityEvent[]>([]);
  const [projectActivityLoading, setProjectActivityLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const cols = "grid-cols-[minmax(72px,0.7fr)_minmax(0,1.7fr)] md:grid-cols-[minmax(64px,0.7fr)_minmax(140px,1.7fr)_minmax(96px,1fr)_minmax(100px,1fr)_minmax(72px,0.7fr)_minmax(44px,0.45fr)_minmax(44px,0.45fr)]";
  const today = useMemo(() => startOfLocalDay(now), [now]);
  const todayKey = localDateKey(today);
  const selectedProjectId = params.get("project");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
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
        const nextMembers = (session.members ?? []).map((member) => ({ id: member.id, name: member.name }));
        if (nextMembers.length > 0) {
          setMembers(nextMembers);
        }

        const [projectsRes, workItemsRes] = await Promise.all([
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load project tasks");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const itemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        setWorkItems(itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id)));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Projects");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const createProject = async (input: { name: string; status: ProjectStatus; owner: string; due: string; icon: string }) => {
    if (!workspaceId) return null;
    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || `project-${Date.now()}`;

    const status =
      input.status === "Active"
        ? "ACTIVE"
        : input.status === "In Review"
          ? "IN_REVIEW"
          : input.status === "On Hold"
            ? "ON_HOLD"
            : "ARCHIVED";

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        name: input.name,
        slug,
        status,
        dueDate: input.due ? `${input.due}T00:00:00.000Z` : undefined,
        color: "oklch(0.52 0.09 195)",
      }),
    });
    if (!response.ok) {
      setError("Failed to create project");
      return null;
    }

    const payload = (await response.json()) as { project: ApiProject };
    const next = { ...toUiProject(payload.project, currentUserId), icon: input.icon };
    setProjects((current) => [next, ...current]);
    return next.id;
  };

  const patchProject = async (id: string, input: { name: string; status: ProjectStatus; due: string; icon: string }) => {
    if (!workspaceId) return;
    const status =
      input.status === "Active"
        ? "ACTIVE"
        : input.status === "In Review"
          ? "IN_REVIEW"
          : input.status === "On Hold"
            ? "ON_HOLD"
            : "ARCHIVED";
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        status,
        dueDate: input.due ? `${input.due}T00:00:00.000Z` : null,
      }),
    });
    if (!response.ok) {
      setError("Failed to update project");
      return;
    }
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, name: input.name, status: input.status, due: input.due, icon: input.icon } : project
      )
    );
  };

  const destroyProject = async (id: string) => {
    if (!workspaceId) return false;
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Failed to delete project");
      return false;
    }
    setProjects((current) => current.filter((project) => project.id !== id));
    setWorkItems((current) => current.filter((item) => item.project !== id));
    return true;
  };

  const createAndFocusTask = async (projectId: string, status: WorkItem["status"] = "Backlog") => {
    if (!workspaceId) return;
    const apiStatus = toApiWorkStatus(status);
    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        projectId,
        title: "Untitled task",
        status: apiStatus,
        priority: "MEDIUM",
      }),
    });
    if (!response.ok) {
      setError("Failed to create task");
      return;
    }
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId);
    setWorkItems((current) => [next, ...current]);
    setSelectedTaskId(next.id);
    toast.success("Task created");
  };

  const patchTaskStatus = async (taskId: string, nextStatus: WorkItem["status"]) => {
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item)));
    const response = await fetch(`/api/work-items/${encodeURIComponent(taskId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: toApiWorkStatus(nextStatus),
        completedAt: nextStatus === "Done" ? new Date().toISOString() : null,
      }),
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to move task");
    }
  };

  const destroyTask = async (taskId: string) => {
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((item) => item.id !== taskId));
    const response = await fetch(`/api/work-items/${encodeURIComponent(taskId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to delete task");
      return;
    }
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  useEffect(() => {
    if (selectedProject && selectedProject.id !== activeProjectId) {
      updateSettings({ activeProjectId: selectedProject.id });
    }
  }, [activeProjectId, selectedProject, updateSettings]);

  useEffect(() => {
    if (!workspaceId || !currentUserId || !selectedProjectId) {
      setProjectActivity([]);
      return;
    }

    let active = true;
    setProjectActivityLoading(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/activity?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(selectedProjectId)}&limit=6`,
          {
            cache: "no-store",
            headers: { "x-flowboard-user-id": currentUserId },
          }
        );
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { events: ProjectActivityEvent[] };
        if (!active) return;
        setProjectActivity(payload.events ?? []);
      } finally {
        if (active) setProjectActivityLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [workspaceId, currentUserId, selectedProjectId]);

  const projectItems = useMemo(() => {
    if (!selectedProjectId) return [];
    return workItems.filter((workItem) => workItem.project === selectedProjectId);
  }, [selectedProjectId, workItems]);

  const scopedItems = useMemo(() => projectItems, [projectItems]);
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

  const boardBuckets = useMemo(() => {
    const openItems = scopedItems.filter((item) => item.status !== "Done");
    return PROJECT_BOARD_COLUMNS.map((column) => {
      const items = openItems.filter((item) => column.statuses.includes(item.status));
      return { ...column, items };
    });
  }, [scopedItems]);

  if (selectedProject) {
    const owner = members.find((member) => member.id === selectedProject.owner) ?? members[0];
    const items = projectItems;
    const done = items.filter((workItem) => workItem.status === "Done").length;
    const open = items.length - done;
    const overdue = items.filter((workItem) => workItem.status !== "Done" && !!workItem.due && compareLocalDateStrings(workItem.due, todayKey) < 0).length;
    const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    const projectItemIds = new Set(items.map((item) => item.id));
    const projectNoteIds = new Set(items.flatMap((item) => item.noteIds ?? []));
    const allProjectNotes = notes
      .filter((note) => projectNoteIds.has(note.id) || [...projectItemIds].some((id) => `${note.title} ${note.excerpt}`.includes(id)))
    const projectNotes = allProjectNotes.slice(0, 5);
    const hasMoreProjectNotes = allProjectNotes.length > 5;
    const recentProjectActivity = projectActivity.slice(0, 5);
    const hasMoreProjectActivity = projectActivity.length > 5;
    return (
      <AppShell title={<span className="font-medium">Projects / {selectedProject.name}</span>}>
        <div className="flex h-full min-h-0 flex-col bg-[#fafafa] lg:flex-row">
          <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
            <div className="mx-auto w-full max-w-5xl p-6 md:p-8 lg:p-12">
            {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
            {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading project data...</div>}
            <button onClick={() => router.push("/app/projects")} className="mb-4 text-[11px] font-medium text-zinc-500 hover:text-zinc-900">← All projects</button>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{selectedProject.status} project</p>
                <div className="mb-1 flex items-center gap-2">
                  <ProjectIcon name={selectedProject.icon} accent={selectedProject.accent} size={18} />
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900">{selectedProject.name}</h1>
                </div>
                <p className="text-xs font-light text-zinc-500">Project overview with live work items and progress.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { void createAndFocusTask(selectedProject.id); }} className="lov-btn lov-btn-primary">
                  <Plus className="h-3.5 w-3.5" /> New task
                </button>
                <button onClick={() => setEditingProjectId(selectedProject.id)} className="lov-btn lov-btn-ghost">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={async () => {
                    const deleted = await destroyProject(selectedProject.id);
                    if (!deleted) return;
                    updateSettings({ activeProjectId: null });
                    router.push("/app/projects");
                    toast.success("Project deleted");
                  }}
                  className="lov-btn lov-btn-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>

            <nav className="mb-6 flex items-center gap-1 border-b border-zinc-200/80 pb-2 text-xs">
              <a href="#project-overview" className="rounded-md bg-zinc-900 px-2.5 py-1.5 font-medium text-white">Overview</a>
              <a href="#project-tasks" className="rounded-md px-2.5 py-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">Tasks</a>
              <a href="#project-notes" className="rounded-md px-2.5 py-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">Docs</a>
              <Link href={`/app/calendar?project=${selectedProject.id}`} className="rounded-md px-2.5 py-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">Calendar</Link>
            </nav>

            <section id="project-overview" className="rounded-lg border border-zinc-200/80 bg-white px-4 py-3">
              <dl className="grid grid-cols-2 gap-y-3 text-[13px] md:grid-cols-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                  <dd className="mt-1"><Chip tone={selectedProject.status === "Active" ? "accent" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>{selectedProject.status}</Chip></dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Manager</dt>
                  <dd className="mt-1 flex items-center gap-2"><Avatar id={owner.id} name={owner.name} /> {owner.name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Due</dt>
                  <dd className="mt-1 text-muted-foreground">{selectedProject.due ? new Date(selectedProject.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</dt>
                  <dd className="mt-1 text-muted-foreground">{progress}% complete</dd>
                </div>
              </dl>
            </section>

            <section className="mt-4 grid overflow-hidden rounded-lg border border-zinc-200/80 bg-white md:grid-cols-4 md:divide-x md:divide-zinc-100">
              {[
                ["Open", open],
                ["Done", done],
                ["Overdue", overdue],
                ["Total", items.length],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 last:border-b-0 md:block md:border-b-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</div>
                </div>
              ))}
            </section>

            <section className={`mt-8 grid gap-8 ${projectActivity.length > 0 ? "lg:grid-cols-2" : ""}`}>
              <div id="project-notes">
              <ProjectContextSection title="Project docs" icon={<FileText className="h-3.5 w-3.5" />} href="/app/notes">
                {projectNotes.length === 0 ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">No notes linked to this project yet.</div>
                ) : (
                  <>
                    {projectNotes.map((note) => (
                      <Link key={note.id} href={`/app/notes?id=${note.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-[var(--fb-row-py)] text-xs last:border-b-0 hover:text-foreground">
                        <span className="min-w-0 truncate font-medium">{note.title}</span>
                        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{note.tag}</span>
                          <span>{note.updated}</span>
                        </span>
                      </Link>
                    ))}
                    {hasMoreProjectNotes && (
                      <div className="px-1 py-2">
                        <Link href="/app/notes" className="lov-btn lov-btn-ghost h-7 px-2 text-[11px]">
                          Show all
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </ProjectContextSection>
              </div>

              {projectActivity.length > 0 && <ProjectContextSection title="Recent changes" icon={<Activity className="h-3.5 w-3.5" />} href={`/activity?project=${selectedProject.id}`}>
                {projectActivityLoading ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">Loading project changes...</div>
                ) : (
                  <>
                    {recentProjectActivity.map((item) => {
                      const actorName = item.actor?.name ?? item.actor?.email ?? "System";
                      const action = activityActionLabel(item.action);
                      return (
                        <Link key={item.id} href={`/activity?project=${selectedProject.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-[var(--fb-row-py)] text-[13px] last:border-b-0 hover:text-foreground">
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{actorName}</span>{" "}
                            <span className="text-muted-foreground">{action}</span>{" "}
                            <span>{item.target}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                        </Link>
                      );
                    })}
                    {hasMoreProjectActivity && (
                      <div className="px-1 py-2">
                        <Link href={`/activity?project=${selectedProject.id}`} className="lov-btn lov-btn-ghost h-7 px-2 text-[11px]">
                          Show all
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </ProjectContextSection>}
            </section>

            <section id="project-tasks" className="mt-10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold tracking-tight">Tasks</h2>
                <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setTaskView("board")}
                    className={`lov-icon-btn h-7 w-7 ${taskView === "board" ? "lov-btn-active" : ""}`}
                    title="Board view"
                    aria-label="Board view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView("list")}
                    className={`lov-icon-btn h-7 w-7 ${taskView === "list" ? "lov-btn-active" : ""}`}
                    title="List view"
                    aria-label="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      updateSettings({ activeProjectId: project.id });
                      router.push(`/app/projects?project=${project.id}`);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
                      selectedProject.id === project.id
                        ? "bg-[var(--color-hover)] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: project.accent }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span>{scopedItems.length} total</span>
                <span>·</span>
                <span>{open} open</span>
                <span>·</span>
                <span>{done} done</span>
                {overdue > 0 ? (
                  <>
                    <span>·</span>
                    <span className="font-medium text-red-600">{overdue} overdue</span>
                  </>
                ) : null}
              </div>

              {items.length === 0 ? (
                <div className="rounded-md border px-3 py-12 text-center text-[13px] text-muted-foreground">No tasks in this project yet.</div>
              ) : taskView === "list" ? (
                <div className="divide-y rounded-md border">
                  {scopedItems.map((workItem) => {
                    const member = members.find((m) => m.id === workItem.assignee) ?? members[0];
                    return (
                      <div key={workItem.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={workItem.status === "Done"}
                          onChange={() => {
                            void patchTaskStatus(workItem.id, workItem.status === "Done" ? "To Do" : "Done");
                          }}
                          className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(workItem.id)}
                          className={`min-w-0 truncate text-left text-[14px] font-medium ${
                            workItem.status === "Done" ? "text-muted-foreground line-through" : "text-foreground hover:underline"
                          }`}
                        >
                          {workItem.title}
                        </button>
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ background: selectedProject.accent }} />
                            {selectedProject.name}
                          </span>
                          <Chip>{workItem.priority}</Chip>
                          <span className="inline-flex items-center gap-1"><StatusIcon s={workItem.status} /> {workItem.status}</span>
                          <span className={workItem.status !== "Done" && workItem.due && compareLocalDateStrings(workItem.due, todayKey) < 0 ? "font-medium text-red-600" : ""}>
                            {formatDueDate(workItem.due)}
                          </span>
                          <span className="inline-flex items-center gap-1"><Avatar id={member.id} name={member.name} />{member.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-3">
                  {PROJECT_BOARD_COLUMNS.map((column) => {
                    const columnItems = boardBuckets.find((bucket) => bucket.key === column.key)?.items ?? [];
                    return (
                      <section key={column.key} className="rounded-md border">
                        <header className="flex items-center justify-between border-b px-3 py-2">
                          <h3 className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                            <StatusIcon s={column.statuses[0] === "Backlog" ? "To Do" : column.statuses[0]} />
                            {column.label}
                          </h3>
                          <span className="text-[11px] text-muted-foreground">{columnItems.length}</span>
                        </header>
                        <div className="p-2">
                          {columnItems.length === 0 ? (
                            <div className="rounded border border-dashed px-3 py-8 text-center text-[12px] text-muted-foreground">No tasks</div>
                          ) : (
                            <div className="space-y-2">
                              {columnItems.map((workItem) => (
                                <button
                                  key={workItem.id}
                                  type="button"
                                  onClick={() => setSelectedTaskId(workItem.id)}
                                  className="w-full rounded-md border bg-card px-3 py-2 text-left hover:bg-[var(--color-hover)]/50"
                                >
                                  <p className="truncate text-[13px] font-medium">{workItem.title}</p>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Chip>{workItem.priority}</Chip>
                                    <span>{formatDueDate(workItem.due)}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
            </div>
          </div>
          <TaskDrawer
            item={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            membersOverride={members}
            projectsOverride={projects}
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

  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="h-full overflow-y-scroll [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-5xl p-6 md:p-8 lg:p-12">
          {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
          {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading projects...</div>}
          <div className="mb-1 flex items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Collections</p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Projects</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground">{projects.length} in your workspace</span>
              <button
                onClick={() => setModalOpen(true)}
                className="lov-btn lov-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </div>
          </div>
          <p className="mb-6 text-xs font-light text-zinc-500">Open a project to review its work, notes, and dates.</p>

          {projects.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white">
              {/* Column headers */}
              <div className={`grid ${cols} items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400`}>
                <span>Status</span>
                <span>Project</span>
                <span className="hidden md:block">Manager</span>
                <span className="hidden md:block">Progress</span>
                <span className="hidden md:block">Due</span>
                <span className="hidden text-right md:block">Tasks</span>
                <span className="hidden text-right md:block">Done</span>
              </div>

              {projects.map((p) => {
                const m = members.find((member) => member.id === p.owner) ?? members[0];
                const items = workItems.filter((w) => w.project === p.id);
                const done = items.filter((w) => w.status === "Done").length;
                const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
                const overdue = !!p.due && p.due < todayKey && p.status !== "Archived";
                return (
                  <div
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open project ${p.name}`}
                    onClick={() => { updateSettings({ activeProjectId: p.id }); router.push(`/app/projects?project=${p.id}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateSettings({ activeProjectId: p.id }); router.push(`/app/projects?project=${p.id}`); } }}
                    className={`grid ${cols} cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-4 text-xs last:border-b-0 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30`}
                  >
                    <span>
                      <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
                    </span>
                    <span className="relative flex items-center gap-2 font-medium text-foreground">
                      <button
                        type="button"
                        title="Change icon"
                        onClick={(e) => { e.stopPropagation(); setIconEditingId(iconEditingId === p.id ? null : p.id); }}
                        className="lov-icon-btn h-6 w-6"
                      >
                        <ProjectIcon name={p.icon} accent={p.accent} />
                      </button>
                      <span className="truncate">{p.name}</span>
                      {iconEditingId === p.id && (
                        <>
                          <div className="fixed inset-0 z-[70]" onMouseDown={(e) => { e.stopPropagation(); setIconEditingId(null); }} />
                          <div className="absolute left-0 top-8 z-[80] w-[336px]" onClick={(e) => e.stopPropagation()}>
                            <IconPicker
                              value={p.icon ?? "Folder"}
                              accent={p.accent}
                              onChange={(name) => {
                                setProjects((current) =>
                                  current.map((project) => (project.id === p.id ? { ...project, icon: name } : project))
                                );
                                setIconEditingId(null);
                              }}
                            />
                          </div>
                        </>
                      )}
                    </span>
                    <span className="hidden min-w-0 items-center gap-2 text-muted-foreground md:flex">
                      <Avatar id={m.id} name={m.name} /> <span className="truncate">{m.name}</span>
                    </span>
                    <span className="hidden items-center gap-2 md:flex">
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-zinc-200">
                        <span className="block h-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
                    </span>
                    <span className={`hidden md:block ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                      {p.due ? new Date(`${getDatePart(p.due)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                    <span className="hidden text-right text-muted-foreground md:block">{items.length}</span>
                    <span className="hidden text-right text-muted-foreground md:block">{done}</span>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <NewProjectModal
          members={members}
          onClose={() => setModalOpen(false)}
          onCreate={async (input) => {
            const id = await createProject(input);
            if (!id) return;
            updateSettings({ activeProjectId: id });
            toast.success(`Created project "${input.name}"`);
            setModalOpen(false);
            router.push(`/app/projects?project=${id}`);
          }}
        />
      )}

      {editingProjectId && selectedProject && (
        <NewProjectModal
          members={members}
          initial={selectedProject}
          title="Edit project"
          submitLabel="Save project"
          onClose={() => setEditingProjectId(null)}
          onCreate={async (input) => {
            await patchProject(editingProjectId, input);
            toast.success(`Updated project "${input.name}"`);
            setEditingProjectId(null);
          }}
        />
      )}
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-card/40 py-16 text-center">
      <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-[14px] font-medium text-foreground">No projects yet</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">Projects group related work items. Create one to start organizing your tasks.</p>
      <button
        onClick={onCreate}
        className="lov-btn lov-btn-primary mt-1"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}

function ProjectContextSection({ title, icon, href, children }: { title: string; icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">{icon}{title}</h2>
        <Link href={href} className="text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">Open</Link>
      </div>
      <div className="border-t border-border/70">{children}</div>
    </section>
  );
}

function NewProjectModal({
  members,
  initial,
  title,
  submitLabel,
  onClose,
  onCreate,
}: {
  members: { id: string; name: string }[];
  initial?: { name: string; status: ProjectStatus; owner: string; due: string; icon?: string };
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onCreate: (input: { name: string; status: ProjectStatus; owner: string; due: string; icon: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Folder");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "Active");
  const [owner, setOwner] = useState(initial?.owner ?? members[0]?.id ?? "AM");
  const [due, setDue] = useState(initial?.due ?? "");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), status, owner, due, icon });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-tight">{title ?? "New project"}</h2>
          <button onClick={onClose} className="lov-icon-btn" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card">
                <ProjectIcon name={icon} accent="var(--color-primary)" size={16} />
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="e.g. Mobile App v3"
                className="h-9 flex-1 rounded-md border bg-card px-2.5 text-[13px] outline-none focus:border-ring"
              />
            </div>
          </Field>

          <Field label="Icon">
            <IconPicker value={icon} accent="var(--color-primary)" onChange={setIcon} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Manager">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Due (optional)">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="lov-btn lov-btn-ghost">Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="lov-btn lov-btn-primary"
          >
            {submitLabel ?? "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
