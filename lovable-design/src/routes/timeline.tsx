import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { projects, workItems, byInitials } from "@/lib/mock-data";
import { Avatar } from "@/components/app/icons";

export const Route = createFileRoute("/timeline")({
  component: Timeline,
  head: () => ({ meta: [{ title: "Timeline — FlowBoard" }] }),
});

const weeks = ["W18", "W19", "W20", "W21", "W22", "W23", "W24", "W25", "W26", "W27", "W28", "W29"];

function Timeline() {
  return (
    <AppShell
      title={<span className="font-medium">Timeline</span>}
      toolbar={
        <Toolbar>
          <ToolButton>Filter</ToolButton>
          <ToolButton>Group: Project</ToolButton>
          <span className="ml-auto" />
          <div className="flex items-center gap-px rounded border p-0.5">
            <button className="rounded-sm px-2 py-0.5 text-[11px] text-muted-foreground">Week</button>
            <button className="rounded-sm bg-hover px-2 py-0.5 text-[11px]">Month</button>
            <button className="rounded-sm px-2 py-0.5 text-[11px] text-muted-foreground">Quarter</button>
          </div>
        </Toolbar>
      }
    >
      <div className="overflow-auto">
        <div className="min-w-[1000px]">
          <div className="sticky top-0 z-10 grid grid-cols-[240px_repeat(12,minmax(60px,1fr))] border-b bg-background text-[11px]">
            <div className="border-r px-3 py-2 font-medium text-muted-foreground">Project / Item</div>
            {weeks.map((w, i) => (
              <div key={w} className={`border-r px-2 py-2 text-center ${i === 2 ? "bg-primary/5 text-primary" : "text-muted-foreground"}`}>{w}</div>
            ))}
          </div>

          {projects.map((p) => (
            <div key={p.id}>
              <div className="grid grid-cols-[240px_repeat(12,minmax(60px,1fr))] border-b bg-sidebar/60">
                <div className="flex items-center gap-2 border-r px-3 py-1.5 text-[12px] font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.accent }} />
                  {p.name}
                </div>
                <div className="col-span-12 relative">
                  <div className="absolute left-[8%] right-[20%] top-1/2 h-1.5 -translate-y-1/2 rounded-sm" style={{ background: `color-mix(in oklch, ${p.accent} 30%, transparent)` }} />
                </div>
              </div>

              {workItems.filter((w) => w.project === p.id).slice(0, 3).map((w, i) => {
                const m = byInitials(w.assignee);
                const start = 10 + i * 6;
                const len = 20 + i * 8;
                return (
                  <div key={w.id} className="grid grid-cols-[240px_repeat(12,minmax(60px,1fr))] border-b hover:bg-hover/40">
                    <div className="flex items-center gap-2 border-r px-3 py-1.5 text-[12px]">
                      <Avatar id={m.id} name={m.name} size={16} />
                      <span className="truncate text-muted-foreground">{w.title}</span>
                    </div>
                    <div className="col-span-12 relative h-7">
                      <div className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm border text-[10px] text-foreground/80"
                        style={{ left: `${start}%`, width: `${len}%`, background: `color-mix(in oklch, ${p.accent} 14%, var(--card))`, borderColor: `color-mix(in oklch, ${p.accent} 35%, transparent)` }}>
                        <span className="block truncate px-1.5 leading-4">{w.id}</span>
                      </div>
                      <div className="absolute inset-y-0 left-[18%] w-px bg-primary/40" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="border-b bg-sidebar/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unscheduled</div>
          {workItems.slice(0, 2).map((w) => (
            <div key={`u-${w.id}`} className="grid grid-cols-[240px_repeat(12,minmax(60px,1fr))] border-b">
              <div className="border-r px-3 py-1.5 text-[12px] text-muted-foreground">{w.title}</div>
              <div className="col-span-12 h-7" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
