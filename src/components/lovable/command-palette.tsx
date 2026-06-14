"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Inbox, Home, ListTodo, FolderKanban, Calendar, FileText, Settings } from "lucide-react";
import { useStore } from "@/lib/store";

type Command = { label: string; to: string; icon: ComponentType<{ className?: string }>; group: string; search: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const notes = useStore((s) => s.notes);

  const commands = useMemo<Command[]>(() => ([
    { label: "Go to Home", to: "/app", icon: Home, group: "Navigate", search: "home" },
    { label: "Go to Inbox", to: "/app/inbox", icon: Inbox, group: "Navigate", search: "inbox" },
    { label: "Go to Tasks", to: "/app/tasks", icon: ListTodo, group: "Navigate", search: "tasks my tasks work items board kanban" },
    { label: "Go to Projects", to: "/app/projects", icon: FolderKanban, group: "Navigate", search: "projects" },
    { label: "Go to Notes", to: "/app/notes", icon: FileText, group: "Navigate", search: "notes" },
    { label: "Go to Calendar", to: "/app/calendar", icon: Calendar, group: "Navigate", search: "calendar" },
    { label: "Go to Settings", to: "/app/settings", icon: Settings, group: "Navigate", search: "settings" },
    ...projects.map((project) => ({ label: project.name, to: `/app/projects?project=${project.id}`, icon: FolderKanban, group: "Projects", search: `${project.name} ${project.id}` })),
    ...workItems.map((item) => ({ label: `${item.id} ${item.title}`, to: `/app/tasks?task=${item.id}`, icon: ListTodo, group: "Tasks", search: `${item.id} ${item.title} ${item.label} ${item.status}` })),
    ...notes.map((note) => ({ label: note.title, to: `/app/notes?id=${note.id}`, icon: FileText, group: "Notes", search: `${note.title} ${note.tag} ${note.excerpt}` })),
  ]), [notes, projects, workItems]);

  const filtered = commands.filter((command) => command.search.toLowerCase().includes(q.toLowerCase()));

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
                        className={`lov-menu-item gap-2.5 px-3 py-1.5 text-[13px] ${active ? "lov-menu-item-active" : ""}`}
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
