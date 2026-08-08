"use client"

import * as React from "react"
import {
  Home,
  Inbox,
  Kanban,
  GanttChartSquare,
  CalendarDays,
  StickyNote,
  Network,
  FolderKanban,
  CheckSquare,
  FileText,
  History,
  Users,
  Settings,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useNavStore, type ViewId } from "@/components/flowboard/nav-store"

// ---------------------------------------------------------------------------
// Command Palette Data
// ---------------------------------------------------------------------------

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  view: ViewId
  noteId?: string
}

interface ProjectItem {
  id: string
  label: string
  color: string
  view: ViewId
}

interface TaskItem {
  id: string
  label: string
  priority: "High" | "Medium" | "Low"
  view: ViewId
}

interface NoteItem {
  id: string
  label: string
  tag: string
  tagColor: string
  view: ViewId
  noteId: string
}

const navItems: NavItem[] = [
  { id: "nav-dashboard", label: "Home", icon: Home, view: "dashboard" },
  { id: "nav-inbox", label: "Inbox", icon: Inbox, view: "inbox" },
  { id: "nav-projects", label: "Kanban Board", icon: Kanban, view: "projects" },
  { id: "nav-timeline", label: "Timeline", icon: GanttChartSquare, view: "timeline" },
  { id: "nav-calendar", label: "Calendar", icon: CalendarDays, view: "calendar" },
  { id: "nav-my-tasks", label: "My Tasks", icon: CheckSquare, view: "my-tasks" },
  { id: "nav-notes", label: "Notes", icon: StickyNote, view: "notes" },
  { id: "nav-graph", label: "Graph View", icon: Network, view: "graph-view" },
  { id: "nav-activity", label: "Activity Log", icon: History, view: "activity-log" },
  { id: "nav-team", label: "Team", icon: Users, view: "team" },
  { id: "nav-settings", label: "Settings", icon: Settings, view: "settings" },
]

const projectItems: ProjectItem[] = [
  { id: "proj-1", label: "Website Redesign", color: "#01696f", view: "projects" },
  { id: "proj-2", label: "Mobile App v2", color: "#8b5cf6", view: "projects" },
  { id: "proj-3", label: "API Migration", color: "#f59e0b", view: "projects" },
  { id: "proj-4", label: "Design System", color: "#ec4899", view: "projects" },
  { id: "proj-5", label: "Analytics Dashboard", color: "#10b981", view: "projects" },
]

const projectReportItems: { id: string; label: string; color: string; projectId: string }[] = [
  { id: "report-1", label: "Website Redesign Report", color: "#01696f", projectId: "P1" },
  { id: "report-2", label: "Mobile App v2 Report", color: "#8b5cf6", projectId: "P2" },
  { id: "report-3", label: "API Migration Report", color: "#f59e0b", projectId: "P3" },
  { id: "report-4", label: "Design System Report", color: "#ec4899", projectId: "P4" },
  { id: "report-5", label: "Analytics Dashboard Report", color: "#10b981", projectId: "P5" },
]

const taskItems: TaskItem[] = [
  { id: "task-T1", label: "Define color palette & tokens", priority: "Medium", view: "projects" },
  { id: "task-T2", label: "Write SEO metadata for all pages", priority: "Low", view: "projects" },
  { id: "task-T3", label: "Research analytics integration", priority: "Low", view: "projects" },
  { id: "task-T4", label: "Build responsive navigation", priority: "High", view: "projects" },
  { id: "task-T5", label: "Design contact page layout", priority: "Medium", view: "projects" },
  { id: "task-T6", label: "Implement auth API endpoints", priority: "High", view: "projects" },
  { id: "task-T7", label: "Hero section with animations", priority: "High", view: "projects" },
  { id: "task-T8", label: "Footer component & links", priority: "Low", view: "projects" },
  { id: "task-T9", label: "Accessibility audit pass 1", priority: "Medium", view: "projects" },
  { id: "task-T10", label: "Project scaffolding & CI/CD", priority: "High", view: "projects" },
  { id: "task-T11", label: "Wireframes for all key pages", priority: "Medium", view: "projects" },
  { id: "task-T12", label: "Brand guidelines document", priority: "Low", view: "projects" },
  { id: "task-T13", label: "User interview synthesis", priority: "Medium", view: "projects" },
]

const noteItems: NoteItem[] = [
  { id: "note-N1", label: "Q3 Product Roadmap", tag: "Product", tagColor: "bg-primary/10 text-primary", view: "notes", noteId: "N1" },
  { id: "note-N2", label: "Team Meeting Notes — May 12", tag: "Meeting", tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", view: "notes", noteId: "N2" },
  { id: "note-N3", label: "Design Brief — Mobile v2", tag: "Design", tagColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", view: "notes", noteId: "N3" },
  { id: "note-N4", label: "User Research Findings", tag: "Research", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", view: "notes", noteId: "N4" },
  { id: "note-N5", label: "API Deprecation Plan", tag: "Engineering", tagColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", view: "notes", noteId: "N5" },
]

// ---------------------------------------------------------------------------
// Priority badge helper
// ---------------------------------------------------------------------------

function priorityBadgeStyle(priority: "High" | "Medium" | "Low") {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
}

// ---------------------------------------------------------------------------
// Command Palette Hook — shared state for opening the palette
// ---------------------------------------------------------------------------

// Simple global state so header and keyboard shortcut can both trigger it
let _openFn: (() => void) | null = null

export function useCommandPalette() {
  const open = React.useCallback(() => {
    _openFn?.()
  }, [])
  return { open }
}

// ---------------------------------------------------------------------------
// Command Palette Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const setActiveView = useNavStore((s) => s.setActiveView)
  const setSelectedNoteId = useNavStore((s) => s.setSelectedNoteId)
  const setSelectedProjectId = useNavStore((s) => s.setSelectedProjectId)

  // Register the open function so the hook can trigger it
  React.useEffect(() => {
    _openFn = () => setOpen(true)
    return () => { _openFn = null }
  }, [])

  // Cmd+K / Ctrl+K keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for views, projects, tasks, and notes..."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigate group */}
        <CommandGroup heading="Navigate">
          {navItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id}`}
              onSelect={() => runCommand(() => setActiveView(item.view))}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Projects group */}
        <CommandGroup heading="Projects">
          {projectItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id}`}
              onSelect={() => runCommand(() => setActiveView(item.view))}
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
              <FolderKanban className="ml-auto size-3.5 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Tasks group */}
        <CommandGroup heading="Tasks">
          {taskItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id} ${item.priority}`}
              onSelect={() => runCommand(() => setActiveView(item.view))}
            >
              <CheckSquare className="size-4" />
              <span className="flex-1 truncate">{item.label}</span>
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(item.priority)}`}
              >
                {item.priority}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Notes group */}
        <CommandGroup heading="Notes">
          {noteItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id} ${item.tag}`}
              onSelect={() =>
                runCommand(() => {
                  setSelectedNoteId(item.noteId)
                  setActiveView(item.view)
                })
              }
            >
              <FileText className="size-4" />
              <span className="flex-1 truncate">{item.label}</span>
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ${item.tagColor}`}
              >
                {item.tag}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Project Reports group */}
        <CommandGroup heading="Project Reports">
          {projectReportItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.id}`}
              onSelect={() =>
                runCommand(() => {
                  setSelectedProjectId(item.projectId)
                  setActiveView("project-report")
                })
              }
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 truncate">{item.label}</span>
              <FolderKanban className="ml-auto size-3.5 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
