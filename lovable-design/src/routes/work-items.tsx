import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, ChevronDown, Filter, ArrowUpDown, SlidersHorizontal, Plus, Search, LayoutList, LayoutGrid, Calendar, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { StatusIcon } from "@/components/app/icons";
import { WorkItemRow } from "@/components/app/work-item-row";
import { TaskDrawer } from "@/components/app/task-drawer";
import { workItems, type Status, type WorkItem } from "@/lib/mock-data";

export const Route = createFileRoute("/work-items")({
  component: WorkItemsPage,
  head: () => ({ meta: [{ title: "Work Items — Core Product — FlowBoard" }] }),
});

const order: Status[] = ["In Progress", "To Do", "In Review", "Backlog", "Done"];

function WorkItemsPage() {
  const [open, setOpen] = useState<Record<Status, boolean>>({
    "In Progress": true, "To Do": true, "In Review": true, "Backlog": true, "Done": false,
  });
  const [sel, setSel] = useState<WorkItem | null>(workItems.find((w) => w.id === "FB-65") ?? null);

  const grouped = order.map((s) => ({ status: s, items: workItems.filter((w) => w.status === s) }));

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Projects</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">Core Product</span>
        </div>
      }
      tabs={[
        { label: "Overview", to: "/projects" },
        { label: "Work Items", to: "/work-items", active: true },
        { label: "Board", to: "/board" },
        { label: "Calendar", to: "/calendar" },
        { label: "Timeline", to: "/timeline" },
        { label: "Notes", to: "/notes" },
        { label: "Activity", to: "/activity" },
      ]}
      toolbar={
        <Toolbar>
          <div className="flex items-center gap-px rounded border p-0.5">
            <button className="flex h-5 items-center gap-1 rounded-sm bg-hover px-1.5 text-[12px]"><LayoutList className="h-3 w-3" /> List</button>
            <button className="flex h-5 items-center gap-1 rounded-sm px-1.5 text-[12px] text-muted-foreground hover:text-foreground"><LayoutGrid className="h-3 w-3" /> Board</button>
          </div>
          <span className="h-3 w-px bg-border" />
          <ToolButton><Filter className="h-3 w-3" /> Filter</ToolButton>
          <ToolButton><ArrowUpDown className="h-3 w-3" /> Sort</ToolButton>
          <ToolButton><SlidersHorizontal className="h-3 w-3" /> Display</ToolButton>
          <span className="ml-auto flex items-center gap-2">
            <div className="flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground">
              <Search className="h-3 w-3" /> <input className="w-32 bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search items…" />
            </div>
            <button className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[12px] font-medium text-primary-foreground hover:opacity-90">
              <Plus className="h-3 w-3" /> Add work item
            </button>
          </span>
        </Toolbar>
      }
    >
      <div className="flex h-full">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[28px_72px_1fr_88px_140px_120px_72px_28px] gap-2 border-b bg-background/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span></span><span>ID</span><span>Title</span><span>Priority</span><span>Assignee</span><span>Label</span><span>Due</span><span></span>
          </div>

          {grouped.map(({ status, items }) => (
            <div key={status}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [status]: !o[status] }))}
                className="flex w-full items-center gap-2 border-b bg-sidebar/60 px-4 py-1.5 text-left text-[12px] font-medium hover:bg-sidebar"
              >
                {open[status] ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <StatusIcon s={status} />
                <span>{status}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
                <span className="ml-auto opacity-0 hover:opacity-100">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </span>
              </button>
              {open[status] && items.map((w) => (
                <WorkItemRow key={w.id} item={w} selected={sel?.id === w.id} onClick={() => setSel(w)} />
              ))}
            </div>
          ))}

          <div className="h-32" />
        </div>

        <TaskDrawer item={sel} onClose={() => setSel(null)} />
      </div>
    </AppShell>
  );
}
