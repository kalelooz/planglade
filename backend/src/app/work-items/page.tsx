"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Plus, Search, LayoutGrid, List } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar } from "@/components/lovable/page";
import { StatusIcon } from "@/components/lovable/icons";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { useStore } from "@/lib/store";
import { getDatePart } from "@/lib/dates";
import type { Status, WorkItem } from "@/lib/mock-data";
import { getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";

const order: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const sortOptions = ["Due", "Priority", "Created"] as const;
type SortOption = (typeof sortOptions)[number];

function priorityRank(priority: string) {
  return priority === "High" ? 0 : priority === "Medium" ? 1 : 2;
}

function WorkItemsInner() {
  const params = useSearchParams();
  const projectFilter = params.get("project");
  const taskFilter = params.get("task");
  const activeProjectSetting = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Array<ReturnType<typeof toUiProject>>>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openCols, setOpenCols] = useState<Record<Status, boolean>>({
    Backlog: true,
    "To Do": true,
    "In Progress": true,
    "In Review": true,
    Done: false,
  });
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const [focusNew, setFocusNew] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("Due");

  const scopedProjectId = projectFilter ?? activeProjectSetting;
  const boardHref = scopedProjectId ? `/board?project=${encodeURIComponent(scopedProjectId)}` : "/board";
  const selectedId = taskFilter ?? manualSelectedId;

  useEffect(() => {
    if (projectFilter && projectFilter !== activeProjectSetting) {
      updateSettings({ activeProjectId: projectFilter });
    }
  }, [activeProjectSetting, projectFilter, updateSettings]);

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
        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name })));

        const [projectsRes, workItemsRes] = await Promise.all([
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load work items");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        setWorkItems(workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id)));
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
  }, []);

  const createAndFocus = async (status?: Status) => {
    if (!workspaceId) return;
    const targetProjectId = scopedProjectId ?? projects[0]?.id ?? null;
    if (!targetProjectId) {
      setError("Create a project first to add tasks.");
      return;
    }

    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        projectId: targetProjectId,
        title: "Untitled task",
        status: toApiWorkStatus(status ?? "Backlog"),
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
    setManualSelectedId(next.id);
    setFocusNew(true);
    toast.success("Task created");
  };

  const patchTaskStatus = async (id: string, nextStatus: Status) => {
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));

    const response = await fetch(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        status: toApiWorkStatus(nextStatus),
        completedAt: nextStatus === "Done" ? new Date().toISOString() : null,
      }),
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to update task");
    }
  };

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setManualSelectedId(null);

    const response = await fetch(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
      headers: { "x-flowboard-user-id": currentUserId ?? "" },
    });
    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to delete task");
    }
  };

  const filtered = useMemo(() => {
    return workItems.filter((w) => {
      if (scopedProjectId && w.project !== scopedProjectId) return false;
      if (query && !w.title.toLowerCase().includes(query.toLowerCase()) && !w.id.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [workItems, scopedProjectId, query]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    if (sort === "Priority") {
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

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Tasks</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{project?.name ?? "All Tasks"}</span>
        </div>
      }
      toolbar={
        <Toolbar>
          <div className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded bg-[var(--color-hover)] px-2 text-[12px] text-foreground">
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </span>
            <Link
              href={boardHref}
              className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Board</span>
            </Link>
          </div>
          <label className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="h-7 rounded border bg-card px-2 text-[12px] text-foreground outline-none focus:border-ring">
              {sortOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span className="ml-auto flex items-center gap-2">
            <div className="flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground focus-within:border-ring">
              <Search className="h-3 w-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-32 bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search tasks..." />
            </div>
            <button
              onClick={() => {
                void createAndFocus();
              }}
              className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[12px] font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3 w-3" /> New task
            </button>
          </span>
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-6">
            {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
            {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading task data...</div>}
            <div className="mb-6 px-1">
              <h1 className="text-[15px] font-semibold tracking-tight">Tasks</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Everything to be done in {project?.name ?? "this workspace"} - bugs, features, ideas, follow-ups. Grouped by status. Click a task title to open details.</p>
            </div>
            {grouped.map(({ status, items }) => (
              <section key={status} className="mb-12 last:mb-0">
                <button
                  onClick={() => setOpenCols((o) => ({ ...o, [status]: !o[status] }))}
                  className="mb-2 flex w-full items-center gap-2 px-1 text-left text-[12px] font-medium hover:text-foreground"
                >
                  {openCols[status] ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <StatusIcon s={status} />
                  <span>{status}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
                </button>
                {openCols[status] && (
                  <div className="border-t">
                    {items.length === 0 ? (
                      <EmptyStatus
                        status={status}
                        onAdd={() => {
                          void createAndFocus(status);
                        }}
                      />
                    ) : (
                      items.map((w) => (
                        <WorkItemRow
                          key={w.id}
                          item={w}
                          selected={selectedId === w.id}
                          membersOverride={members}
                          onClick={() => setManualSelectedId(w.id)}
                          onMove={(nextStatus) => {
                            void patchTaskStatus(w.id, nextStatus);
                          }}
                          onDelete={() => {
                            void handleDelete(w.id);
                          }}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            ))}
            <div className="h-24" />
          </div>
        </div>

        <TaskDrawer
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

function EmptyStatus({ status, onAdd }: { status: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-4 text-[12px] text-muted-foreground">
      <span>No tasks in <span className="font-medium text-foreground/70">{status}</span> yet.</span>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded border border-dashed px-2.5 py-1 text-[12px] text-muted-foreground hover:border-foreground/30 hover:bg-[var(--color-hover)] hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Quick add to {status}
      </button>
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={null}>
      <WorkItemsInner />
    </Suspense>
  );
}
