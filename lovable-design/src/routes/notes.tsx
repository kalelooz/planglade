import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Hash, Link2 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { notes } from "@/lib/mock-data";
import { Chip } from "@/components/app/page";

export const Route = createFileRoute("/notes")({
  component: Notes,
  head: () => ({ meta: [{ title: "Notes — FlowBoard" }] }),
});

function Notes() {
  const [sel, setSel] = useState(notes[0]);
  return (
    <AppShell title={<span className="font-medium">Notes</span>}>
      <div className="flex h-full">
        <aside className="flex w-80 shrink-0 flex-col border-r bg-sidebar/40">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" placeholder="Search notes…" />
            <button className="rounded p-1 hover:bg-hover"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="border-b p-2">
            <input placeholder="Quick capture a note…" className="h-8 w-full rounded border bg-background px-2 text-[13px] outline-none focus:border-ring" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes.map((n) => (
              <button key={n.id} onClick={() => setSel(n)}
                className={`block w-full border-b px-3 py-3 text-left hover:bg-hover/60 ${sel.id === n.id ? "bg-hover" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-medium">{n.title}</span>
                  <span className="text-[11px] text-muted-foreground">{n.updated}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{n.excerpt}</p>
                <div className="mt-1.5"><Chip>{n.tag}</Chip></div>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 items-center gap-3 border-b px-5 text-[12px] text-muted-foreground">
            <Hash className="h-3 w-3" /> {sel.tag}
            <span className="h-3 w-px bg-border" />
            <Link2 className="h-3 w-3" /> 2 linked tasks
            <span className="ml-auto">Edited {sel.updated}</span>
          </div>
          <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-10">
            <h1 className="text-[24px] font-semibold tracking-tight">{sel.title}</h1>
            <p className="mt-4 text-[14px] leading-relaxed text-foreground/90">{sel.excerpt}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-foreground/90">
              Focus areas this quarter: reduce surface area, ship the planning view, and make capture invisible. Anything else is noise — defer.
            </p>
            <h2 className="mt-8 text-[16px] font-semibold tracking-tight">Decisions</h2>
            <ul className="mt-2 space-y-1.5 text-[14px]">
              <li>· Cut the analytics dashboard from M1.</li>
              <li>· Keep board secondary to list view.</li>
              <li>· Inbox is the only place new captures land.</li>
            </ul>
            <h2 className="mt-8 text-[16px] font-semibold tracking-tight">Linked tasks</h2>
            <div className="mt-2 space-y-1">
              <div className="rounded border px-3 py-2 text-[13px] hover:bg-hover/60">FB-65 · UX/UI for Figma integration</div>
              <div className="rounded border px-3 py-2 text-[13px] hover:bg-hover/60">FB-90 · Redesign create work item modal</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
