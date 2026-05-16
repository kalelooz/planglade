import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { members, workItems } from "@/lib/mock-data";
import { Avatar } from "@/components/app/icons";
import { Chip } from "@/components/app/page";

export const Route = createFileRoute("/team")({
  component: Team,
  head: () => ({ meta: [{ title: "Team — FlowBoard" }] }),
});

function Team() {
  return (
    <AppShell title={<span className="font-medium">Team</span>}>
      <div className="border-b px-6 py-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Team</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{members.length} members in Acme Inc.</p>
      </div>

      <div className="grid grid-cols-[1fr_140px_120px_180px_88px] border-b bg-sidebar/50 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Member</span><span>Role</span><span>Status</span><span>Workload</span><span className="text-right">Tasks</span>
      </div>

      {members.map((m, i) => {
        const tasks = workItems.filter((w) => w.assignee === m.id).length;
        const status = i % 3 === 0 ? "Available" : i % 3 === 1 ? "Focus" : "Away";
        const tone = status === "Available" ? "success" : status === "Focus" ? "accent" : "neutral";
        const load = Math.min(100, tasks * 18);
        return (
          <div key={m.id} className="grid grid-cols-[1fr_140px_120px_180px_88px] items-center gap-3 border-b px-6 py-3 text-[13px] hover:bg-hover/60">
            <span className="flex items-center gap-2.5"><Avatar id={m.id} name={m.name} size={24} /><span className="font-medium">{m.name}</span></span>
            <span className="text-muted-foreground">{m.role}</span>
            <span><Chip tone={tone}>{status}</Chip></span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-28 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-primary" style={{ width: `${load}%` }} />
              </span>
              <span className="text-[11px] text-muted-foreground">{load}%</span>
            </span>
            <span className="text-right text-muted-foreground">{tasks}</span>
          </div>
        );
      })}
    </AppShell>
  );
}
