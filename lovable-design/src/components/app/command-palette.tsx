import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ArrowRight, Plus, Inbox, Home, ListTodo, FolderKanban, Calendar, FileText, Users, Settings } from "lucide-react";

const commands = [
  { label: "Go to Home", to: "/", icon: Home, group: "Navigate" },
  { label: "Go to Inbox", to: "/inbox", icon: Inbox, group: "Navigate" },
  { label: "Go to My Tasks", to: "/my-tasks", icon: ListTodo, group: "Navigate" },
  { label: "Go to Projects", to: "/projects", icon: FolderKanban, group: "Navigate" },
  { label: "Go to Calendar", to: "/calendar", icon: Calendar, group: "Navigate" },
  { label: "Go to Notes", to: "/notes", icon: FileText, group: "Navigate" },
  { label: "Go to Team", to: "/team", icon: Users, group: "Navigate" },
  { label: "Go to Settings", to: "/settings", icon: Settings, group: "Navigate" },
  { label: "Create new work item", to: "/work-items", icon: Plus, group: "Actions" },
  { label: "Capture quick note", to: "/notes", icon: Plus, group: "Actions" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => { setI(0); }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
      if (e.key === "Enter") {
        const c = filtered[i];
        if (c) { navigate({ to: c.to }); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, i, navigate, onClose]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, typeof filtered>>((a, c) => {
    (a[c.group] ||= []).push(c);
    return a;
  }, {});

  let idx = -1;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 pt-[15vh]" onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] overflow-hidden rounded-md border bg-popover shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Type a command or search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="py-1">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
              {items.map((c) => {
                idx++;
                const active = idx === i;
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    onClick={() => { navigate({ to: c.to }); onClose(); }}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] ${active ? "bg-hover" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{c.label}</span>
                    {active && <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">No results</div>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-sidebar px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>Navigate <kbd className="ml-1 rounded border bg-background px-1 font-mono">↑↓</kbd></span>
          <span>Select <kbd className="ml-1 rounded border bg-background px-1 font-mono">↵</kbd></span>
        </div>
      </div>
    </div>
  );
}
