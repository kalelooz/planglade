"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar } from "@/components/lovable/page";
import { StatusIcon } from "@/components/lovable/icons";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { getDatePart } from "@/lib/dates";
import type { Status } from "@/lib/mock-data";

const order: Status[] = ["In Progress", "To Do", "In Review", "Backlog", "Done"];
const sortOptions = ["Due", "Priority", "Created"] as const;
type SortOption = (typeof sortOptions)[number];

function priorityRank(priority: string) {
  return priority === "High" ? 0 : priority === "Medium" ? 1 : 2;
}

function WorkItemsInner() {
  const params = useSearchParams();
  const projectFilter = params.get("project");
  const taskFilter = params.get("task");
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const activeProjectSetting = useStore((s) => s.settings.activeProjectId);
  const addWorkItem = useStore((s) => s.addWorkItem);
  const setWorkItemStatus = useStore((s) => s.setWorkItemStatus);
  const deleteWorkItem = useStore((s) => s.deleteWorkItem);
  const updateSettings = useStore((s) => s.updateSettings);

  const [openCols, setOpenCols] = useState<Record<Status, boolean>>({
    "In Progress": true, "To Do": true, "In Review": true, "Backlog": true, "Done": false,
  });
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const [focusNew, setFocusNew] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("Due");

  const scopedProjectId = projectFilter ?? activeProjectSetting;
  const selectedId = taskFilter ?? manualSelectedId;

  useEffect(() => {
    if (projectFilter && projectFilter !== activeProjectSetting) {
      updateSettings({ activeProjectId: projectFilter });
    }
  }, [activeProjectSetting, projectFilter, updateSettings]);

  const createAndFocus = (status?: Status) => {
    const id = addWorkItem({
      title: "Untitled task",
      status: status ?? "Backlog",
      project: scopedProjectId ?? "core",
    });
    setManualSelectedId(id);
    setFocusNew(true);
    toast.success("Task created - fill in the details", { description: `${id} - click to edit` });
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

  const handleDelete = (id: string) => {
    deleteWorkItem(id);
    if (selectedId === id) setManualSelectedId(null);
  };

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
              onClick={() => createAndFocus()}
              className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[12px] font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3 w-3" /> New task
            </button>
          </span>
        </Toolbar>
      }
    >
      <div className="mx-auto flex h-full w-full max-w-6xl">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6">
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
                    <EmptyStatus status={status} onAdd={() => createAndFocus(status)} />
                  ) : (
                    items.map((w) => (
                      <WorkItemRow
                        key={w.id}
                        item={w}
                        selected={selectedId === w.id}
                        onClick={() => setManualSelectedId(w.id)}
                        onMove={(nextStatus) => setWorkItemStatus(w.id, nextStatus)}
                        onDelete={() => handleDelete(w.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          ))}
          <div className="h-24" />
        </div>

        <TaskDrawer
          item={selected}
          focusTitle={focusNew}
          onTitleFocused={() => setFocusNew(false)}
          onClose={() => { setManualSelectedId(null); setFocusNew(false); }}
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
