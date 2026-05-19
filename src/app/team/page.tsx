"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

export default function TeamPage() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const members = useStore((s) => s.members);
  const workItems = useStore((s) => s.workItems);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const projects = useStore((s) => s.projects);
  const updateSettings = useStore((s) => s.updateSettings);
  const scopedProjectId = routeProjectId ?? activeProjectId;
  const activeProject = scopedProjectId ? projects.find((p) => p.id === scopedProjectId) ?? null : null;
  const scopedWorkItems = scopedProjectId ? workItems.filter((w) => w.project === scopedProjectId) : workItems;

  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) {
      updateSettings({ activeProjectId: routeProjectId });
    }
  }, [activeProjectId, routeProjectId, updateSettings]);

  return (
    <AppShell title={<span className="font-medium">{activeProject ? `${activeProject.name} / Team` : "All projects / Team"}</span>}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">Workload reflects scoped open tasks.</p>
          <span className="text-[12px] text-muted-foreground">{members.length} members</span>
        </div>
        <div className="border-t">

      {members.map((m) => {
        const tasks = scopedWorkItems.filter((w) => w.assignee === m.id && w.status !== "Done").length;
        const status = tasks < 3 ? "Light" : tasks < 6 ? "Moderate" : "Heavy";
        const tone = status === "Light" ? "success" : status === "Moderate" ? "accent" : "warning";
        const load = Math.min(100, tasks * 18);
        return (
          <div key={m.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(90px,0.85fr)_minmax(72px,0.65fr)_minmax(110px,1fr)_minmax(48px,0.45fr)] items-center gap-3 border-b px-2 py-3 text-[13px] hover:bg-[var(--color-hover)]/60">
            <span className="flex min-w-0 items-center gap-2.5"><Avatar id={m.id} name={m.name} size={24} /><span className="min-w-0 truncate font-medium">{m.name}</span></span>
            <span className="min-w-0 truncate text-muted-foreground">{m.role}</span>
            <span><Chip tone={tone}>{status} workload</Chip></span>
            <span className="flex items-center gap-2">
              <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
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
