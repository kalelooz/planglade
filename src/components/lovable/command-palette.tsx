"use client";

import { useMemo, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Tray as Inbox,
  House as Home,
  ListChecks as ListTodo,
  Kanban as FolderKanban,
  Calendar,
  FileText,
  Gear as Settings,
  SquaresFour as LayoutGrid,
  ShareNetwork as Network,
} from "@phosphor-icons/react";
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

const APP_COMMAND_ROUTES = {
  home: "/app",
  inbox: "/app/inbox",
  tasks: "/app/tasks",
  projects: "/app/projects",
  notes: "/app/notes",
  calendar: "/app/calendar",
  settings: "/app/settings",
  connections: "/app/connections",
  tasksBoard: "/app/tasks?view=board",
} as const;

function commandValue(group: string, to: string, label: string, search: string) {
  return `${group} ${to} ${label} ${search}`;
}

function scopedRoute(path: string, basePath: "/app" | "/demo") {
  return path === "/app" ? basePath : path.replace(/^\/app(?=\/|\?|#|$)/, basePath);
}

export function CommandPalette({ open, onClose, basePath = "/app" }: { open: boolean; onClose: () => void; basePath?: "/app" | "/demo" }) {
  const router = useRouter();
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const notes = useStore((s) => s.notes);

  const commands = useMemo<PaletteCommand[]>(() => {
    const staticCommands = [
      { label: "Go to Home", to: scopedRoute(APP_COMMAND_ROUTES.home, basePath), icon: Home, group: "Navigate", search: "home" },
      { label: "Go to Inbox", to: scopedRoute(APP_COMMAND_ROUTES.inbox, basePath), icon: Inbox, group: "Navigate", search: "inbox" },
      { label: "Go to Tasks", to: scopedRoute(APP_COMMAND_ROUTES.tasks, basePath), icon: ListTodo, group: "Navigate", search: "tasks" },
      { label: "Go to Projects", to: scopedRoute(APP_COMMAND_ROUTES.projects, basePath), icon: FolderKanban, group: "Navigate", search: "projects" },
      { label: "Go to Notes", to: scopedRoute(APP_COMMAND_ROUTES.notes, basePath), icon: FileText, group: "Navigate", search: "notes" },
      { label: "Go to Calendar", to: scopedRoute(APP_COMMAND_ROUTES.calendar, basePath), icon: Calendar, group: "Navigate", search: "calendar" },
      { label: "Go to Connections", to: scopedRoute(APP_COMMAND_ROUTES.connections, basePath), icon: Network, group: "Navigate", search: "connections relationships dependencies" },
      { label: "Go to Settings", to: scopedRoute(APP_COMMAND_ROUTES.settings, basePath), icon: Settings, group: "Navigate", search: "settings" },
      { label: "Open Tasks board", to: scopedRoute(APP_COMMAND_ROUTES.tasksBoard, basePath), icon: LayoutGrid, group: "Tasks", search: "board kanban tasks" },
    ];

    return [
      ...staticCommands,
      ...projects.map((project) => ({
        label: project.name,
        to: `${basePath}/projects/${encodeURIComponent(project.id)}`,
        icon: FolderKanban,
        group: "Projects",
        search: `${project.name} ${project.id}`,
      })),
      ...workItems.map((item) => ({
        label: item.title.trim() || "No title",
        to: `${basePath}/tasks?task=${encodeURIComponent(item.id)}`,
        icon: ListTodo,
        group: "Tasks",
        search: `${item.id} ${item.title} ${item.label} ${item.status}`,
      })),
      ...notes.map((note) => ({
        label: note.title.trim() || "No title",
        to: `${basePath}/notes?id=${encodeURIComponent(note.id)}`,
        icon: FileText,
        group: "Notes",
        search: `${note.title} ${note.tag} ${note.excerpt}`,
      })),
    ].map((command) => ({
      ...command,
      value: commandValue(command.group, command.to, command.label, command.search),
    }));
  }, [basePath, notes, projects, workItems]);

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
