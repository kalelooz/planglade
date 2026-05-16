"use client";
import { useState } from "react";
import { Archive, Trash2, FolderPlus, Calendar, Flag, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton } from "@/components/lovable/page";
import { useStore } from "@/lib/store";
import type { Priority } from "@/lib/mock-data";

export default function InboxPage() {
  const inboxItems = useStore((s) => s.inboxItems);
  const projects = useStore((s) => s.projects);
  const removeInboxItem = useStore((s) => s.removeInboxItem);
  const inboxToWorkItem = useStore((s) => s.inboxToWorkItem);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkArchive = () => {
    const n = selected.size;
    selected.forEach((id) => inboxToWorkItem(id));
    setSelected(new Set());
    toast.success(`Promoted ${n} item${n === 1 ? "" : "s"} to tasks`);
  };
  const bulkDelete = () => {
    const n = selected.size;
    selected.forEach((id) => removeInboxItem(id));
    setSelected(new Set());
    toast(`Deleted ${n} inbox item${n === 1 ? "" : "s"}`);
  };

  return (
    <AppShell
      title={
        <div className="flex items-baseline gap-2">
          <span className="font-medium">Inbox</span>
          <span className="text-[12px] text-muted-foreground">quick captures · sort later</span>
        </div>
      }
      toolbar={
        <Toolbar>
          <span className="text-muted-foreground">{inboxItems.length} unsorted{selected.size > 0 ? ` · ${selected.size} selected` : ""}</span>
          <span className="h-3 w-px bg-border" />
          <ToolButton><FolderPlus className="h-3 w-3" /> Assign project</ToolButton>
          <ToolButton><Calendar className="h-3 w-3" /> Due date</ToolButton>
          <ToolButton><Flag className="h-3 w-3" /> Priority</ToolButton>
          <span className="ml-auto" />
          <button onClick={bulkArchive} disabled={selected.size === 0} className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent">
            <Archive className="h-3 w-3" /> Promote to task
          </button>
          <button onClick={bulkDelete} disabled={selected.size === 0} className="flex h-7 items-center gap-1.5 rounded px-2 text-[12px] text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </Toolbar>
      }
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        {inboxItems.length > 0 && (
          <p className="mb-6 text-[13px] text-muted-foreground">
            One-line spot for anything you capture from Home, ⌘K, or the <span className="font-medium text-foreground">Quick capture</span> button. Promote each item to a real task by assigning a project, due date, or priority — or delete what isn&apos;t worth keeping.
          </p>
        )}
        <div className="border-t">
        {inboxItems.map((i) => (
          <div key={i.id} className="group grid grid-cols-[28px_minmax(0,1fr)_auto_auto_auto_28px_72px] items-center gap-3 border-b px-2 py-2.5 text-[13px] hover:bg-[var(--color-hover)]/60">
            <input
              type="checkbox"
              checked={selected.has(i.id)}
              onChange={() => toggleSel(i.id)}
              className="h-3 w-3 accent-[var(--color-primary)]"
            />
            <span className="truncate">{i.title}</span>
            <ProjectMenu items={projects.map((p) => ({ id: p.id, name: p.name, accent: p.accent }))} onPick={(pid) => inboxToWorkItem(i.id, { project: pid })} />
            <DueMenu onPick={(due) => inboxToWorkItem(i.id, { due })} />
            <PriorityMenu onPick={(p) => inboxToWorkItem(i.id, { priority: p })} />
            <button onClick={() => inboxToWorkItem(i.id)} title="Promote to task" className="rounded p-1 text-muted-foreground opacity-0 hover:bg-[var(--color-hover)] hover:text-foreground group-hover:opacity-100">
              <Check className="h-3.5 w-3.5" />
            </button>
            <span className="text-right text-[11px] text-muted-foreground">{i.captured}</span>
          </div>
        ))}

          <div className="px-2 py-12 text-center">
            <p className="text-[13px] text-muted-foreground">{inboxItems.length === 0 ? "Inbox zero. Nice." : "You've reached the bottom of your inbox."}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Capture on the Home page or anywhere with <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}



function ProjectMenu({ items, onPick }: { items: { id: string; name: string; accent: string }[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-[var(--color-hover)]">+ project</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover py-1 shadow-md">
            {items.map((p) => (
              <button key={p.id} onClick={() => { onPick(p.id); setOpen(false); }} className="flex w-full items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-[var(--color-hover)]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DueMenu({ onPick }: { onPick: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: "Today", days: 0 },
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-[var(--color-hover)]">+ due</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-32 rounded-md border bg-popover py-1 shadow-md">
            {options.map((o) => (
              <button key={o.label} onClick={() => {
                const d = new Date(); d.setDate(d.getDate() + o.days);
                onPick(d.toISOString().slice(0, 10));
                setOpen(false);
              }} className="block w-full px-2 py-1 text-left text-[12px] hover:bg-[var(--color-hover)]">{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PriorityMenu({ onPick }: { onPick: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const opts: Priority[] = ["High", "Medium", "Low"];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-[var(--color-hover)]">+ priority</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-28 rounded-md border bg-popover py-1 shadow-md">
            {opts.map((p) => (
              <button key={p} onClick={() => { onPick(p); setOpen(false); }} className="block w-full px-2 py-1 text-left text-[12px] hover:bg-[var(--color-hover)]">{p}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
