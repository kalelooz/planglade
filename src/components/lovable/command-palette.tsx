"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
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
  { label: "Open work items", to: "/work-items", icon: Plus, group: "Open" },
  { label: "Open notes capture", to: "/notes", icon: Plus, group: "Open" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);

  const filtered = commands.filter((command) => command.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => { setI(0); }, [q, open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setI((index) => Math.min(index + 1, filtered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setI((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter") {
        const command = filtered[i];
        if (command) {
          router.push(command.to);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, i, router, onClose]);

  const groups = filtered.reduce<Record<string, typeof filtered>>((acc, command) => {
    (acc[command.group] ||= []).push(command);
    return acc;
  }, {});

  let index = -1;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-[560px] max-w-[92vw] overflow-hidden rounded-md border bg-popover shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                placeholder="Type a command or search."
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {Object.entries(groups).map(([group, items]) => (
                <div key={group} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                  {items.map((command) => {
                    index++;
                    const active = index === i;
                    const Icon = command.icon;
                    return (
                      <button
                        key={command.label}
                        onClick={() => { router.push(command.to); onClose(); }}
                        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] ${active ? "bg-[var(--color-hover)]" : ""}`}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{command.label}</span>
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
              <span>Use arrow keys to navigate</span>
              <span>Select <kbd className="ml-1 rounded border bg-background px-1 font-mono">Enter</kbd></span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
