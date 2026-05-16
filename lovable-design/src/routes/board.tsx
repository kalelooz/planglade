import { createFileRoute } from "@tanstack/react-router";
import { Plus, Filter } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/app/icons";
import { Chip } from "@/components/app/page";
import { workItems, byInitials, type Status } from "@/lib/mock-data";

export const Route = createFileRoute("/board")({
  component: Board,
  head: () => ({ meta: [{ title: "Board — Core Product — FlowBoard" }] }),
});

const cols: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];

function Board() {
  return (
    <AppShell
      title={<span className="font-medium">Core Product · Board</span>}
      tabs={[
        { label: "Overview", to: "/projects" },
        { label: "Work Items", to: "/work-items" },
        { label: "Board", to: "/board", active: true },
        { label: "Calendar", to: "/calendar" },
        { label: "Timeline", to: "/timeline" },
        { label: "Notes", to: "/notes" },
      ]}
      toolbar={<Toolbar><ToolButton><Filter className="h-3 w-3" /> Filter</ToolButton><span className="ml-auto" /><button className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[12px] font-medium text-primary-foreground"><Plus className="h-3 w-3" /> Add</button></Toolbar>}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {cols.map((col) => {
          const items = workItems.filter((w) => w.status === col);
          return (
            <div key={col} className="flex w-72 shrink-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium">
                <StatusIcon s={col} />
                <span>{col}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
                <button className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-hover"><Plus className="h-3 w-3" /></button>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 rounded-md border bg-sidebar/40 p-1.5">
                {items.map((w) => {
                  const m = byInitials(w.assignee);
                  return (
                    <div key={w.id} className="cursor-grab rounded border bg-card px-2.5 py-2 text-[12px] hover:border-foreground/20">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono">{w.id}</span>
                        <PriorityIcon p={w.priority} />
                      </div>
                      <div className="mb-2 text-[13px] font-medium leading-snug">{w.title}</div>
                      <div className="flex items-center justify-between">
                        <Chip>{w.label}</Chip>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">{new Date(w.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          <Avatar id={m.id} name={m.name} size={18} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground">No items</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
