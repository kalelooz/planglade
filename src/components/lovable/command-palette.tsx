"use client";

import { useMemo, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Home,
  ListTodo,
  FolderKanban,
  Calendar,
  FileText,
  Settings,
  LayoutGrid,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type PaletteCommand = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  search: string;
  value: string;
};

function commandValue(group: string, to: string, label: string, search: string) {
  return `${group} ${to} ${label} ${search}`;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const notes = useStore((s) => s.notes);

  const commands = useMemo<PaletteCommand[]>(() => {
    const staticCommands = [
      { label: "Go to Home", to: "/app", icon: Home, group: "Navigate", search: "home" },
      { label: "Go to Inbox", to: "/app/inbox", icon: Inbox, group: "Navigate", search: "inbox" },
      { label: "Go to Tasks", to: "/app/tasks", icon: ListTodo, group: "Navigate", search: "tasks" },
      { label: "Go to Projects", to: "/app/projects", icon: FolderKanban, group: "Navigate", search: "projects" },
      { label: "Go to Notes", to: "/app/notes", icon: FileText, group: "Navigate", search: "notes" },
      { label: "Go to Calendar", to: "/app/calendar", icon: Calendar, group: "Navigate", search: "calendar" },
      { label: "Go to Settings", to: "/app/settings", icon: Settings, group: "Navigate", search: "settings" },
      { label: "Open Tasks board", to: "/app/tasks?view=board", icon: LayoutGrid, group: "Tasks", search: "board kanban tasks" },
    ];

    return [
      ...staticCommands,
      ...projects.map((project) => ({
        label: project.name,
        to: `/app/projects/${encodeURIComponent(project.id)}`,
        icon: FolderKanban,
        group: "Projects",
        search: `${project.name} ${project.id}`,
      })),
      ...workItems.map((item) => ({
        label: item.title.trim() || "No title",
        to: `/app/tasks?task=${encodeURIComponent(item.id)}`,
        icon: ListTodo,
        group: "Tasks",
        search: `${item.id} ${item.title} ${item.label} ${item.status}`,
      })),
      ...notes.map((note) => ({
        label: note.title.trim() || "No title",
        to: `/app/notes?id=${encodeURIComponent(note.id)}`,
        icon: FileText,
        group: "Notes",
        search: `${note.title} ${note.tag} ${note.excerpt}`,
      })),
    ].map((command) => ({
      ...command,
      value: commandValue(command.group, command.to, command.label, command.search),
    }));
  }, [notes, projects, workItems]);

  const groups = useMemo(() => {
    return commands.reduce<Record<string, PaletteCommand[]>>((acc, command) => {
      (acc[command.group] ||= []).push(command);
      return acc;
    }, {});
  }, [commands]);

  const runCommand = (command: PaletteCommand) => {
    router.push(command.to);
    onClose();
  };

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
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-[560px] max-w-[92vw] overflow-hidden rounded-md border bg-popover shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Command loop className="rounded-none">
              <CommandInput autoFocus placeholder="Type a command or search." className="text-sm" />
              <CommandList className="max-h-80 scroll-py-2 overflow-y-auto overscroll-contain py-1 [scrollbar-gutter:stable]">
                <CommandEmpty className="px-3 py-6 text-center text-xs text-muted-foreground">No results</CommandEmpty>
                {Object.entries(groups).map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((command) => {
                      const Icon = command.icon;
                      return (
                        <CommandItem
                          key={command.value}
                          value={command.value}
                          onSelect={() => runCommand(command)}
                          className="gap-2.5 px-3 py-1.5 text-[13px]"
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{command.label}</span>
                          <CommandShortcut>{command.group}</CommandShortcut>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
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
