"use client"

import * as React from "react"
import { Plus, MoreHorizontal, CheckCircle2, Download, Upload, ChevronDown, ChevronRight, Lock, ListChecks, Trash2, FolderKanban, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { toast } from "sonner"
import Papa from "papaparse"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { useDrawer } from "@/components/flowboard/drawer-context"
import { members, projects } from "@/components/flowboard/drawer-data"
import { taskFormSchema, type TaskFormValues, projectFormSchema, type ProjectFormValues } from "@/components/flowboard/schemas"
import { useNavStore } from "@/components/flowboard/nav-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Priority = "High" | "Medium" | "Low"
type ColumnId = "backlog" | "in-progress" | "in-review" | "done"

interface Tag {
  label: string
  color: string
}

interface Subtask {
  id: string
  title: string
  completed: boolean
}

interface Task {
  id: string
  title: string
  priority: Priority
  assignee: string
  assigneeName: string
  dueDate: string
  tags: Tag[]
  subtasks: Subtask[]
  blockedBy: string[]
}

interface Column {
  id: ColumnId
  title: string
  tasks: Task[]
}

// ---------------------------------------------------------------------------
// Mock Data — "Website Redesign" Project
// ---------------------------------------------------------------------------

const tagDesign: Tag = { label: "Design", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" }
const tagFrontend: Tag = { label: "Frontend", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" }
const tagBackend: Tag = { label: "Backend", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
const tagContent: Tag = { label: "Content", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" }
const tagResearch: Tag = { label: "Research", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" }
const tagQA: Tag = { label: "QA", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }

/** Map tag labels to their tag objects for import */
const tagMap: Record<string, Tag> = {
  Design: tagDesign,
  Frontend: tagFrontend,
  Backend: tagBackend,
  Content: tagContent,
  Research: tagResearch,
  QA: tagQA,
}

const initialColumns: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    tasks: [
      { id: "T1", title: "Define color palette & tokens", priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 5", tags: [tagDesign], subtasks: [ { id: "T1-s1", title: "Research competitor palettes", completed: true }, { id: "T1-s2", title: "Define primary & secondary colors", completed: false }, { id: "T1-s3", title: "Create semantic token map", completed: false } ], blockedBy: [] },
      { id: "T2", title: "Write SEO metadata for all pages", priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10", tags: [tagContent], subtasks: [], blockedBy: [] },
      { id: "T3", title: "Research analytics integration", priority: "Low", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 12", tags: [tagResearch], subtasks: [], blockedBy: [] },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    tasks: [
      { id: "T4", title: "Build responsive navigation", priority: "High", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20", tags: [tagFrontend], subtasks: [ { id: "T4-s1", title: "Desktop navigation layout", completed: true }, { id: "T4-s2", title: "Mobile hamburger menu", completed: true }, { id: "T4-s3", title: "Dropdown menus", completed: false }, { id: "T4-s4", title: "Keyboard navigation", completed: false } ], blockedBy: ["T1"] },
      { id: "T5", title: "Design contact page layout", priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 22", tags: [tagDesign, tagFrontend], subtasks: [], blockedBy: ["T4"] },
      { id: "T6", title: "Implement auth API endpoints", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 19", tags: [tagBackend], subtasks: [ { id: "T6-s1", title: "Login endpoint", completed: true }, { id: "T6-s2", title: "Token refresh endpoint", completed: true }, { id: "T6-s3", title: "Password reset flow", completed: false } ], blockedBy: ["T10"] },
    ],
  },
  {
    id: "in-review",
    title: "In Review",
    tasks: [
      { id: "T7", title: "Hero section with animations", priority: "High", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 18", tags: [tagFrontend, tagDesign], subtasks: [ { id: "T7-s1", title: "Static hero layout", completed: true }, { id: "T7-s2", title: "Scroll-triggered animations", completed: true }, { id: "T7-s3", title: "Responsive image loading", completed: true } ], blockedBy: [] },
      { id: "T8", title: "Footer component & links", priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 21", tags: [tagFrontend], subtasks: [], blockedBy: [] },
      { id: "T9", title: "Accessibility audit pass 1", priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 23", tags: [tagQA], subtasks: [], blockedBy: [] },
    ],
  },
  {
    id: "done",
    title: "Done",
    tasks: [
      { id: "T10", title: "Project scaffolding & CI/CD", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 10", tags: [tagFrontend, tagBackend], subtasks: [], blockedBy: [] },
      { id: "T11", title: "Wireframes for all key pages", priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8", tags: [tagDesign], subtasks: [], blockedBy: [] },
      { id: "T12", title: "Brand guidelines document", priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5", tags: [tagDesign, tagContent], subtasks: [], blockedBy: [] },
      { id: "T13", title: "User interview synthesis", priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 3", tags: [tagResearch], subtasks: [], blockedBy: [] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Mock Data — Other Projects (P2–P5)
// ---------------------------------------------------------------------------

const projectColumnsData: Record<string, Column[]> = {
  P1: initialColumns,
  P2: [
    { id: "backlog", title: "Backlog", tasks: [
      { id: "M5", title: "App store listing copy", priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10", tags: [tagContent], subtasks: [], blockedBy: [] },
      { id: "M7", title: "Performance profiling", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 5", tags: [tagBackend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-progress", title: "In Progress", tasks: [
      { id: "M2", title: "Onboarding screen redesign", priority: "High", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 25", tags: [tagDesign, tagFrontend], subtasks: [], blockedBy: [] },
      { id: "M4", title: "Offline mode support", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 28", tags: [tagBackend, tagFrontend], subtasks: [], blockedBy: [] },
      { id: "M9", title: "Accessibility labels", priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 30", tags: [tagQA, tagFrontend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-review", title: "In Review", tasks: [
      { id: "M6", title: "Beta testing plan", priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 22", tags: [tagQA], subtasks: [], blockedBy: [] },
    ]},
    { id: "done", title: "Done", tasks: [
      { id: "M1", title: "User auth flow design", priority: "High", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 5", tags: [tagDesign], subtasks: [], blockedBy: [] },
      { id: "M3", title: "Push notification integration", priority: "Medium", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 1", tags: [tagBackend], subtasks: [], blockedBy: [] },
      { id: "M8", title: "Dark mode polish", priority: "Low", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 12", tags: [tagDesign], subtasks: [], blockedBy: [] },
    ]},
  ],
  P3: [
    { id: "backlog", title: "Backlog", tasks: [
      { id: "A4", title: "Deprecation headers", priority: "Low", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25", tags: [tagBackend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-progress", title: "In Progress", tasks: [
      { id: "A5", title: "Migration guide documentation", priority: "High", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 22", tags: [tagContent], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-review", title: "In Review", tasks: [
      { id: "A3", title: "Rate limiting middleware", priority: "Medium", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 18", tags: [tagBackend], subtasks: [], blockedBy: [] },
    ]},
    { id: "done", title: "Done", tasks: [
      { id: "A1", title: "JWT auth implementation", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 15", tags: [tagBackend], subtasks: [], blockedBy: [] },
      { id: "A2", title: "Cursor-based pagination", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 20", tags: [tagBackend], subtasks: [], blockedBy: [] },
      { id: "A6", title: "Consumer notification emails", priority: "Medium", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 1", tags: [tagContent], subtasks: [], blockedBy: [] },
      { id: "A7", title: "Load testing v3 endpoints", priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10", tags: [tagQA, tagBackend], subtasks: [], blockedBy: [] },
      { id: "A8", title: "Rollback procedure", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 25", tags: [tagBackend], subtasks: [], blockedBy: [] },
    ]},
  ],
  P4: [
    { id: "backlog", title: "Backlog", tasks: [
      { id: "D2", title: "Figma component library", priority: "High", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 1", tags: [tagDesign], subtasks: [], blockedBy: [] },
      { id: "D3", title: "Code generation pipeline", priority: "Medium", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 15", tags: [tagFrontend], subtasks: [], blockedBy: [] },
      { id: "D6", title: "Spacing & grid system", priority: "Low", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 10", tags: [tagDesign, tagFrontend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-progress", title: "In Progress", tasks: [
      { id: "D1", title: "Design tokens specification", priority: "High", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 20", tags: [tagDesign], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-review", title: "In Review", tasks: [
      { id: "D4", title: "Color system documentation", priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 18", tags: [tagDesign, tagContent], subtasks: [], blockedBy: [] },
    ]},
    { id: "done", title: "Done", tasks: [
      { id: "D5", title: "Typography scale", priority: "Low", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8", tags: [tagDesign], subtasks: [], blockedBy: [] },
    ]},
  ],
  P5: [
    { id: "backlog", title: "Backlog", tasks: [
      { id: "R4", title: "Export to PDF feature", priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 5", tags: [tagFrontend], subtasks: [], blockedBy: [] },
      { id: "R5", title: "Real-time data streaming", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 10", tags: [tagBackend], subtasks: [], blockedBy: [] },
      { id: "R6", title: "Filter & drill-down UI", priority: "Medium", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 8", tags: [tagFrontend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-progress", title: "In Progress", tasks: [
      { id: "R1", title: "Chart widget library", priority: "High", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25", tags: [tagFrontend], subtasks: [], blockedBy: [] },
      { id: "R2", title: "Data aggregation API", priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 22", tags: [tagBackend], subtasks: [], blockedBy: [] },
    ]},
    { id: "in-review", title: "In Review", tasks: [
      { id: "R3", title: "Dashboard layout system", priority: "Medium", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20", tags: [tagFrontend], subtasks: [], blockedBy: [] },
    ]},
    { id: "done", title: "Done", tasks: [
      { id: "R7", title: "KPI card components", priority: "Low", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10", tags: [tagFrontend], subtasks: [], blockedBy: [] },
      { id: "R8", title: "User preference storage", priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5", tags: [tagFrontend], subtasks: [], blockedBy: [] },
    ]},
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBorder(priority: Priority) {
  switch (priority) {
    case "High": return "border-l-red-500 dark:border-l-red-400"
    case "Medium": return "border-l-amber-500 dark:border-l-amber-400"
    case "Low": return "border-l-gray-400 dark:border-l-gray-500"
  }
}

function priorityBadgeStyle(priority: Priority) {
  switch (priority) {
    case "High": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
}

function columnAccentColor(id: ColumnId) {
  switch (id) {
    case "backlog": return "bg-gray-400"
    case "in-progress": return "bg-primary"
    case "in-review": return "bg-amber-500"
    case "done": return "bg-emerald-500"
  }
}

function columnCountBadgeStyle(id: ColumnId): string {
  switch (id) {
    case "backlog": return "bg-gray-400/15 text-gray-700 dark:bg-gray-300/15 dark:text-gray-300"
    case "in-progress": return "bg-primary/15 text-primary"
    case "in-review": return "bg-amber-500/15 text-amber-700 dark:bg-amber-400"
    case "done": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
  }
}

function isOverdue(dueDate: string): boolean {
  const parsed = new Date(`${dueDate}, 2026`)
  if (isNaN(parsed.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  return parsed < today
}

function findColumnForTask(columns: Column[], taskId: UniqueIdentifier): ColumnId | null {
  for (const col of columns) {
    if (col.tasks.some((t) => t.id === taskId)) return col.id
  }
  return null
}

function findTaskById(columns: Column[], taskId: UniqueIdentifier): Task | undefined {
  for (const col of columns) {
    const found = col.tasks.find((t) => t.id === taskId)
    if (found) return found
  }
  return undefined
}

/** Column title for a given ColumnId */
const columnTitles: Record<ColumnId, string> = {
  backlog: "Backlog",
  "in-progress": "In Progress",
  "in-review": "In Review",
  done: "Done",
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

function exportTasksCSV(columns: Column[], projectName: string) {
  const headers = ["Title", "Status", "Priority", "Assignee", "Due Date", "Tags", "Project"]
  const rows: string[][] = []
  for (const col of columns) {
    for (const task of col.tasks) {
      rows.push([
        `"${task.title.replace(/"/g, '""')}"`,
        columnTitles[col.id],
        task.priority,
        `"${task.assigneeName.replace(/"/g, '""')}"`,
        task.dueDate,
        `"${task.tags.map((t) => t.label).join(", ")}"`,
        projectName,
      ])
    }
  }
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "flowboard-tasks.csv"
  link.click()
  URL.revokeObjectURL(url)
  toast.success("Tasks exported", {
    icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    description: `${rows.length} tasks saved as flowboard-tasks.csv`,
  })
}

// ---------------------------------------------------------------------------
// Sortable Task Card
// ---------------------------------------------------------------------------

function SortableTaskCard({ task, columns, onUpdateTask }: { task: Task; columns: Column[]; onUpdateTask: (taskId: string, updated: Partial<Task>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const { openDrawer } = useDrawer()
  const [subtasksExpanded, setSubtasksExpanded] = React.useState(false)
  const [addingSubtask, setAddingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  }

  const completedCount = task.subtasks.filter(s => s.completed).length
  const totalCount = task.subtasks.length
  const subtaskProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const isBlocked = task.blockedBy.length > 0

  // Find blocking task names for tooltip
  const blockedByNames = task.blockedBy.map(id => {
    const t = findTaskById(columns, id)
    return t ? t.title : id
  })

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    const newSubtask: Subtask = {
      id: `${task.id}-s${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    }
    onUpdateTask(task.id, { subtasks: [...task.subtasks, newSubtask] })
    setNewSubtaskTitle("")
    setAddingSubtask(false)
    toast.success("Subtask added", { description: newSubtask.title })
  }

  const handleToggleSubtask = (subtaskId: string) => {
    const updated = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    )
    onUpdateTask(task.id, { subtasks: updated })
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    const updated = task.subtasks.filter(s => s.id !== subtaskId)
    onUpdateTask(task.id, { subtasks: updated })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group rounded-lg border border-l-4 bg-card p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-grab active:cursor-grabbing ${priorityBorder(task.priority)} ${isDragging ? "ring-2 ring-primary/20 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(task.priority)}`}>
            {task.priority}
          </span>
          {isBlocked && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" title={`Blocked by: ${blockedByNames.join(", ")}`}>
              <Lock className="size-2.5" />
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Task options</span>
        </Button>
      </div>
      <p className="text-sm font-medium leading-snug mb-3 cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); openDrawer("task", task.id) }}>{task.title}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.tags.map((tag) => (
          <span key={tag.label} className={`inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-medium leading-none opacity-70 ${tag.color}`}>
            {tag.label}
          </span>
        ))}
      </div>

      {/* Subtask progress bar (always visible when subtasks exist) */}
      {totalCount > 0 && (
        <div className="mb-3">
          <button
            className="flex items-center gap-1.5 w-full text-left group/sub"
            onClick={(e) => { e.stopPropagation(); setSubtasksExpanded(!subtasksExpanded) }}
          >
            {subtasksExpanded ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
            <ListChecks className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{completedCount}/{totalCount} subtasks</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          </button>

          {/* Collapsible subtask list */}
          {subtasksExpanded && (
            <div className="mt-2 space-y-1 pl-1" onClick={(e) => e.stopPropagation()}>
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 group/sub rounded-md px-1.5 py-1 hover:bg-muted/50 transition-colors">
                  <button
                    className={`size-4 rounded border shrink-0 flex items-center justify-center transition-all duration-200 ${subtask.completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary"}`}
                    onClick={() => handleToggleSubtask(subtask.id)}
                  >
                    {subtask.completed && <CheckCircle2 className="size-3" />}
                  </button>
                  <span className={`text-xs flex-1 transition-all duration-200 ${subtask.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {subtask.title}
                  </span>
                  <button
                    className="size-4 opacity-0 group-hover/sub:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDeleteSubtask(subtask.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}

              {/* Add subtask input */}
              {addingSubtask ? (
                <div className="flex items-center gap-2 px-1.5 py-1">
                  <div className="size-4 rounded border border-muted-foreground/30 shrink-0" />
                  <input
                    autoFocus
                    className="text-xs bg-transparent outline-none flex-1 placeholder:text-muted-foreground"
                    placeholder="Subtask title..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubtask()
                      if (e.key === "Escape") { setAddingSubtask(false); setNewSubtaskTitle("") }
                    }}
                    onBlur={() => { if (!newSubtaskTitle.trim()) { setAddingSubtask(false); setNewSubtaskTitle("") } }}
                  />
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 px-1.5 py-1 text-[10px] text-muted-foreground hover:text-primary transition-colors w-full"
                  onClick={() => setAddingSubtask(true)}
                >
                  <Plus className="size-3" />
                  Add subtask
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add subtask button when no subtasks exist */}
      {totalCount === 0 && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            onClick={() => setSubtasksExpanded(true)}
          >
            {addingSubtask ? null : <Plus className="size-3" />}
            {addingSubtask ? null : "Add subtask"}
          </button>
          {addingSubtask && (
            <div className="flex items-center gap-2 mt-1">
              <input
                autoFocus
                className="text-xs bg-transparent outline-none flex-1 placeholder:text-muted-foreground border-b border-border pb-0.5"
                placeholder="Subtask title..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (newSubtaskTitle.trim()) {
                      const newSubtask: Subtask = { id: `${task.id}-s${Date.now()}`, title: newSubtaskTitle.trim(), completed: false }
                      onUpdateTask(task.id, { subtasks: [newSubtask] })
                      setNewSubtaskTitle("")
                      setAddingSubtask(false)
                      setSubtasksExpanded(true)
                      toast.success("Subtask added", { description: newSubtask.title })
                    }
                  }
                  if (e.key === "Escape") { setAddingSubtask(false); setNewSubtaskTitle("") }
                }}
                onBlur={() => { if (!newSubtaskTitle.trim()) { setAddingSubtask(false); setNewSubtaskTitle("") } }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="size-6 shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); openDrawer("member", task.assignee) }}>
            <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">{task.assignee}</AvatarFallback>
          </Avatar>
          <EntityChip type="user" variant="subtle" className="text-[11px] truncate" entityId={task.assignee}>{task.assigneeName}</EntityChip>
        </div>
        <span className={`text-[11px] shrink-0 ${isOverdue(task.dueDate) ? "text-destructive font-medium" : "text-muted-foreground"}`}>{task.dueDate}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task Card Ghost (DragOverlay)
// ---------------------------------------------------------------------------

function TaskCardGhost({ task }: { task: Task }) {
  const completedCount = task.subtasks.filter(s => s.completed).length
  const totalCount = task.subtasks.length
  const isBlocked = task.blockedBy.length > 0

  return (
    <div className={`rounded-lg border border-l-4 bg-card p-3.5 shadow-xl ring-2 ring-primary/20 opacity-90 rotate-1 ${priorityBorder(task.priority)}`} style={{ width: 256 }}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(task.priority)}`}>{task.priority}</span>
          {isBlocked && (
            <span className="inline-flex items-center justify-center size-4 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <Lock className="size-2.5" />
            </span>
          )}
        </div>
      </div>
      <p className="text-sm font-medium leading-snug mb-3">{task.title}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.tags.map((tag) => (
          <span key={tag.label} className={`inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-medium leading-none opacity-70 ${tag.color}`}>{tag.label}</span>
        ))}
      </div>
      {totalCount > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <ListChecks className="size-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">{completedCount}/{totalCount}</span>
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">{task.assignee}</AvatarFallback>
          </Avatar>
          <EntityChip type="user" variant="subtle" className="text-[11px] truncate">{task.assigneeName}</EntityChip>
        </div>
        <span className="text-[11px] shrink-0 text-muted-foreground">{task.dueDate}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable Column
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Create Task Dialog
// ---------------------------------------------------------------------------

const TAG_OPTIONS = ["Design", "Frontend", "Backend", "Content", "Research", "QA"]

function CreateTaskDialog({
  open,
  onOpenChange,
  columnId,
  onAddTask,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  columnId: ColumnId
  onAddTask: (columnId: ColumnId, task: Task) => void
}) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema) as never,
    defaultValues: {
      title: "",
      description: "",
      priority: undefined,
      assignee: "",
      dueDate: "",
      tags: [],
    },
  })

  const onSubmit = (values: TaskFormValues) => {
    const member = members.find((m) => m.initials === values.assignee)
    const tagObjects: Tag[] = (values.tags ?? [])
      .map((label) => tagMap[label])
      .filter(Boolean) as Tag[]

    const newTask: Task = {
      id: `T${Date.now()}`,
      title: values.title,
      priority: values.priority,
      assignee: values.assignee,
      assigneeName: member?.name ?? values.assignee,
      dueDate: values.dueDate
        ? new Date(values.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "",
      tags: tagObjects.length > 0 ? tagObjects : [tagFrontend],
      subtasks: [],
      blockedBy: [],
    }

    onAddTask(columnId, newTask)
    toast.success("Task created ✓")
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) form.reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to the {columnTitles[columnId]} column.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Enter task title..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional description..." className="resize-none" rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.initials} value={m.initials}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => {
                      const isSelected = field.value?.includes(tag) ?? false
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const current = field.value ?? []
                            field.onChange(
                              isSelected
                                ? current.filter((t: string) => t !== tag)
                                : [...current, tag]
                            )
                          }}
                          className={cn(
                            "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
                            isSelected
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                          )}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={!form.formState.isValid}
              >
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function KanbanColumn({ column, isOver, columns, onUpdateTask, onAddTask }: { column: Column; isOver: boolean; columns: Column[]; onUpdateTask: (taskId: string, updated: Partial<Task>) => void; onAddTask: (columnId: ColumnId, task: Task) => void }) {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  return (
    <div id={column.id} className={`flex w-[280px] shrink-0 flex-col rounded-xl transition-colors duration-200 max-h-[calc(100vh-220px)] ${isOver ? "bg-primary/5 border border-primary/20" : "bg-muted/40 border border-transparent"}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 rounded-full ${columnAccentColor(column.id)}`} />
          <h3 className="text-sm font-semibold">{column.title}</h3>
          <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md text-[10px] font-semibold ${columnCountBadgeStyle(column.id)}`}>{column.tasks.length}</span>
        </div>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Column options</span>
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 pb-3">
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5 pt-1 pb-2">
            {column.tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} columns={columns} onUpdateTask={onUpdateTask} />
            ))}
          </div>
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No tasks yet</p>
            <p className="text-xs text-muted-foreground mt-1">Drag tasks here or add new ones</p>
          </div>
        )}
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <div className="px-3 pb-3">
        <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-muted-foreground border border-dashed border-border hover:text-foreground hover:bg-muted/40" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>
      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} columnId={column.id} onAddTask={onAddTask} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import Preview Dialog
// ---------------------------------------------------------------------------

function ImportPreviewDialog({
  open,
  onOpenChange,
  previewTasks,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewTasks: Task[]
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Preview</DialogTitle>
          <DialogDescription>
            Found {previewTasks.length} task{previewTasks.length === 1 ? "" : "s"} — import to Backlog?
          </DialogDescription>
        </DialogHeader>

        {/* Preview table */}
        <div className="max-h-[300px] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Title</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Priority</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previewTasks.map((task, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium truncate max-w-[200px]">{task.title}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate">{task.assigneeName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false) }}>
            <Upload className="size-4 mr-2" />
            Import {previewTasks.length} Task{previewTasks.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Kanban Board
// ---------------------------------------------------------------------------

export function KanbanBoard() {
  const { selectedProjectId, setSelectedProjectId, setActiveView } = useNavStore()
  const activeProjectId = selectedProjectId ?? "P1"
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0]

  // Per-project column state: each project gets its own independent Column[]
  const [projectColumnsState, setProjectColumnsState] = React.useState<Record<string, Column[]>>(() => {
    // Deep-clone the initial data so mutations don't cross-contaminate
    const state: Record<string, Column[]> = {}
    for (const [pid, cols] of Object.entries(projectColumnsData)) {
      state[pid] = JSON.parse(JSON.stringify(cols)) as Column[]
    }
    return state
  })

  const columns = projectColumnsState[activeProjectId] ?? []
  const setColumns = React.useCallback((updater: Column[] | ((prev: Column[]) => Column[])) => {
    setProjectColumnsState((prev) => {
      const currentCols = prev[activeProjectId] ?? []
      const nextCols = typeof updater === "function" ? updater(currentCols) : updater
      return { ...prev, [activeProjectId]: nextCols }
    })
  }, [activeProjectId])

  const [activeTaskId, setActiveTaskId] = React.useState<UniqueIdentifier | null>(null)
  const [overColumnId, setOverColumnId] = React.useState<ColumnId | null>(null)

  // Import state
  const [importPreviewOpen, setImportPreviewOpen] = React.useState(false)
  const [pendingImportTasks, setPendingImportTasks] = React.useState<Task[]>([])
  const importFileRef = React.useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeTask = activeTaskId ? findTaskById(columns, activeTaskId) : null

  const getColumnFromId = (id: UniqueIdentifier): ColumnId | null => {
    const col = columns.find((c) => c.id === id)
    if (col) return col.id
    return findColumnForTask(columns, id)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id)
    document.body.style.cursor = "grabbing"
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) { setOverColumnId(null); return }
    const activeColId = findColumnForTask(columns, active.id)
    const overColId = getColumnFromId(over.id)
    if (overColId) setOverColumnId(overColId)
    if (!activeColId || !overColId || activeColId === overColId) return
    setColumns((prev) => {
      const activeCol = prev.find((c) => c.id === activeColId)
      const overCol = prev.find((c) => c.id === overColId)
      if (!activeCol || !overCol) return prev
      const taskIndex = activeCol.tasks.findIndex((t) => t.id === active.id)
      if (taskIndex === -1) return prev
      const [task] = activeCol.tasks.splice(taskIndex, 1)
      const overTaskIndex = overCol.tasks.findIndex((t) => t.id === over.id)
      if (overTaskIndex === -1) overCol.tasks.push(task)
      else overCol.tasks.splice(overTaskIndex, 0, task)
      return [...prev]
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    document.body.style.cursor = ""
    setActiveTaskId(null)
    setOverColumnId(null)
    if (!over) return
    const activeColId = findColumnForTask(columns, active.id)
    const overColId = getColumnFromId(over.id)
    if (!activeColId || !overColId) return
    if (activeColId === overColId) {
      const col = columns.find((c) => c.id === activeColId)
      if (!col) return
      const oldIndex = col.tasks.findIndex((t) => t.id === active.id)
      const newIndex = col.tasks.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      setColumns((prev) => {
        const newColumns = prev.map((c) => {
          if (c.id !== activeColId) return c
          const newTasks = [...c.tasks]
          const [moved] = newTasks.splice(oldIndex, 1)
          newTasks.splice(newIndex, 0, moved)
          return { ...c, tasks: newTasks }
        })
        return newColumns
      })
    }
    if (activeColId !== overColId) {
      const targetColumn = columns.find((c) => c.id === overColId)
      if (targetColumn) {
        const task = findTaskById(columns, active.id)
        toast.success(`Task moved to ${targetColumn.title}`, {
          icon: <CheckCircle2 className="size-4 text-emerald-500" />,
          description: task ? task.title : undefined,
        })
      }
    }
  }

  function handleDragCancel() {
    setActiveTaskId(null)
    setOverColumnId(null)
    document.body.style.cursor = ""
  }

  // --- Import CSV handler ---
  const handleImportClick = () => {
    importFileRef.current?.click()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[]
        const tasks: Task[] = []

        for (const row of rows) {
          const title = row["Title"]?.trim()
          if (!title) continue

          const priorityRaw = row["Priority"]?.trim() ?? "Medium"
          const priority: Priority = ["High", "Medium", "Low"].includes(priorityRaw) ? (priorityRaw as Priority) : "Medium"

          const assigneeName = row["Assignee"]?.trim() ?? ""
          const assignee = assigneeName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "UN"

          const dueDate = row["Due Date"]?.trim() ?? ""

          const tagsStr = row["Tags"]?.trim() ?? ""
          const tagLabels = tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
          const tags: Tag[] = tagLabels
            .map((l) => tagMap[l])
            .filter(Boolean) as Tag[]
          if (tags.length === 0) tags.push(tagFrontend) // default tag

          tasks.push({
            id: `import-${Date.now()}-${tasks.length}`,
            title,
            priority,
            assignee,
            assigneeName: assigneeName || "Unassigned",
            dueDate: dueDate || "TBD",
            tags,
            subtasks: [],
            blockedBy: [],
          })
        }

        if (tasks.length === 0) {
          toast.error("No valid tasks found in CSV")
          return
        }

        setPendingImportTasks(tasks)
        setImportPreviewOpen(true)
      },
      error: () => {
        toast.error("Failed to parse CSV file")
      },
    })

    // Reset input so same file can be re-imported
    e.target.value = ""
  }

  const confirmImport = () => {
    if (pendingImportTasks.length === 0) return
    setColumns((prev) => {
      const newColumns = prev.map((col) => {
        if (col.id !== "backlog") return col
        return { ...col, tasks: [...col.tasks, ...pendingImportTasks] }
      })
      return newColumns
    })
    toast.success(`${pendingImportTasks.length} tasks imported`, {
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      description: `Added to Backlog column`,
    })
    setPendingImportTasks([])
  }

  const totalTasks = columns.reduce((sum, c) => sum + c.tasks.length, 0)

  // Handler to update a task's subtasks or blockedBy in any column
  const handleUpdateTask = React.useCallback((taskId: string, updated: Partial<Task>) => {
    setColumns(prev => prev.map(col => ({
      ...col,
      tasks: col.tasks.map(t => t.id === taskId ? { ...t, ...updated } : t),
    })))
  }, [setColumns])

  // Handler to add a task to a column
  const handleAddTask = React.useCallback((columnId: ColumnId, task: Task) => {
    setColumns(prev => prev.map(col => {
      if (col.id !== columnId) return col
      return { ...col, tasks: [...col.tasks, task] }
    }))
  }, [setColumns])

  // Header "Add Task" dialog (defaults to Backlog)
  const [headerCreateOpen, setHeaderCreateOpen] = React.useState(false)

  const handleSwitchProject = (projectId: string) => {
    setSelectedProjectId(projectId)
  }

  const handleViewReport = () => {
    setSelectedProjectId(activeProject.id)
    setActiveView("project-report")
  }

  // Inner panel collapse state
  const [panelCollapsed, setPanelCollapsed] = React.useState(false)

  // Create project dialog for inner panel
  const [innerCreateProjectOpen, setInnerCreateProjectOpen] = React.useState(false)

  return (
    <div className="flex gap-0 h-full relative">
      {/* Inner sidebar — desktop only */}
      <div
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200 overflow-hidden",
          panelCollapsed ? "w-0 min-w-0 opacity-0 pointer-events-none" : "w-[200px] min-w-[200px]"
        )}
      >
        {/* Collapse toggle header row — entire row is the button */}
        <button
          className="flex items-center gap-2 px-3 py-2.5 w-full border-b border-border text-muted-foreground hover:text-foreground transition-colors group shrink-0"
          onClick={() => setPanelCollapsed(true)}
          title="Collapse projects panel"
        >
          <PanelLeftClose className="size-3.5 shrink-0" />
          <span className="text-xs font-medium flex-1 text-left">Projects</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>

        {/* Project list */}
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-col flex-1 overflow-y-auto py-2 gap-0.5 px-2">
            {projects.map((project) => {
              const isActive = project.id === activeProjectId
              const taskCount = project.taskIds.length
              return (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors duration-150 text-left",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      onClick={() => handleSwitchProject(project.id)}
                    >
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <span className="truncate max-w-[120px] flex-1">{project.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">{taskCount}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {project.name}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>

        {/* New Project button pinned to bottom */}
        <button
          className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm text-muted-foreground hover:text-foreground border-t border-border shrink-0 transition-colors"
          onClick={() => setInnerCreateProjectOpen(true)}
        >
          <Plus className="size-3.5 shrink-0" />
          New Project
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 relative">
        {/* Re-expand button when panel is collapsed */}
        {panelCollapsed && (
          <button
            className="absolute left-0 top-4 z-10 flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setPanelCollapsed(false)}
            title="Expand projects panel"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}

        {/* Mobile project selector */}
        <div className="md:hidden">
          <Select value={activeProjectId} onValueChange={handleSwitchProject}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    <span>{project.name}</span>
                    <span className="text-muted-foreground text-xs">({project.taskIds.length})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Board header */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-6 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
            <h2 className="text-lg font-semibold truncate">{activeProject.name}</h2>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">Kanban Board</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#01696f] dark:text-[#4f98a3] hover:underline transition-colors"
              onClick={handleViewReport}
            >
              View Report →
            </button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Badge variant="secondary">4 columns</Badge>
            <Badge variant="outline">{totalTasks} tasks</Badge>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Button size="sm" className="gap-2 h-8" onClick={() => setHeaderCreateOpen(true)}>
              <Plus className="size-3.5" />
              Add Task
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => exportTasksCSV(columns, activeProject.name)}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleImportClick}>
              <Upload className="size-3.5" />
              Import CSV
            </Button>
            {/* Hidden file input for CSV import */}
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        {/* Columns — horizontal scroll with DnD context */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {columns.map((col) => (
                <KanbanColumn key={col.id} column={col} isOver={overColumnId === col.id} columns={columns} onUpdateTask={handleUpdateTask} onAddTask={handleAddTask} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" }}>
            {activeTask ? <TaskCardGhost task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Header "Add Task" dialog — adds to Backlog by default */}
        <CreateTaskDialog open={headerCreateOpen} onOpenChange={setHeaderCreateOpen} columnId="backlog" onAddTask={handleAddTask} />

        {/* Import preview dialog */}
        <ImportPreviewDialog
          open={importPreviewOpen}
          onOpenChange={setImportPreviewOpen}
          previewTasks={pendingImportTasks}
          onConfirm={confirmImport}
        />

        {/* Inner panel "New Project" dialog */}
        <Dialog open={innerCreateProjectOpen} onOpenChange={setInnerCreateProjectOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Add a new project to your workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input placeholder="Enter project name..." />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Optional description..." className="resize-none" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { toast.success("Project created"); setInnerCreateProjectOpen(false) }}>
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
