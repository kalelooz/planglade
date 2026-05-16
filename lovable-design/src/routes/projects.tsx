import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { projects, byInitials } from "@/lib/mock-data";
import { Avatar } from "@/components/app/icons";
import { Chip } from "@/components/app/page";

export const Route = createFileRoute("/projects")({
  component: Projects,
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) ?? undefined }),
  head: () => ({ meta: [{ title: "Projects — FlowBoard" }] }),
});

function Projects() {
  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="border-b px-6 py-5">
        <h1 className="text-[19px] font-semibold tracking-tight">Projects</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{projects.length} projects in Acme Inc.</p>
      </div>

      <div className="grid grid-cols-[88px_1fr_140px_120px_140px_88px_88px] border-b px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Status</span>
        <span>Name</span>
        <span>Owner</span>
        <span>Progress</span>
        <span>Due</span>
        <span className="text-right">Items</span>
        <span className="text-right">Done</span>
      </div>

      {projects.map((p) => {
        const m = byInitials(p.owner);
        return (
          <Link key={p.id} to="/work-items"
            className="grid grid-cols-[88px_1fr_140px_120px_140px_88px_88px] items-center gap-2 border-b px-6 py-3 text-[13px] hover:bg-hover/60">
            <span>
              <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full" style={{ background: p.accent }} />
              {p.name}
            </span>
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
            <span className="text-right text-muted-foreground">{12 + (p.id.length * 3)}</span>
            <span className="text-right text-muted-foreground">{Math.round(p.progress / 8)}</span>
          </Link>
        );
      })}
    </AppShell>
  );
}
