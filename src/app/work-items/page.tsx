"use client";
import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Filter, ArrowUpDown, SlidersHorizontal, Plus, Search, LayoutList, LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar } from "@/components/lovable/page";
import { StatusIcon } from "@/components/lovable/icons";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/mock-data";

const order: Status[] = ["In Progress", "To Do", "In Review", "Backlog", "Done"];

function WorkItemsInner() {
  const params = useSearchParams();
  const projectFilter = params.get("project");
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const addWorkItem = useStore((s) => s.addWorkItem);

  const [openCols, setOpenCols] = useState<Record<Status, boolean>>({
    "In Progress": true, "To Do": true, "In Review": true, "Backlog": true, "Done": false,
  });
  const [selectedId, setSelectedId] = useState<string | null>("FB-65");
  const [focusNew, setFocusNew] = useState(false);
  const [query, setQuery] = useState("");

  const createAndFocus = (status?: Status) => {
    const id = addWorkItem({
      title: "Untitled task",
      status: status ?? "Backlog",
      project: projectFilter ?? "core",
    });
    setSelectedId(id);
    setFocusNew(true);
    toast.success("Task created — fill in the details", { description: `${id} · click to edit` });
  };

  const filtered = useMemo(() => {
    return workItems.filter((w) => {
      if (projectFilter && w.project !== projectFilter) return false;
      if (query && !w.title.toLowerCase().includes(query.toLowerCase()) && !w.id.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [workItems, projectFilter, query]);

  const grouped = order.map((s) => ({ status: s, items: filtered.filter((w) => w.status === s) }));
  const project = projects.find((p) => p.id === projectFilter);
  const selected = selectedId ? workItems.find((w) => w.id === selectedId) ?? null : null;

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Projects</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{project?.name ?? "All work"}</span>
        </div>
      }
      tabs={[
        { label: "Overview", to: "/projects" },
        { label: "Tasks", to: "/work-items", active: true },
        { label: "Board", to: "/board" },
        { label: "Calendar", to: "/calendar" },
        { label: "Timeline", to: "/timeline" },
        { label: "Notes", to: "/notes" },
        { label: "Activity", to: "/activity" },
      ]}
      toolbar={
        <Toolbar>
          <div className="flex items-center gap-px rounded border p-0.5">
            <button aria-current="page" className="flex h-5 items-center gap-1 rounded-sm bg-[var(--color-hover)] px-1.5 text-[12px]"><LayoutList className="h-3 w-3" /> List</button>
            <Link href="/board" className="flex h-5 items-center gap-1 rounded-sm px-1.5 text-[12px] text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"><LayoutGrid className="h-3 w-3" /> Board</Link>
          </div>
          <span className="h-3 w-px bg-border" />
          <button disabled title="Coming soon" className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground/40 cursor-not-allowed"><Filter className="h-3 w-3" /> Filter</button>
          <button disabled title="Coming soon" className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground/40 cursor-not-allowed"><ArrowUpDown className="h-3 w-3" /> Sort</button>
          <button disabled title="Coming soon" className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground/40 cursor-not-allowed"><SlidersHorizontal className="h-3 w-3" /> Display</button>
          <span className="ml-auto flex items-center gap-2">
            <div className="flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground focus-within:border-ring">
              <Search className="h-3 w-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-32 bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search items…" />
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
                      <WorkItemRow key={w.id} item={w} selected={selectedId === w.id} onClick={() => setSelectedId(w.id)} />
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
          onClose={() => { setSelectedId(null); setFocusNew(false); }}
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
