"use client";
import Link from "next/link";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { byInitials } from "@/lib/mock-data";
import { Avatar } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);

  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Projects</h1>
          <span className="text-[12px] text-muted-foreground">{projects.length} in your workspace</span>
        </div>
        <p className="mb-6 text-[13px] text-muted-foreground">Click a project name to jump to its work items.</p>
        <div className="border-t">

      {projects.map((p) => {
        const m = byInitials(p.owner);
        const items = workItems.filter((w) => w.project === p.id);
        const done = items.filter((w) => w.status === "Done").length;
        return (
          <div key={p.id}
            className="grid grid-cols-[88px_minmax(0,1fr)_140px_120px_140px_88px_88px] items-center gap-2 border-b px-2 py-3 text-[13px] hover:bg-[var(--color-hover)]/60">
            <span>
              <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
            </span>
            <Link href={`/work-items?project=${p.id}`} className="flex min-w-0 items-center gap-2 font-medium hover:underline focus:outline-none focus-visible:underline">
              <span className="h-2 w-2 rounded-full" style={{ background: p.accent }} />
              <span className="truncate">{p.name}</span>
            </Link>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Avatar id={m.id} name={m.name} /> {m.name}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                <span className="block h-full" style={{ width: `${p.progress}%`, background: p.accent }} />
              </span>
              <span className="text-[11px] text-muted-foreground">{p.progress}%</span>
            </span>
            <span className="text-muted-foreground">{new Date(p.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            <span className="text-right text-muted-foreground">{items.length}</span>
            <span className="text-right text-muted-foreground">{done}</span>
          </div>
        );
      })}
        </div>
      </div>
    </AppShell>
  );
}
