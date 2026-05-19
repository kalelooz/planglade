"use client";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { type Status } from "@/lib/mock-data";
import { Chip } from "@/components/lovable/page";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { compareLocalDateStrings, formatDueLabel } from "@/lib/dates";

const statusColors: Record<Status, string> = {
  "Backlog": "oklch(0.85 0.01 286)",
  "To Do": "oklch(0.7 0.02 286)",
  "In Progress": "oklch(0.52 0.09 195)",
  "In Review": "oklch(0.72 0.16 70)",
  "Done": "oklch(0.55 0.13 145)",
};

export default function ReportPage() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const members = useStore((s) => s.members);
  const updateSettings = useStore((s) => s.updateSettings);
  const scopedProjectId = routeProjectId ?? activeProjectId;
  const activeProject = scopedProjectId ? projects.find((p) => p.id === scopedProjectId) ?? null : null;
  const scopedWorkItems = useMemo(
    () => scopedProjectId ? workItems.filter((w) => w.project === scopedProjectId) : workItems,
    [scopedProjectId, workItems]
  );
  const scopedProjects = useMemo(
    () => scopedProjectId ? projects.filter((p) => p.id === scopedProjectId) : projects,
    [scopedProjectId, projects]
  );

  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) {
      updateSettings({ activeProjectId: routeProjectId });
    }
  }, [activeProjectId, routeProjectId, updateSettings]);

  const breakdown = useMemo(() => {
    const counts: Record<Status, number> = { "Backlog": 0, "To Do": 0, "In Progress": 0, "In Review": 0, "Done": 0 };
    for (const w of scopedWorkItems) counts[w.status]++;
    return (Object.keys(counts) as Status[]).map((s) => ({ s, n: counts[s], color: statusColors[s] }));
  }, [scopedWorkItems]);

  const total = breakdown.reduce((a, x) => a + x.n, 0);
  const done = breakdown.find((b) => b.s === "Done")?.n ?? 0;
  const open = total - done;
  const overdue = scopedWorkItems.filter((w) => w.status !== "Done" && compareLocalDateStrings(w.due, new Date().toISOString().slice(0, 10)) < 0).length;
  const statusLabel = total === 0 ? "No tasks" : overdue > 0 ? "Needs attention" : open === 0 ? "Complete" : "On track";
  const statusTone = overdue > 0 ? "warning" : total === 0 || open === 0 ? "neutral" : "accent";

  return (
    <AppShell title={<span className="font-medium">Project Report</span>}>
      <div className="border-b px-6 py-5">
        <h1 className="text-[19px] font-semibold tracking-tight">{activeProject ? `${activeProject.name} status report` : "Workspace status report"}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Auto-generated from scoped work items.</p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <section>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</h2>
          <dl className="grid grid-cols-2 gap-y-2 border-y py-3 text-[13px] md:grid-cols-4">
            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5"><Chip tone={statusTone}>{statusLabel}</Chip></dd></div>
            <div><dt className="text-muted-foreground">Open items</dt><dd className="mt-0.5 font-medium">{open}</dd></div>
            <div><dt className="text-muted-foreground">Done</dt><dd className="mt-0.5 font-medium">{done}</dd></div>
            <div><dt className="text-muted-foreground">Projects</dt><dd className="mt-0.5 font-medium">{scopedProjects.length}</dd></div>
          </dl>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Task status breakdown</h2>
            <div className="h-56 rounded-md border bg-card p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="n" nameKey="s" innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {breakdown.map((s) => <Cell key={s.s} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1 text-[12px] sm:grid-cols-3">
              {breakdown.map((s) => (
                <div key={s.s} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.s}</span>
                  <span className="ml-auto sm:ml-1 font-medium">{s.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Workload by assignee</h2>
            <div className="h-56 rounded-md border bg-card p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={members.map((m) => ({ name: m.name.split(" ")[0], open: scopedWorkItems.filter((w) => w.assignee === m.id && w.status !== "Done").length, done: scopedWorkItems.filter((w) => w.assignee === m.id && w.status === "Done").length }))} margin={{ left: -20, right: 12, top: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="open" stackId="a" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="done" stackId="a" fill="var(--color-muted-foreground)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Upcoming deadlines</h2>
          <div className="border-y">
            {scopedWorkItems.filter((w) => w.status !== "Done").slice(0, 6).map((w) => {
              const m = members.find((member) => member.id === w.assignee) ?? members[0];
              return (
                <div key={w.id} className="grid grid-cols-[72px_minmax(0,1fr)_120px_100px] items-center gap-3 border-b py-2 text-[13px] last:border-0">
                  <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                  <span className="truncate">{w.title}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Avatar id={m.id} /> {m.name}</span>
                  <span className="text-right text-muted-foreground">{formatDueLabel(w.due)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">High priority</h2>
          <div className="border-y">
            {scopedWorkItems.filter((w) => w.priority === "High" && w.status !== "Done").slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center gap-3 border-b py-2 text-[13px] last:border-0">
                <PriorityIcon p={w.priority} />
                <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                <span className="flex-1 truncate">{w.title}</span>
                <Chip tone="danger">High priority</Chip>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Projects</h2>
          <div className="border-y">
            {scopedProjects.map((p) => (
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
