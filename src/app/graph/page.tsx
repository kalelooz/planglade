"use client";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton } from "@/components/lovable/page";
import { useStore } from "@/lib/store";

function Node({ x, y, label, main, small }: { x: string; y: string; label: string; main?: boolean; small?: boolean }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 select-none" style={{ left: x, top: y }}>
      <div className={`flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] shadow-sm ${main ? "border-primary/40 bg-primary/10 font-medium text-primary" : small ? "text-muted-foreground" : ""}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${main ? "bg-primary" : "bg-foreground/40"}`} />
        {label}
      </div>
    </div>
  );
}

export default function GraphPage() {
  const projects = useStore((s) => s.projects);
  const notes = useStore((s) => s.notes);
  const members = useStore((s) => s.members);
  const workItems = useStore((s) => s.workItems);

  return (
    <AppShell
      title={<span className="font-medium">Graph View</span>}
      toolbar={<Toolbar><ToolButton>Tasks</ToolButton><ToolButton>Notes</ToolButton><ToolButton>Projects</ToolButton><span className="ml-auto text-muted-foreground">{workItems.length + notes.length + projects.length + members.length} nodes</span></Toolbar>}
    >
      <div className="flex h-full">
        <aside className="w-56 shrink-0 border-r bg-sidebar/40 p-3 text-[12px]">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filter</div>
          {["Tasks", "Notes", "Projects", "People", "Labels"].map((f, i) => (
            <label key={f} className="flex items-center gap-2 py-1">
              <input type="checkbox" defaultChecked={i < 3} className="h-3 w-3 accent-[var(--color-primary)]" /> {f}
            </label>
          ))}
          <div className="mt-5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Depth</div>
          <input type="range" defaultValue={2} min={1} max={4} className="w-full accent-[var(--color-primary)]" />
        </aside>

        <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:24px_24px]">
          <svg className="absolute inset-0 h-full w-full">
            <g stroke="var(--color-border)" strokeWidth="1">
              <line x1="50%" y1="50%" x2="30%" y2="30%" />
              <line x1="50%" y1="50%" x2="70%" y2="35%" />
              <line x1="50%" y1="50%" x2="35%" y2="70%" />
              <line x1="50%" y1="50%" x2="72%" y2="68%" />
              <line x1="30%" y1="30%" x2="20%" y2="20%" />
              <line x1="70%" y1="35%" x2="82%" y2="22%" />
              <line x1="72%" y1="68%" x2="86%" y2="80%" />
            </g>
          </svg>
          <Node x="50%" y="50%" label={projects[0]?.name ?? "Workspace"} main />
          <Node x="30%" y="30%" label={workItems[0]?.id ?? "FB-1"} />
          <Node x="70%" y="35%" label={projects[1]?.name ?? "Project"} />
          <Node x="35%" y="70%" label={notes[0]?.title ?? "Note"} />
          <Node x="72%" y="68%" label={workItems[1]?.id ?? "FB-2"} />
          <Node x="20%" y="20%" label={members[0]?.name.split(" ")[0] ?? "Member"} small />
          <Node x="82%" y="22%" label="Authentication" small />
          <Node x="86%" y="80%" label={members[1]?.name.split(" ")[0] ?? "Member"} small />
        </div>

        <aside className="w-72 shrink-0 border-l bg-background p-4 text-[12px]">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected</div>
          <h3 className="text-[15px] font-semibold tracking-tight">{projects[0]?.name ?? "Workspace"}</h3>
          <p className="mt-1 text-muted-foreground">{workItems.length} items, {notes.length} notes, {members.length} members</p>
          <div className="mt-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connected projects</p>
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-[var(--color-hover)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />{p.name}</div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connected notes</p>
            {notes.slice(0, 2).map((n) => (
              <div key={n.id} className="rounded px-2 py-1 hover:bg-[var(--color-hover)]">{n.title}</div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">People</p>
            {members.slice(0, 3).map((m) => (
              <div key={m.id} className="rounded px-2 py-1 hover:bg-[var(--color-hover)]">{m.name}</div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
