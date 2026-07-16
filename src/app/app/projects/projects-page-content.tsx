"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, ListTodo, Plus, X, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { DateField } from "@/components/lovable/date-field";
import { useStore } from "@/lib/store";
import { type ProjectStatus, type WorkItem } from "@/lib/mock-data";
import { compareLocalDateStrings, formatDueLabel, getDatePart, localDateKey } from "@/lib/dates";
import { Avatar } from "@/components/lovable/icons";
import { PriorityIndicator } from "@/components/lovable/priority-indicator";
import { Chip, TitleCrumbs } from "@/components/lovable/page";
import { ProjectIcon, IconPicker } from "@/components/lovable/project-icon";
import { FlowMetaPill, FlowRow } from "@/components/lovable/flow-ui";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import { ProjectNotesSection, type UiProjectNote } from "@/components/projects/project-notes-section";
import { DEMO_MODE_MESSAGE } from "@/lib/demo-data";
import { getDemoFixtures } from "@/lib/demo-data";
import {
  type ApiNote,
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiProject,
  toUiNotePreview,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, isBlockedByOpenTask, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { DependencyBadge } from "@/components/lovable/dependency-badge";
import { TaskCompletionToggle } from "@/components/lovable/task-completion-toggle";

const STATUSES: ProjectStatus[] = ["Active", "In Review", "On Hold", "Archived"];
type ProjectNotePreview = UiProjectNote;
const PROJECT_SECTION_LABELS = {
  overview: "Overview",
  tasks: "Tasks",
  notes: "Notes",
  calendar: "Calendar",
} as const;
const PROJECT_SECTION_CRUMB_LABELS = {
  overview: "Overview",
  tasks: "Tasks",
  notes: "Project notes",
  calendar: "Calendar",
} as const;
type ProjectSection = keyof typeof PROJECT_SECTION_LABELS;
const REMOVED_PROJECT_SECTIONS = new Set(["docs"]);

function getProjectSection(value: string | null): ProjectSection {
  if (value && REMOVED_PROJECT_SECTIONS.has(value)) return "notes";
  return value && value in PROJECT_SECTION_LABELS ? (value as ProjectSection) : "overview";
}

function formatDueDate(due?: string) {
  return due ? formatDueLabel(due) : "-";
}

function normalizeTaskRowText(value: string) {
  return value
    .replace(/`r`n|r`n|\\r|\\n|[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function priorityRank(priority: WorkItem["priority"]) {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;
  return 2;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

function taskDueSortValue(item: WorkItem) {
  return item.due ? getDatePart(item.due) : "9999-12-31";
}

function compareUsefulTasks(a: WorkItem, b: WorkItem) {
  return taskDueSortValue(a).localeCompare(taskDueSortValue(b)) || priorityRank(a.priority) - priorityRank(b.priority);
}

function formatProjectDate(due?: string) {
  return due ? new Date(`${getDatePart(due)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
}

function getLinkedProjectNotes(projectId: string, projectNotes: ProjectNotePreview[]) {
  return projectNotes.filter((note) => note.projectId === projectId);
}

function taskDateKey(item: WorkItem) {
  return getDatePart(item.due || item.start);
}

function ProjectsInner({ projectId, basePath = "/app" }: { projectId?: string; basePath?: "/app" | "/demo" }) {
  const params = useSearchParams();
  const storeMembers = useStore((s) => s.members);
  const updateSettings = useStore((s) => s.updateSettings);
  const setStoreProjects = useStore((s) => s.setProjects);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const router = useRouter();
  const isDemoMode = basePath === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;

  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [projects, setProjects] = useState<ReturnType<typeof toUiProject>[]>(() => demoData
    ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user"))
    : []);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(
    isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : storeMembers.map((member) => ({ id: member.id, name: member.name }))
  );
  const [projectNotes, setProjectNotes] = useState<ProjectNotePreview[]>(() => demoData
    ? demoData.apiNotes.map((note) => ({ ...toUiNotePreview(note), body: note.body ?? "", projectId: note.projectId ?? null }))
    : []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [now, setNow] = useState(() => new Date());

  const blockDemoAction = () => toast(DEMO_MODE_MESSAGE);
  const today = useMemo(() => startOfLocalDay(now), [now]);
  const todayKey = localDateKey(today);
  const selectedProjectId = projectId ?? params.get("project");
  const selectedSection = getProjectSection(params.get("section"));
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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
        setCurrentUserId(session.user.id);
        const nextMembers = (session.members ?? []).map((member) => ({ id: member.id, name: member.name }));
        if (nextMembers.length > 0) {
          setMembers(nextMembers);
        }

        const [projectsRes, workItemsRes, relationsRes, notesRes] = await Promise.all([
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load project tasks");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");
        if (!notesRes.ok) throw new Error("Failed to load project notes");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const itemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        if (!active) return;

        const mappedProjects = projectsPayload.projects.map((project) => toUiProject(project, session.user.id));
        setProjects(mappedProjects);
        setStoreProjects(mappedProjects);
        const mappedItems = itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mappedItems, relationsPayload.relations));
        setProjectNotes(notesPayload.notes.map((note) => ({ ...toUiNotePreview(note), body: note.body ?? "", projectId: note.projectId ?? null })));
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
  }, [isDemoMode, setStoreProjects]);

  const createProject = async (input: { name: string; description: string; status: ProjectStatus; owner: string; due: string; icon: string }) => {
    if (isDemoMode) {
      blockDemoAction();
      return null;
    }
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

    const response = await apiFetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        name: input.name,
        slug,
        description: input.description || undefined,
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
    const nextProjects = [next, ...projects];
    setProjects(nextProjects);
    setStoreProjects(nextProjects);
    return next.id;
  };

  const patchProject = async (id: string, input: { name: string; description: string; status: ProjectStatus; due: string; icon: string }) => {
    if (isDemoMode) {
      blockDemoAction();
      return;
    }
    if (!workspaceId) return;
    const status =
      input.status === "Active"
        ? "ACTIVE"
        : input.status === "In Review"
          ? "IN_REVIEW"
          : input.status === "On Hold"
            ? "ON_HOLD"
            : "ARCHIVED";
    const response = await apiFetch(`/api/projects/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        status,
        dueDate: input.due ? `${input.due}T00:00:00.000Z` : null,
      }),
    });
    if (!response.ok) {
      setError("Failed to update project");
      return;
    }
    const nextProjects = projects.map((project) =>
      project.id === id ? { ...project, name: input.name, description: input.description, status: input.status, due: input.due, icon: input.icon } : project
    );
    setProjects(nextProjects);
    setStoreProjects(nextProjects);
  };

  const destroyProject = async (id: string) => {
    if (isDemoMode) {
      blockDemoAction();
      return false;
    }
    if (!workspaceId) return false;
    const response = await apiFetch(`/api/projects/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Failed to delete project");
      return false;
    }
    const nextProjects = projects.filter((project) => project.id !== id);
    setProjects(nextProjects);
    setStoreProjects(nextProjects);
    setWorkItems((current) => current.filter((item) => item.project !== id));
    return true;
  };

  const createAndFocusTask = async (projectId: string, status: WorkItem["status"] = "Backlog", title = "New task") => {
    if (isDemoMode) {
      blockDemoAction();
      return;
    }
    if (!workspaceId) return;
    const trimmedTitle = title.trim();
    const apiStatus = toApiWorkStatus(status);
    const response = await apiFetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        projectId,
        title: trimmedTitle || "New task",
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
    const response = await apiFetch(`/api/work-items/${encodeURIComponent(taskId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
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
    const response = await apiFetch(`/api/work-items/${encodeURIComponent(taskId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
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

  const projectItems = useMemo(() => {
    if (!selectedProjectId) return [];
    return workItems.filter((workItem) => workItem.project === selectedProjectId);
  }, [selectedProjectId, workItems]);

  const scopedItems = useMemo(() => projectItems, [projectItems]);
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

  if (selectedProject) {
    const items = projectItems;
    const done = items.filter((workItem) => workItem.status === "Done").length;
    const openItems = items.filter((workItem) => workItem.status !== "Done").sort(compareUsefulTasks);
    const open = openItems.length;
    const blockedItems = openItems.filter((workItem) => isBlockedByOpenTask(workItem, workItems));
    const overdueItems = openItems.filter((workItem) => !!workItem.due && compareLocalDateStrings(workItem.due, todayKey) < 0);
    const overdue = overdueItems.length;
    const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    const remainingTasks = openItems.length;
    const allProjectNotes = getLinkedProjectNotes(selectedProject.id, projectNotes);
    const replaceSelectedProjectNotes = (nextNotes: ProjectNotePreview[]) => {
      setProjectNotes((current) => [
        ...nextNotes,
        ...current.filter((note) => note.projectId !== selectedProject.id),
      ]);
    };
    const contextRows = allProjectNotes
      .map((note) => ({
        id: `note-${note.id}`,
        title: note.title,
        type: "Note",
        date: note.updated,
      }))
      .slice(0, 6);
    const nextTask = openItems[0] ?? null;
    const projectHref = `${basePath}/projects/${encodeURIComponent(selectedProject.id)}`;
    const sectionHref = (section: ProjectSection) => section === "overview" ? projectHref : `${projectHref}?section=${section}`;
    const sectionTabs = (Object.keys(PROJECT_SECTION_LABELS) as ProjectSection[]).map((section) => ({
      section,
      label: PROJECT_SECTION_LABELS[section],
      href: sectionHref(section),
    }));
    const sectionLabel = PROJECT_SECTION_CRUMB_LABELS[selectedSection];
    const dueItems = openItems.filter((workItem) => !!workItem.due).sort(compareUsefulTasks);
    const nextDueTask = dueItems.find((workItem) => compareLocalDateStrings(workItem.due, todayKey) >= 0) ?? dueItems[0] ?? null;
    const focusDeckItems = [
      blockedItems[0] && { key: "attention", label: "Attention", detail: "Waiting on another open task", item: blockedItems[0], tone: "warning" as const },
      overdueItems[0] && { key: "overdue", label: "Overdue", detail: formatDueDate(overdueItems[0].due), item: overdueItems[0], tone: "danger" as const },
      nextDueTask && { key: "next-due", label: "Next due", detail: formatDueDate(nextDueTask.due), item: nextDueTask, tone: "neutral" as const },
      nextTask && { key: "next-open", label: "Next open", detail: nextTask.status, item: nextTask, tone: "neutral" as const },
    ].filter((entry, index, entries): entry is { key: string; label: string; detail: string; item: WorkItem; tone: "warning" | "danger" | "neutral" } => {
      if (!entry) return false;
      return entries.findIndex((candidate) => !!candidate && candidate.item.id === entry.item.id) === index;
    });
    const taskGroups = [
      {
        title: "At risk",
        summary: `${blockedItems.length} blocked / ${overdueItems.length} overdue`,
        items: openItems.filter((workItem) => blockedItems.some((blocked) => blocked.id === workItem.id) || overdueItems.some((overdueItem) => overdueItem.id === workItem.id)),
      },
      {
        title: "Active",
        summary: "Dated work in motion",
        items: openItems.filter((workItem) => {
          const groupedAsRisk = blockedItems.some((blocked) => blocked.id === workItem.id) || overdueItems.some((overdueItem) => overdueItem.id === workItem.id);
          return !groupedAsRisk && workItem.status !== "Backlog" && !!workItem.due;
        }),
      },
      {
        title: "Backlog",
        summary: "Ready to shape or schedule",
        items: openItems.filter((workItem) => {
          const groupedAsRisk = blockedItems.some((blocked) => blocked.id === workItem.id) || overdueItems.some((overdueItem) => overdueItem.id === workItem.id);
          return !groupedAsRisk && (workItem.status === "Backlog" || !workItem.due);
        }),
      },
      {
        title: "Completed",
        summary: `${done} done`,
        items: items.filter((workItem) => workItem.status === "Done").sort(compareUsefulTasks),
      },
    ];
    const thisWeekEndKey = localDateKey(addLocalDays(today, 6));
    const nextWeekEndKey = localDateKey(addLocalDays(today, 13));
    const scheduleGroups = [
      {
        title: "Overdue",
        detail: "Before today",
        items: items.filter((workItem) => workItem.status !== "Done" && !!taskDateKey(workItem) && compareLocalDateStrings(taskDateKey(workItem), todayKey) < 0).sort(compareUsefulTasks),
      },
      {
        title: "This week",
        detail: `${formatDueDate(todayKey)} - ${formatDueDate(thisWeekEndKey)}`,
        items: items.filter((workItem) => {
          const dateKey = taskDateKey(workItem);
          return !!dateKey && compareLocalDateStrings(dateKey, todayKey) >= 0 && compareLocalDateStrings(dateKey, thisWeekEndKey) <= 0;
        }).sort(compareUsefulTasks),
      },
      {
        title: "Next week",
        detail: `${formatDueDate(localDateKey(addLocalDays(today, 7)))} - ${formatDueDate(nextWeekEndKey)}`,
        items: items.filter((workItem) => {
          const dateKey = taskDateKey(workItem);
          return !!dateKey && compareLocalDateStrings(dateKey, thisWeekEndKey) > 0 && compareLocalDateStrings(dateKey, nextWeekEndKey) <= 0;
        }).sort(compareUsefulTasks),
      },
      {
        title: "Later",
        detail: "Beyond next week",
        items: items.filter((workItem) => {
          const dateKey = taskDateKey(workItem);
          return !!dateKey && compareLocalDateStrings(dateKey, nextWeekEndKey) > 0;
        }).sort(compareUsefulTasks),
      },
      {
        title: "Unscheduled",
        detail: "Tasks without dates.",
        items: items.filter((workItem) => workItem.status !== "Done" && !taskDateKey(workItem)).sort(compareUsefulTasks),
      },
    ];
    const planningRailItems = scheduleGroups.map((group) => ({
      title: group.title,
      detail: group.detail,
      count: group.items.length,
    }));
    const editProjectButtonClass = isDemoMode ? "lov-btn lov-btn-ghost justify-center text-muted-foreground" : "lov-btn lov-btn-ghost justify-center";
    const deleteProjectButtonClass = isDemoMode ? "lov-btn lov-btn-ghost justify-center text-muted-foreground" : "lov-btn lov-btn-danger justify-center";
    const submitQuickTask = async () => {
      const title = quickTaskTitle.trim();
      if (!title) return;
      await createAndFocusTask(selectedProject.id, "Backlog", title);
      setQuickTaskTitle("");
    };
    return (
      <AppShell title={<TitleCrumbs items={["Projects", selectedProject.name, sectionLabel]} />}>
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
            <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-6">
            {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
            {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading project data...</div>}
            <header className="mb-4 border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card">
                    <ProjectIcon name={selectedProject.icon} accent={selectedProject.accent} size={18} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="break-words text-[18px] font-semibold tracking-tight text-foreground sm:truncate sm:text-[20px]">{selectedProject.name}</h1>
                    <p className="mt-1 max-w-3xl break-words text-[13px] leading-5 text-muted-foreground">
                      {selectedProject.description?.trim() || "No description yet."}
                    </p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={isDemoMode ? undefined : () => { void createAndFocusTask(selectedProject.id); }}
                    disabled={isDemoMode}
                    aria-disabled={isDemoMode}
                    aria-describedby={isDemoMode ? "demo-read-only-notice" : undefined}
                    data-demo-disabled={isDemoMode ? "true" : undefined}
                    title={isDemoMode ? DEMO_MODE_MESSAGE : "New task"}
                    className="lov-btn lov-btn-primary justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" /> New task
                  </button>
                  <button
                    type="button"
                    onClick={isDemoMode ? undefined : () => setEditingProjectId(selectedProject.id)}
                    disabled={isDemoMode}
                    aria-disabled={isDemoMode}
                    aria-describedby={isDemoMode ? "demo-read-only-notice" : undefined}
                    data-demo-disabled={isDemoMode ? "true" : undefined}
                    title={isDemoMode ? DEMO_MODE_MESSAGE : "Edit project"}
                    className={editProjectButtonClass}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={isDemoMode ? undefined : async () => {
                      const deleted = await destroyProject(selectedProject.id);
                      if (!deleted) return;
                      updateSettings({ activeProjectId: null });
                      router.push(`${basePath}/projects`);
                      toast.success("Project deleted");
                    }}
                    disabled={isDemoMode}
                    aria-disabled={isDemoMode}
                    aria-describedby={isDemoMode ? "demo-read-only-notice" : undefined}
                    data-demo-disabled={isDemoMode ? "true" : undefined}
                    title={isDemoMode ? DEMO_MODE_MESSAGE : "Delete project"}
                    className={deleteProjectButtonClass}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button onClick={() => router.push(`${basePath}/projects`)} className="lov-btn lov-btn-ghost justify-center">All projects</button>
                </div>
                {isDemoMode && (
                  <p id="demo-read-only-notice" className="mt-2 text-[11px] text-muted-foreground">
                    {DEMO_MODE_MESSAGE}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                  <Chip tone={selectedProject.status === "Active" ? "accent" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>{selectedProject.status}</Chip>
                  <span className="text-muted-foreground">
                    {selectedProject.due ? `Due ${formatProjectDate(selectedProject.due)}` : "No due date"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><ListTodo className="h-3 w-3" /> {open} open</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> {done} done</span>
                  {overdue > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> {overdue} overdue</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-muted-foreground"><FileText className="h-3 w-3" /> {formatCount(allProjectNotes.length, "note")}</span>
                </div>
                {items.length > 0 && (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
                      <span className="block h-full rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[12px] font-medium tabular-nums text-foreground">{progress}%</span>
                  </div>
                )}
              </div>
            </header>

            <nav className="-mx-4 mb-5 flex flex-nowrap items-center overflow-x-auto whitespace-nowrap border-b border-border px-4 text-[13px] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Project sections">
              {sectionTabs.map((tab) => (
                tab.section === selectedSection ? (
                  <span key={tab.section} className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-foreground px-3 py-2 font-medium text-foreground">{tab.label}</span>
                ) : (
                  <Link key={tab.section} href={tab.href} className="inline-flex items-center gap-1.5 px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1">{tab.label}</Link>
                )
              ))}
            </nav>

            {selectedSection === "overview" && (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                <div className="min-w-0 space-y-4">
                  <div className="rounded-md border border-border/70 bg-card/60 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight"><FileText className="h-4 w-4" />Description</h2>
                      <Link href={sectionHref("notes")} className="rounded text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1">View notes</Link>
                    </div>
                    <p className="text-[13px] leading-6 text-muted-foreground">
                      {selectedProject.description?.trim() || "No description yet. Add the project goal or scope."}
                    </p>
                    <div className="mt-4 border-t border-border/70 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Recent notes</h3>
                        <span className="text-[11px] text-muted-foreground">{formatCount(allProjectNotes.length, "note")}</span>
                      </div>
                      {contextRows.length === 0 ? (
                        <div className="py-1">
                          <p className="text-[13px] font-medium text-foreground">No project notes yet.</p>
                          <p className="mt-1 max-w-md text-[12px] text-muted-foreground">Notes keep decisions and references close to the project.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60 border-y border-border/60">
                          {contextRows.map((row) => (
                            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-[13px]">
                              <span className="min-w-0 truncate font-medium text-foreground">{row.title}</span>
                              <span className="text-[11px] text-muted-foreground">{row.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <form
                    className="flex gap-2 border-y border-border/70 py-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitQuickTask();
                    }}
                  >
                    <input
                      value={quickTaskTitle}
                      onChange={(event) => setQuickTaskTitle(event.target.value)}
                      placeholder="Add a project task..."
                      className="lov-input h-9 min-w-0 flex-1 max-w-none"
                    />
                    <button type="submit" disabled={!quickTaskTitle.trim()} className="lov-btn lov-btn-primary h-9">
                      Add
                    </button>
                  </form>
                </div>
                <aside className="min-w-0 rounded-md border border-border/70 bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[14px] font-semibold tracking-tight">Focus</h2>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatCount(remainingTasks, "remaining task")}</span>
                      <span className="text-border">/</span>
                      <span>{blockedItems.length} blocked</span>
                    </div>
                  </div>
                  {focusDeckItems.length === 0 ? (
                    <div className="border-t border-border/70 py-4">
                      <p className="text-[13px] font-medium text-foreground">No open project work yet.</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">Add the first task to start shaping this project.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {focusDeckItems.map(({ key, label, detail, item, tone }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedTaskId(item.id)}
                          className="flow-row w-full px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
                        >
                          <span className={`block text-[10px] font-semibold uppercase tracking-wider ${tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-muted-foreground"}`}>{label}</span>
                          <span className="mt-1 block truncate text-[13px] font-medium text-foreground">{normalizeTaskRowText(item.title) || "No title"}</span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">{detail}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Link href={sectionHref("tasks")} className="mt-3 inline-flex rounded text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1">View all tasks</Link>
                </aside>
              </section>
            )}
            {selectedSection === "tasks" && (
              <ProjectTasksSection
                title="Project tasks"
                description={`${scopedItems.length} total / ${open} open / ${done} done${overdue > 0 ? ` / ${overdue} overdue` : ""}`}
                emptyDescription="Add the first task."
                taskGroups={taskGroups}
                members={members}
                todayKey={todayKey}
                workItems={workItems}
                onOpen={setSelectedTaskId}
                onToggle={patchTaskStatus}
              />
            )}

            {selectedSection === "notes" && (
              <section className="space-y-4">
                <div className="rounded-md border border-border/70 bg-card/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div className="min-w-0">
                      <h2 className="text-[14px] font-semibold tracking-tight">Project notes</h2>
                      <p className="mt-1 text-[12px] text-muted-foreground">Description and linked notes.</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatCount(allProjectNotes.length, "project note")}</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
                    <div className="min-w-0">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project description</h3>
                      <p className="mt-2 max-w-3xl text-[13px] leading-6 text-foreground/80">
                        {selectedProject.description?.trim() || "No project description yet. Add the goal, scope, or decisions this project should preserve."}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Linked notes</h3>
                      {contextRows.length === 0 ? (
                        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">Project notes keep decisions, references, and project context near work.</p>
                      ) : (
                        <div className="mt-2 divide-y divide-border/60 border-y border-border/60">
                          {contextRows.slice(0, 3).map((row) => (
                            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-[12px]">
                              <span className="min-w-0 truncate font-medium text-foreground">{row.title}</span>
                              <span className="text-[11px] text-muted-foreground">{row.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <ProjectNotesSection
                  workspaceId={workspaceId}
                  currentUserId={currentUserId}
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  notes={allProjectNotes}
                  onNotesChanged={replaceSelectedProjectNotes}
                />
              </section>
            )}

            {selectedSection === "calendar" && (
              <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
                  <div>
                    <h2 className="text-[14px] font-semibold tracking-tight">Project schedule</h2>
                    <p className="mt-1 text-[12px] text-muted-foreground">Task dates for this project.</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{formatCount(dueItems.length, "scheduled task")}</span>
                </div>
                {dueItems.length === 0 && scheduleGroups[4].items.length === 0 ? (
                  <div className="py-4">
                    <p className="text-[13px] font-medium text-foreground">No scheduled tasks.</p>
                    <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Add due dates to project tasks to build the schedule.</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-border/70 bg-card/50">
                    <div aria-label="Schedule rail" className="grid grid-cols-2 gap-2 border-b border-border/70 px-3 py-2 sm:grid-cols-5">
                      {planningRailItems.map((rail) => {
                        const railTone = rail.title === "Overdue" ? "border-red-500 text-red-700" : rail.title === "Unscheduled" ? "border-dashed border-muted-foreground/40 text-muted-foreground" : "border-foreground/60 text-foreground";
                        return (
                          <div key={rail.title} className={`min-w-0 border-t-2 pt-2 last:col-span-2 sm:last:col-span-1 ${railTone}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{rail.title}</span>
                              <span className="text-[11px] tabular-nums">{rail.count}</span>
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted-foreground">{rail.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                    {scheduleGroups.map((group) => {
                      const laneTone = group.title === "Overdue" ? "border-l-red-500" : group.title === "Unscheduled" ? "border-l-border" : "border-l-transparent";
                      return (
                      <div key={group.title} className={`border-l-2 border-t border-border/60 ${laneTone}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                          <div>
                            <h3 className="text-[12px] font-semibold tracking-tight">{group.title}</h3>
                            <p className="text-[11px] text-muted-foreground">{group.detail}</p>
                          </div>
                          <span className="rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{group.items.length}</span>
                        </div>
                        {group.items.length === 0 ? (
                          <div className="px-3 py-3 text-[12px] text-muted-foreground">Nothing here.</div>
                        ) : (
                          <div className="divide-y divide-border/60">
                            {group.items.map((workItem) => (
                              <ProjectTimelineTask
                                key={workItem.id}
                                item={workItem}
                                members={members}
                                todayKey={todayKey}
                                workItems={workItems}
                                onOpen={setSelectedTaskId}
                                onToggle={patchTaskStatus}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </section>
            )}
            </div>
          </div>
          <TaskDrawer
            readOnly={isDemoMode}
            item={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            membersOverride={members}
            projectsOverride={projects}
            allItems={workItems}
            onItemsReplaced={setWorkItems}
            onSelectItem={setSelectedTaskId}
            onItemPatched={(id, patch) => {
              setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, ...patch } : workItem)));
            }}
            onItemReplaced={(next) => {
              setWorkItems((current) => current.map((workItem) => (workItem.id === next.id ? next : workItem)));
            }}
          />
          {editingProjectId && (
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
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="h-full overflow-y-scroll [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
          {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
          {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading projects...</div>}
          <div className="mb-6 sm:-mx-6 lg:-mx-8">
            <div className="flow-header flex-col items-start gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:pb-0">
              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold tracking-tight">Projects</h1>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Open a project to see its next task, linked notes, and open work.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FlowMetaPill>{projects.length} in your workspace</FlowMetaPill>
                <button
                  onClick={() => {
                    if (isDemoMode) {
                      blockDemoAction();
                      return;
                    }
                    setModalOpen(true);
                  }}
                  className="lov-btn lov-btn-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> New project
                </button>
              </div>
            </div>
          </div>

          {projects.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {projects.map((p) => {
                const m = members.find((member) => member.id === p.owner) ?? members[0];
                const items = workItems.filter((w) => w.project === p.id);
                const done = items.filter((w) => w.status === "Done").length;
                const openItems = items.filter((w) => w.status !== "Done").sort(compareUsefulTasks);
                const nextTask = openItems[0] ?? null;
                const open = openItems.length;
                const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
                const projectDueDate = formatProjectDate(p.due);
                const projectOverdue = !!p.due && p.due < todayKey && p.status !== "Archived";
                const nextTaskOverdue = !!nextTask?.due && compareLocalDateStrings(nextTask.due, todayKey) < 0;
                const linkedNotes = getLinkedProjectNotes(p.id, projectNotes);
                const projectHref = `${basePath}/projects/${encodeURIComponent(p.id)}`;
                return (
                  <Link
                    key={p.id}
                    href={projectHref}
                    onClick={() => updateSettings({ activeProjectId: p.id })}
                    className="sq-card flex h-full flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card">
                        <ProjectIcon name={p.icon} accent={p.accent} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-foreground">{p.name}</span>
                          <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
                        </div>
                        {p.description?.trim() && (
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex-1">
                    {items.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-medium text-foreground">{progress}% complete</span>
                          <span className="text-muted-foreground">{done}/{items.length}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full transition-all" style={{ width: `${progress}%`, background: p.accent }} />
                        </div>
                      </div>
                    )}

                    {nextTask ? (
                      <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2">
                        <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          Next task
                        </div>
                        <div className="truncate text-[13px] font-medium text-foreground">{nextTask.title}</div>
                        <div className={nextTaskOverdue ? "mt-0.5 text-[11px] font-medium text-red-600" : "mt-0.5 text-[11px] text-muted-foreground"}>
                          {nextTask.due ? formatDueDate(nextTask.due) : "No due date"}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2">
                        <div className="text-[12px] text-muted-foreground">No open tasks yet</div>
                      </div>
                    )}

                    </div>

                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span className={projectOverdue ? "font-medium text-red-600" : ""}>
                        {projectDueDate ? `Due ${projectDueDate}` : "No project due date"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {linkedNotes.length} note{linkedNotes.length === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        {open} open
                      </span>
                      {m && (
                        <span className="inline-flex items-center gap-1">
                          <Avatar id={m.id} name={m.name} />
                          <span className="truncate">{m.name}</span>
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
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
            router.push(`${basePath}/projects/${encodeURIComponent(id)}`);
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

export function ProjectsPageContent({ projectId, basePath = "/app" }: { projectId?: string; basePath?: "/app" | "/demo" }) {
  return (
    <Suspense fallback={null}>
      <ProjectsInner projectId={projectId} basePath={basePath} />
    </Suspense>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flow-empty py-12">
      <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-[14px] font-medium text-foreground">No projects yet</p>
      <p className="max-w-md text-[13px] leading-6 text-muted-foreground">
        Create a project when a group of tasks needs its own context, due date, or notes.
      </p>
      <button
        onClick={onCreate}
        className="lov-btn lov-btn-primary mt-1"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}

function ProjectTasksSection({
  title,
  description,
  emptyDescription,
  taskGroups,
  members,
  todayKey,
  workItems,
  onOpen,
  onToggle,
}: {
  title: string;
  description: string;
  emptyDescription: string;
  taskGroups: Array<{ title: string; summary: string; items: WorkItem[] }>;
  members: Array<{ id: string; name: string }>;
  todayKey: string;
  workItems: WorkItem[];
  onOpen: (id: string) => void;
  onToggle: (id: string, status: WorkItem["status"]) => void;
}) {
  const totalItems = taskGroups.reduce((count, group) => count + group.items.length, 0);

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight"><ListTodo className="h-4 w-4" />{title}</h2>
        <span className="text-[12px] text-muted-foreground">{description}</span>
      </div>
      {totalItems === 0 ? (
        <div className="border-t border-border/70 py-4">
          <p className="text-[13px] font-medium text-foreground">No tasks in this project yet.</p>
          <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {taskGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
                <h3 className="font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
                <span className="text-muted-foreground">{group.summary}</span>
              </div>
              {group.items.length === 0 ? (
                <div className="border-t border-border/60 px-1 py-2 text-[12px] text-muted-foreground">No tasks in this bucket.</div>
              ) : (
                <div className="space-y-1.5">
                  {group.items.map((workItem) => (
                    <ProjectTaskRow
                      key={workItem.id}
                      item={workItem}
                      members={members}
                      todayKey={todayKey}
                      workItems={workItems}
                      onOpen={onOpen}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectTimelineTask({
  item,
  members,
  todayKey,
  workItems,
  onOpen,
  onToggle,
}: {
  item: WorkItem;
  members: Array<{ id: string; name: string }>;
  todayKey: string;
  workItems: WorkItem[];
  onOpen: (id: string) => void;
  onToggle: (id: string, status: WorkItem["status"]) => void;
}) {
  const member = members.find((m) => m.id === item.assignee) ?? members[0];
  const completed = item.status === "Done";
  const isOverdue = !completed && !!taskDateKey(item) && compareLocalDateStrings(taskDateKey(item), todayKey) < 0;
  const title = normalizeTaskRowText(item.title) || "No title";
  const dateLabel = taskDateKey(item) ? formatDueDate(taskDateKey(item)) : "Unscheduled";

  return (
    <div className="mx-2 my-1.5 rounded-md border border-zinc-100/80 bg-white px-2.5 py-2 text-[13px] transition-colors hover:bg-zinc-50">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 sm:grid-cols-[5.5rem_auto_minmax(0,1fr)] sm:items-center">
        <span className={`col-span-2 text-[11px] font-medium tabular-nums sm:col-span-1 ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>{dateLabel}</span>
        <TaskCompletionToggle
          checked={completed}
          onToggle={() => {
            onToggle(item.id, completed ? "To Do" : "Done");
          }}
          ariaLabel={`${completed ? "Reopen" : "Complete"} ${title}`}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              title={title}
              className={`min-w-0 truncate rounded text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 ${completed ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              {title}
            </button>
            <span className="shrink-0"><PriorityIndicator priority={item.priority} /></span>
          </div>
          <span className="mt-1 flex max-w-[22rem] shrink-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Chip>{item.status}</Chip>
            {member && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Avatar id={member.id} name={member.name} />
                <span className="max-w-[7rem] truncate">{member.name}</span>
              </span>
            )}
            <DependencyBadge item={item} allItems={workItems} />
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectTaskRow({
  item,
  members,
  todayKey,
  workItems,
  nextTaskId,
  compact = false,
  onOpen,
  onToggle,
}: {
  item: WorkItem;
  members: Array<{ id: string; name: string }>;
  todayKey: string;
  workItems: WorkItem[];
  nextTaskId?: string;
  compact?: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string, status: WorkItem["status"]) => void;
}) {
  const member = members.find((m) => m.id === item.assignee) ?? members[0];
  const completed = item.status === "Done";
  const isOverdue = !completed && !!item.due && compareLocalDateStrings(item.due, todayKey) < 0;
  const title = normalizeTaskRowText(item.title) || "No title";
  const label = normalizeTaskRowText(item.label) || item.status;

  return (
    <FlowRow
      completed={completed}
      interactive
      onClick={() => onOpen(item.id)}
      className={`group grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-2 text-[13px] md:grid-cols-[auto_minmax(0,1fr)_96px_minmax(7rem,9rem)_112px_104px] ${compact ? "py-2" : "py-2.5"}`}
    >
      <TaskCompletionToggle
        checked={completed}
        onToggle={() => {
          onToggle(item.id, completed ? "To Do" : "Done");
        }}
        ariaLabel={`${completed ? "Reopen" : "Complete"} ${title}`}
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(item.id);
        }}
        title={title}
        className={`-mx-1 min-w-0 truncate rounded px-1 py-1 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 ${completed ? "text-muted-foreground line-through" : "text-foreground"}`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {item.parentId && <span className="shrink-0 text-[11px] text-muted-foreground">Sub</span>}
          <span className="truncate">{title}</span>
          {item.id === nextTaskId && <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Next</span>}
          {item.parentId && <Chip>Subtask</Chip>}
          <DependencyBadge item={item} allItems={workItems} />
        </span>
      </button>
      <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground md:contents">
        <FlowMetaPill className="border-transparent bg-transparent md:w-24 md:justify-start">
          <PriorityIndicator priority={item.priority} />
        </FlowMetaPill>
        <span className="inline-flex min-w-0 items-center gap-1 text-foreground/75">
          {member ? (
            <>
              <Avatar id={member.id} name={member.name} />
              <span className="truncate">{member.name}</span>
            </>
          ) : (
            <span className="truncate">Unassigned</span>
          )}
        </span>
        <span className="shrink-0"><Chip>{label}</Chip></span>
        <FlowMetaPill className={`border-transparent bg-transparent md:w-[104px] md:justify-start ${isOverdue ? "font-medium text-red-600" : ""}`}>
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          <span>{isOverdue ? `Overdue ${formatDueDate(item.due)}` : formatDueDate(item.due)}</span>
        </FlowMetaPill>
      </span>
    </FlowRow>
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
  initial?: { name: string; description?: string; status: ProjectStatus; owner: string; due: string; icon?: string };
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onCreate: (input: { name: string; description: string; status: ProjectStatus; owner: string; due: string; icon: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Folder");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "Active");
  const [owner, setOwner] = useState(initial?.owner ?? members[0]?.id ?? "AM");
  const [due, setDue] = useState(initial?.due ?? "");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim(), status, owner, due, icon });
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

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Goal, scope, or useful context."
              rows={3}
              className="min-h-20 w-full resize-none rounded-md border bg-card px-2.5 py-2 text-[13px] outline-none focus:border-ring"
            />
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

            <Field label="Owner">
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
            <DateField
              value={due}
              onChange={setDue}
              className="w-full"
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
