import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { activity, byInitials } from "@/lib/mock-data";
import { Avatar } from "@/components/app/icons";

export const Route = createFileRoute("/activity")({
  component: ActivityLog,
  head: () => ({ meta: [{ title: "Activity — FlowBoard" }] }),
});

function ActivityLog() {
  return (
    <AppShell
      title={<span className="font-medium">Activity</span>}
      toolbar={
        <Toolbar>
          <ToolButton>All users</ToolButton>
          <ToolButton>All projects</ToolButton>
          <ToolButton>All actions</ToolButton>
          <span className="ml-auto flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground">
            <Search className="h-3 w-3" /><input className="w-40 bg-transparent outline-none" placeholder="Search activity…" />
          </span>
        </Toolbar>
      }
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        {activity.map((d) => (
          <section key={d.date} className="mb-8">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d.date}</div>
            <div className="border-y">
              {d.items.map((it, i) => {
                const m = byInitials(it.who);
                return (
                  <div key={i} className="grid grid-cols-[20px_1fr_60px] items-center gap-3 border-b py-2.5 text-[13px] last:border-0">
                    <Avatar id={m.id} name={m.name} />
                    <span className="text-foreground/90">
                      <span className="font-medium">{m.name}</span> <span className="text-muted-foreground">{it.action}</span>{" "}
                      <span>{it.target}</span>
                      {"to" in it && it.to && <> <span className="text-muted-foreground">→</span> <span>{it.to}</span></>}
                    </span>
                    <span className="text-right font-mono text-[11px] text-muted-foreground">{it.time}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
