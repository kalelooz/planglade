import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { projects, members, workItems, byInitials } from "@/lib/mock-data";
import { Chip } from "@/components/app/page";
import { Avatar, PriorityIcon } from "@/components/app/icons";

export const Route = createFileRoute("/report")({
  component: Report,
  head: () => ({ meta: [{ title: "Project Report — FlowBoard" }] }),
});

const statusBreakdown = [
  { s: "Backlog", n: 8, color: "oklch(0.85 0.01 286)" },
  { s: "To Do", n: 5, color: "oklch(0.7 0.02 286)" },
  { s: "In Progress", n: 2, color: "oklch(0.52 0.09 195)" },
  { s: "In Review", n: 1, color: "oklch(0.72 0.16 70)" },
  { s: "Done", n: 1, color: "oklch(0.55 0.13 145)" },
];

function Report() {
  const total = statusBreakdown.reduce((s, x) => s + x.n, 0);
  return (
    <AppShell title={<span className="font-medium">Project Report</span>}>
      <div className="border-b px-6 py-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Core Product — Status Report</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Week of May 11 – May 17, 2026 · Auto-generated from real work</p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <section>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</h2>
          <dl className="grid grid-cols-2 gap-y-2 border-y py-3 text-[13px] md:grid-cols-4">
            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5"><Chip tone="accent">On track</Chip></dd></div>
            <div><dt className="text-muted-foreground">Progress</dt><dd className="mt-0.5 font-medium">62%</dd></div>
            <div><dt className="text-muted-foreground">Open items</dt><dd className="mt-0.5 font-medium">{total}</dd></div>
            <div><dt className="text-muted-foreground">Due</dt><dd className="mt-0.5 font-medium">Jun 22, 2026</dd></div>
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Task status breakdown</h2>
          <div className="flex h-2 overflow-hidden rounded-full border">
            {statusBreakdown.map((s) => (
              <div key={s.s} className="h-full" style={{ width: `${(s.n / total) * 100}%`, background: s.color }} title={s.s} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-y-1 text-[12px] sm:grid-cols-5">
            {statusBreakdown.map((s) => (
              <div key={s.s} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.s}</span>
                <span className="ml-auto sm:ml-1 font-medium">{s.n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming deadlines</h2>
          <div className="border-y">
            {workItems.slice(0, 5).map((w) => {
              const m = byInitials(w.assignee);
              return (
                <div key={w.id} className="grid grid-cols-[72px_1fr_120px_100px] items-center gap-3 border-b py-2 text-[13px] last:border-0">
                  <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                  <span className="truncate">{w.title}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Avatar id={m.id} /> {m.name}</span>
                  <span className="text-right text-muted-foreground">{new Date(w.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Blockers</h2>
          <div className="border-y">
            {workItems.filter((w) => w.priority === "High").slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center gap-3 border-b py-2 text-[13px] last:border-0">
                <PriorityIcon p={w.priority} />
                <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                <span className="flex-1 truncate">{w.title}</span>
                <Chip tone="danger">Blocked</Chip>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Workload by assignee</h2>
          <div className="space-y-2">
            {members.map((m) => {
              const n = workItems.filter((w) => w.assignee === m.id).length;
              const pct = (n / 8) * 100;
              return (
                <div key={m.id} className="grid grid-cols-[160px_1fr_40px] items-center gap-3 text-[13px]">
                  <span className="flex items-center gap-2"><Avatar id={m.id} name={m.name} /> {m.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                  <span className="text-right text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Projects</h2>
          <div className="border-y">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b py-2 text-[13px] last:border-0">
                <span className="h-2 w-2 rounded-full" style={{ background: p.accent }} />
                <span className="flex-1">{p.name}</span>
                <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
                <span className="w-12 text-right text-muted-foreground">{p.progress}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
