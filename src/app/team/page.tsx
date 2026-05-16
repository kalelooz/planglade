"use client";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

export default function TeamPage() {
  const members = useStore((s) => s.members);
  const workItems = useStore((s) => s.workItems);

  return (
    <AppShell title={<span className="font-medium">Team</span>}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Team</h1>
          <span className="text-[12px] text-muted-foreground">{members.length} members</span>
        </div>
        <p className="mb-6 text-[13px] text-muted-foreground">Workload reflects open work items.</p>
        <div className="border-t">

      {members.map((m, i) => {
        const tasks = workItems.filter((w) => w.assignee === m.id && w.status !== "Done").length;
        const status = i % 3 === 0 ? "Available" : i % 3 === 1 ? "Focus" : "Away";
        const tone = status === "Available" ? "success" : status === "Focus" ? "accent" : "neutral";
        const load = Math.min(100, tasks * 18);
        return (
          <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_140px_120px_180px_88px] items-center gap-3 border-b px-2 py-3 text-[13px] hover:bg-[var(--color-hover)]/60">
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
        </div>
      </div>
    </AppShell>
  );
}
