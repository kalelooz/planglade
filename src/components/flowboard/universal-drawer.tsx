"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar,
  User,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  MessageSquare,
  Link2,
  FolderKanban,
  ListChecks,
  FileText,
  Lock,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { useDrawer, type DrawerEntry, type DrawerType } from "@/components/flowboard/drawer-context"
import { useNavStore } from "@/components/flowboard/nav-store"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  getTask,
  getProject,
  getNote,
  getMember,
  getTaskComments,
  type DrawerTask,
  type Subtask,
  priorityBadgeStyle,
  statusBadgeStyle,
  taskStatusColor,
} from "@/components/flowboard/drawer-data"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const statusOptions = ["Backlog", "In Progress", "In Review", "Done"] as const

// Entity type icon mapping for collapsed view
function EntityTypeIcon({ type }: { type: DrawerType }) {
  switch (type) {
    case "task":
      return <CheckSquare className="size-5 text-violet-500" />
    case "project":
      return <FolderKanban className="size-5 text-primary" />
    case "note":
      return <FileText className="size-5 text-amber-500" />
    case "member":
      return <User className="size-5 text-blue-500" />
  }
}

// Entity type label
function entityTypeLabel(type: DrawerType): string {
  switch (type) {
    case "task": return "Task"
    case "project": return "Project"
    case "note": return "Note"
    case "member": return "Member"
  }
  return "Unknown"
}

// Get a short label for a history entry (for breadcrumbs)
function entryLabel(entry: DrawerEntry): string {
  switch (entry.type) {
    case "task": return getTask(entry.id)?.title ?? "Task"
    case "project": return getProject(entry.id)?.name ?? "Project"
    case "note": return getNote(entry.id)?.title ?? "Note"
    case "member": return getMember(entry.id)?.name ?? "Member"
  }
  return "Unknown"
}

// Border color per entity type (for border-l-4)
function entityBorderColor(type: DrawerType): string {
  switch (type) {
    case "task": return "border-l-violet-400"
    case "project": return "border-l-primary"
    case "note": return "border-l-amber-400"
    case "member": return "border-l-blue-400"
  }
  return "border-l-muted"
}

// SVG Circular Progress Ring
function ProgressRing({ progress, size = 96, strokeWidth = 8, color = "var(--color-primary)" }: { progress: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{progress}%</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">complete</span>
      </div>
    </div>
  )
}

// Segmented Status Control for Tasks
function SegmentedStatusControl({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const segments = statusOptions.map((s) => ({
    value: s,
    label: s,
    color: taskStatusColor(s as DrawerTask["status"]),
  }))

  return (
    <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
      {segments.map((seg) => {
        const isActive = value === seg.value
        return (
          <button
            key={seg.value}
            onClick={() => onChange(seg.value)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer
              ${isActive
                ? "bg-violet-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }
            `}
          >
            <span
              className={`size-1.5 rounded-full ${isActive ? "bg-white" : ""}`}
              style={!isActive ? { backgroundColor: seg.color } : undefined}
            />
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}

// Availability indicator
function AvailabilityDot({ activeTasks }: { activeTasks: number }) {
  const color = activeTasks <= 3 ? "bg-emerald-500" : activeTasks <= 5 ? "bg-amber-500" : "bg-red-500"
  const label = activeTasks <= 3 ? "Available" : activeTasks <= 5 ? "Busy" : "Overloaded"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-2 rounded-full ${color} animate-pulse`} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Navigation Breadcrumb Bar
// ---------------------------------------------------------------------------

function NavigationBar() {
  const { state, goBack, goForward, goToIndex, closeDrawer, canGoBack, canGoForward } = useDrawer()
  const { drawerHistory, historyIndex } = state

  // Build visible breadcrumbs: show max 3 items centered around current index
  const visibleEntries = React.useMemo(() => {
    if (drawerHistory.length <= 3) {
      return drawerHistory.map((entry, i) => ({ entry, index: i }))
    }
    // Show window of 3 around current index
    let start = Math.max(0, historyIndex - 1)
    const end = Math.min(drawerHistory.length, start + 3)
    start = Math.max(0, end - 3)
    const result: { entry: DrawerEntry; index: number }[] = []
    for (let i = start; i < end; i++) {
      result.push({ entry: drawerHistory[i], index: i })
    }
    return result
  }, [drawerHistory, historyIndex])

  // Should we show leading/trailing ellipsis?
  const showLeadingEllipsis = visibleEntries.length > 0 && visibleEntries[0].index > 0
  const showTrailingEllipsis = visibleEntries.length > 0 && visibleEntries[visibleEntries.length - 1].index < drawerHistory.length - 1

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
      {/* Back button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className={`size-6 rounded flex items-center justify-center transition-colors shrink-0 ${
              canGoBack
                ? "hover:bg-muted text-foreground cursor-pointer"
                : "text-muted-foreground/40 cursor-default"
            }`}
          >
            <ArrowLeft className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p className="text-xs">Go back{canGoBack ? " (Alt+←)" : ""}</p>
        </TooltipContent>
      </Tooltip>

      {/* Forward button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className={`size-6 rounded flex items-center justify-center transition-colors shrink-0 ${
              canGoForward
                ? "hover:bg-muted text-foreground cursor-pointer"
                : "text-muted-foreground/40 cursor-default"
            }`}
          >
            <ArrowRight className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p className="text-xs">Go forward{canGoForward ? " (Alt+→)" : ""}</p>
        </TooltipContent>
      </Tooltip>

      {/* Breadcrumb trail */}
      <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden px-1">
        {showLeadingEllipsis && (
          <span className="text-[10px] text-muted-foreground/60 px-0.5 shrink-0">...</span>
        )}
        {visibleEntries.map(({ entry, index }, vi) => {
          const isCurrent = index === historyIndex
          const label = entryLabel(entry)
          const truncated = label.length > 20 ? label.slice(0, 18) + "…" : label

          return (
            <React.Fragment key={`${entry.type}-${entry.id}-${index}`}>
              {vi > 0 && (
                <ChevronDown className="size-2.5 text-muted-foreground/40 shrink-0 -rotate-90" />
              )}
              <button
                onClick={() => !isCurrent && goToIndex(index)}
                className={`text-[11px] truncate max-w-[120px] transition-colors shrink min-w-0 ${
                  isCurrent
                    ? "font-semibold text-foreground cursor-default"
                    : "text-muted-foreground hover:text-foreground cursor-pointer"
                }`}
                title={label}
              >
                {truncated}
              </button>
            </React.Fragment>
          )
        })}
        {showTrailingEllipsis && (
          <span className="text-[10px] text-muted-foreground/60 px-0.5 shrink-0">...</span>
        )}
      </div>

      {/* Close button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={closeDrawer}
            className="size-6 rounded hover:bg-muted flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p className="text-xs">Close panel</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task Detail Panel — Violet Identity
// ---------------------------------------------------------------------------

function TaskDetailPanel({ taskId }: { taskId: string }) {
  const task = getTask(taskId)
  const { openDrawer, closeDrawer } = useDrawer()
  const setActiveView = useNavStore((s) => s.setActiveView)
  const setSelectedProjectId = useNavStore((s) => s.setSelectedProjectId)
  const [currentStatus, setCurrentStatus] = React.useState(task?.status ?? "Backlog")
  const [subtasks, setSubtasks] = React.useState<Subtask[]>(task?.subtasks ?? [])
  const [addingSubtask, setAddingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")

  if (!task) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Task not found</p>
      </div>
    )
  }

  const comments = getTaskComments(taskId)
  const completedCount = subtasks.filter(s => s.completed).length
  const totalCount = subtasks.length
  const subtaskProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const handleStatusChange = (value: string) => {
    setCurrentStatus(value as DrawerTask["status"])
    toast.success(`Status updated to ${value}`, { description: task.title })
  }

  const handleMarkComplete = () => {
    setCurrentStatus("Done")
    toast.success("Task marked complete", {
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      description: task.title,
    })
  }

  const handleOpenFullView = () => {
    closeDrawer()
    setSelectedProjectId(task.projectId)
    setActiveView("project-report")
  }

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s))
  }

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    const newSubtask: Subtask = { id: `${taskId}-s${Date.now()}`, title: newSubtaskTitle.trim(), completed: false }
    setSubtasks(prev => [...prev, newSubtask])
    setNewSubtaskTitle("")
    setAddingSubtask(false)
    toast.success("Subtask added", { description: newSubtask.title })
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
  }

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* ── Top panel: Task info ── */}
        <ResizablePanel defaultSize={65} minSize={35}>
          <ScrollArea className="h-full">
            {/* ── Violet Header ── */}
            <div className="bg-violet-500/[0.08] px-5 pt-4 pb-5 space-y-3.5">
              <div className="flex items-start gap-3">
                <CheckSquare className="size-6 text-violet-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-tight">{task.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadgeStyle(task.priority)}`}>
                      {task.priority}
                    </span>
                    <button
                      onClick={() => openDrawer("project", task.projectId)}
                      className="text-[10px] text-muted-foreground hover:text-violet-600 transition-colors cursor-pointer"
                    >
                      {task.projectName}
                    </button>
                  </div>
                </div>
              </div>

              {/* Segmented Status Control — hero element */}
              <SegmentedStatusControl value={currentStatus} onChange={handleStatusChange} />
            </div>

            {/* ── Body ── */}
            <div className="px-5 pt-4 pb-6 space-y-4">
              {/* Assignee + Due date */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground" />
                  <button
                    onClick={() => openDrawer("member", task.assignee)}
                    className="flex items-center gap-1.5 hover:text-violet-600 transition-colors"
                  >
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[9px] font-semibold bg-violet-500/10 text-violet-600">
                        {task.assignee}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{task.assigneeName}</span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{task.dueDate}</span>
                </div>
              </div>

              {/* Tags */}
              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span key={tag.label} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tag.color}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}

              <Separator />

              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold mb-1.5">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
              </div>

              <Separator />

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="size-3.5 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Subtasks</h4>
                    {totalCount > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{completedCount}/{totalCount}</Badge>
                    )}
                  </div>
                  {totalCount > 0 && <span className="text-xs text-muted-foreground">{Math.round(subtaskProgress)}%</span>}
                </div>
                {totalCount > 0 && (
                  <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${subtaskProgress}%` }} />
                  </div>
                )}
                <div className="space-y-1">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2.5 group/sub rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={() => handleToggleSubtask(subtask.id)}
                        className="transition-all duration-200 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                      />
                      <span className={`text-sm flex-1 transition-all duration-300 ${subtask.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground"}`}>
                        {subtask.title}
                      </span>
                      <button
                        className="size-5 opacity-0 group-hover/sub:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 rounded hover:bg-destructive/10 flex items-center justify-center"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  {addingSubtask ? (
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                      <div className="size-4 rounded border border-muted-foreground/30 shrink-0" />
                      <input
                        autoFocus
                        className="text-sm bg-transparent outline-none flex-1 placeholder:text-muted-foreground"
                        placeholder="New subtask..."
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
                      className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-violet-600 transition-colors w-full rounded-md hover:bg-muted/50"
                      onClick={() => setAddingSubtask(true)}
                    >
                      <Plus className="size-3.5" />
                      Add subtask
                    </button>
                  )}
                </div>
              </div>

              {/* Blocked By */}
              {task.blockedBy.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="size-3.5 text-red-500" />
                    <h4 className="text-sm font-semibold">Blocked By</h4>
                    <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{task.blockedBy.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {task.blockedBy.map((blockingId) => {
                      const blockingTask = getTask(blockingId)
                      if (!blockingTask) return null
                      const isDone = blockingTask.status === "Done"
                      return (
                        <button
                          key={blockingId}
                          onClick={() => openDrawer("task", blockingId)}
                          className={`w-full text-left flex items-center gap-2.5 rounded-md border p-2.5 hover:bg-muted/40 transition-colors ${isDone ? "border-emerald-200 dark:border-emerald-800/50" : "border-red-200 dark:border-red-800/50"}`}
                        >
                          <span className={`inline-flex items-center justify-center size-5 rounded-full shrink-0 ${isDone ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {isDone ? <CheckCircle2 className="size-3" /> : <Lock className="size-2.5" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isDone ? "text-muted-foreground line-through" : ""}`}>{blockingTask.title}</p>
                            <p className="text-[10px] text-muted-foreground">{blockingTask.projectName}</p>
                          </div>
                          <span className={`inline-flex items-center rounded px-1.5 py-0 text-[9px] font-semibold shrink-0 ${isDone ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                            {blockingTask.status}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Linked Notes */}
              {task.linkedNoteIds.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Linked Notes</h4>
                    <Badge variant="secondary" className="text-[10px]">{task.linkedNoteIds.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.linkedNoteIds.map((noteId) => {
                      const note = getNote(noteId)
                      if (!note) return null
                      return (
                        <button
                          key={noteId}
                          onClick={() => openDrawer("note", noteId)}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium hover:bg-muted/60 transition-colors"
                        >
                          <FileText className="size-3 text-amber-500" />
                          {note.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Bottom panel: Activity timeline ── */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <ScrollArea className="h-full">
            <div className="px-5 pt-4 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Activity</h4>
                  <Badge variant="secondary" className="text-[10px]">{comments.length}</Badge>
                </div>
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="size-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[9px] font-semibold bg-violet-500/10 text-violet-600">
                          {comment.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <button onClick={() => openDrawer("member", comment.user)} className="text-xs font-semibold hover:text-violet-600 transition-colors">
                            {comment.userName}
                          </button>
                          <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Footer */}
      <div className="border-t px-5 py-3 flex gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenFullView}>
          <ExternalLink className="size-3.5" />
          Open Full View
        </Button>
        <Button size="sm" className="gap-2 bg-violet-500 hover:bg-violet-600" onClick={handleMarkComplete} disabled={currentStatus === "Done"}>
          <CheckCircle2 className="size-3.5" />
          Mark Complete
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project Overview Panel — Teal/Primary Identity
// ---------------------------------------------------------------------------

function ProjectOverviewPanel({ projectId }: { projectId: string }) {
  const project = getProject(projectId)
  const { openDrawer, closeDrawer } = useDrawer()
  const setActiveView = useNavStore((s) => s.setActiveView)
  const setSelectedProjectId = useNavStore((s) => s.setSelectedProjectId)

  if (!project) {
    return <div className="flex items-center justify-center py-16"><p className="text-sm text-muted-foreground">Project not found</p></div>
  }

  const projectTasks = project.taskIds.map((id) => getTask(id)).filter(Boolean) as DrawerTask[]

  const statusCounts = {
    Backlog: projectTasks.filter((t) => t.status === "Backlog").length,
    "In Progress": projectTasks.filter((t) => t.status === "In Progress").length,
    "In Review": projectTasks.filter((t) => t.status === "In Review").length,
    Done: projectTasks.filter((t) => t.status === "Done").length,
  }

  const teamInitials = Array.from(new Set(projectTasks.map((t) => t.assignee)))

  const recentActivities = projectTasks.slice(0, 3).map((t, i) => ({
    id: `pa-${i}`,
    user: t.assignee,
    userName: t.assigneeName,
    action: t.status === "Done" ? "completed" : "updated",
    target: t.title,
    taskId: t.id,
    timestamp: i === 0 ? "2h ago" : i === 1 ? "5h ago" : "1d ago",
  }))

  const handleOpenReport = () => {
    closeDrawer()
    setSelectedProjectId(projectId)
    setActiveView("project-report")
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        {/* ── Teal Header ── */}
        <div className="bg-primary/[0.08] px-5 pt-4 pb-5 space-y-4">
          <div className="flex items-start gap-3">
            <FolderKanban className="size-6 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold leading-tight">{project.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${statusBadgeStyle(project.status)}`}>
                  {project.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {project.startDate} — {project.endDate}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Ring — hero element */}
          <div className="flex items-center gap-5">
            <ProgressRing progress={project.progress} size={88} strokeWidth={7} color={project.color} />
            <div className="space-y-1.5 flex-1">
              {(["Done", "In Progress", "In Review", "Backlog"] as const).map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: taskStatusColor(status) }} />
                  <span className="text-[11px] text-muted-foreground flex-1">{status}</span>
                  <span className="text-[11px] font-semibold">{statusCounts[status]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Task breakdown grid */}
          <div>
            <h4 className="text-sm font-semibold mb-2.5">Task Breakdown</h4>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(statusCounts) as [string, number][]).map(([status, count]) => (
                <div key={status} className="rounded-lg border p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="size-2 rounded-full" style={{ backgroundColor: taskStatusColor(status as DrawerTask["status"]) }} />
                    <span className="text-[10px] text-muted-foreground">{status}</span>
                  </div>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Team</h4>
            <div className="flex flex-wrap gap-2">
              {teamInitials.map((init) => {
                const member = getMember(init)
                if (!member) return null
                return (
                  <button key={init} onClick={() => openDrawer("member", init)} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 hover:bg-muted/60 transition-colors">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">{init}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{member.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Recent activity */}
          <div>
            <h4 className="text-sm font-semibold mb-2.5">Recent Activity</h4>
            <div className="space-y-2.5">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5">
                  <Avatar className="size-6 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">{act.user}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">
                      <button onClick={() => openDrawer("member", act.user)} className="font-semibold hover:text-primary transition-colors">{act.userName}</button>
                      {" "}<span className="text-muted-foreground">{act.action}</span>{" "}
                      <EntityChip type="task" variant="subtle" className="text-xs" entityId={act.taskId}>{act.target}</EntityChip>
                    </p>
                    <span className="text-[10px] text-muted-foreground">{act.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-5 py-3">
        <Button className="gap-2" onClick={handleOpenReport}>
          <FolderKanban className="size-3.5" />
          Open Report
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Note Preview Panel — Amber Identity
// ---------------------------------------------------------------------------

function NotePreviewPanel({ noteId }: { noteId: string }) {
  const note = getNote(noteId)
  const { openDrawer } = useDrawer()
  const setActiveView = useNavStore((s) => s.setActiveView)
  const setSelectedNoteId = useNavStore((s) => s.setSelectedNoteId)

  if (!note) {
    return <div className="flex items-center justify-center py-16"><p className="text-sm text-muted-foreground">Note not found</p></div>
  }

  const previewBody = note.body.length > 300 ? note.body.slice(0, 300) + "..." : note.body

  const handleOpenFullNote = () => {
    setSelectedNoteId(noteId)
    setActiveView("notes")
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        {/* ── Amber Header ── */}
        <div className="bg-amber-500/[0.08] px-5 pt-4 pb-5 space-y-3.5">
          <div className="flex items-start gap-3">
            <FileText className="size-6 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold leading-tight">{note.title}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="size-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{note.date}</span>
              </div>
            </div>
          </div>

          {/* Prominent Tag Chips — hero element */}
          <div className="flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <span
                key={tag.label}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${tag.color}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-4 pb-6 space-y-4">
          <Separator />

          {/* Preview body */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Preview</h4>
            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-foreground">
              <ReactMarkdown>{previewBody}</ReactMarkdown>
            </article>
          </div>

          <Separator />

          {/* Linked Tasks */}
          {note.linkedTaskIds.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="size-3.5 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Linked Tasks</h4>
                <Badge variant="secondary" className="text-[10px]">{note.linkedTaskIds.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {note.linkedTaskIds.map((taskId) => {
                  const task = getTask(taskId)
                  if (!task) return null
                  return (
                    <button key={taskId} onClick={() => openDrawer("task", taskId)} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium hover:bg-muted/60 transition-colors">
                      <span className={`inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold ${priorityBadgeStyle(task.priority)}`}>{task.priority}</span>
                      {task.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Linked Notes */}
          {note.linkedNoteIds.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="size-3.5 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Linked Notes</h4>
                <Badge variant="secondary" className="text-[10px]">{note.linkedNoteIds.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {note.linkedNoteIds.map((linkedId) => {
                  const linkedNote = getNote(linkedId)
                  if (!linkedNote) return null
                  return (
                    <button key={linkedId} onClick={() => openDrawer("note", linkedId)} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium hover:bg-muted/60 transition-colors">
                      <FileText className="size-3 text-amber-500" />
                      {linkedNote.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-5 py-3">
        <Button className="gap-2" onClick={handleOpenFullNote}>
          <ExternalLink className="size-3.5" />
          Open Full Note
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Member Panel — Blue Identity
// ---------------------------------------------------------------------------

function MemberPanel({ memberInitials }: { memberInitials: string }) {
  const member = getMember(memberInitials)
  const { openDrawer } = useDrawer()

  if (!member) {
    return <div className="flex items-center justify-center py-16"><p className="text-sm text-muted-foreground">Member not found</p></div>
  }

  const memberTasks = member.taskIds.map((id) => getTask(id)).filter(Boolean) as DrawerTask[]
  const activeTasks = memberTasks.filter((t) => t.status !== "Done").length

  const priorityCounts = {
    High: memberTasks.filter((t) => t.priority === "High").length,
    Medium: memberTasks.filter((t) => t.priority === "Medium").length,
    Low: memberTasks.filter((t) => t.priority === "Low").length,
  }

  const currentTasks = memberTasks.filter((t) => t.status !== "Done").slice(0, 6)

  const recentActivity = memberTasks.slice(0, 3).map((t, i) => ({
    id: `ma-${i}`,
    action: t.status === "Done" ? "completed" : "updated",
    target: t.title,
    taskId: t.id,
    project: t.projectName,
    projectColor: t.projectColor,
    timestamp: i === 0 ? "2h ago" : i === 1 ? "5h ago" : "1d ago",
  }))

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        {/* ── Blue Header with centered avatar hero ── */}
        <div className="bg-blue-500/[0.08] px-5 pt-6 pb-5">
          <div className="flex flex-col items-center text-center">
            {/* Large avatar — hero element */}
            <Avatar className="size-16 shrink-0 ring-2 ring-blue-200 dark:ring-blue-800 ring-offset-2 ring-offset-background">
              <AvatarFallback
                className="text-xl font-bold text-white"
                style={{ backgroundColor: member.color }}
              >
                {member.initials}
              </AvatarFallback>
            </Avatar>

            {/* Name + availability */}
            <div className="mt-3 flex items-center gap-2">
              <h3 className="text-lg font-semibold">{member.name}</h3>
              <AvailabilityDot activeTasks={activeTasks} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{member.role}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Task count by priority */}
          <div>
            <h4 className="text-sm font-semibold mb-2.5">Tasks by Priority</h4>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(priorityCounts) as [string, number][]).map(([priority, count]) => (
                <div key={priority} className="rounded-lg border p-2.5 text-center">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold mb-1 ${priorityBadgeStyle(priority as "High" | "Medium" | "Low")}`}>
                    {priority}
                  </span>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Current tasks */}
          {currentTasks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2.5">Current Tasks</h4>
              <div className="space-y-1.5">
                {currentTasks.map((task) => (
                  <button key={task.id} onClick={() => openDrawer("task", task.id)} className="w-full text-left flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 transition-colors">
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: taskStatusColor(task.status) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">{task.projectName}</p>
                    </div>
                    <span className={`inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold shrink-0 ${priorityBadgeStyle(task.priority)}`}>
                      {task.priority}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Recent activity */}
          <div>
            <h4 className="text-sm font-semibold mb-2.5">Recent Activity</h4>
            <div className="space-y-2.5">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5">
                  <span className="size-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: act.projectColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">
                      <span className="capitalize text-muted-foreground">{act.action}</span>{" "}
                      <EntityChip type="task" variant="subtle" className="text-xs" entityId={act.taskId}>{act.target}</EntityChip>
                    </p>
                    <span className="text-[10px] text-muted-foreground">{act.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsed View — shows entity type icon with color identity
// ---------------------------------------------------------------------------

function CollapsedDrawerView({ type, id }: { type: DrawerType; id: string }) {
  const getEntityLabel = (): string => {
    switch (type) {
      case "task": return getTask(id)?.title ?? "Task"
      case "project": return getProject(id)?.name ?? "Project"
      case "note": return getNote(id)?.title ?? "Note"
      case "member": return getMember(id)?.name ?? "Member"
    }
    return "Unknown"
  }

  const bgColor = (() => {
    switch (type) {
      case "task": return "bg-violet-500/10"
      case "project": return "bg-primary/10"
      case "note": return "bg-amber-500/10"
      case "member": return "bg-blue-500/10"
    }
    return "bg-muted"
  })()

  return (
    <div className="flex flex-col items-center h-full py-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg ${bgColor} cursor-default`}>
            <EntityTypeIcon type={type} />
            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              {entityTypeLabel(type)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          <p className="text-xs max-w-[200px] truncate">{getEntityLabel()}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Universal Drawer — Inline Collapsible Panel with Navigation History
// ---------------------------------------------------------------------------

const DRAWER_EXPANDED_WIDTH = 512
const DRAWER_COLLAPSED_WIDTH = 48

// Animation variants for directional sliding
const panelVariants = {
  enter: (direction: number) => ({
    x: direction * 40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction * -40,
    opacity: 0,
  }),
}

export function UniversalDrawer() {
  const { state, currentEntry, closeDrawer, toggleCollapsed, goBack, goForward } = useDrawer()
  const { open, collapsed, direction } = state
  const type = currentEntry?.type ?? null
  const id = currentEntry?.id ?? null

  // Keyboard shortcuts: Alt+Left = back, Alt+Right = forward
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault()
        goBack()
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault()
        goForward()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, goBack, goForward])

  const renderPanel = () => {
    if (!type || !id) return null
    switch (type) {
      case "task": return <TaskDetailPanel taskId={id} />
      case "project": return <ProjectOverviewPanel projectId={id} />
      case "note": return <NotePreviewPanel noteId={id} />
      case "member": return <MemberPanel memberInitials={id} />
    }
  }

  if (!open) return null

  // Per-type left border color
  const leftBorder = type ? entityBorderColor(type) : ""

  // Unique key for AnimatePresence — changes when the current entry changes
  const panelKey = currentEntry ? `${currentEntry.type}-${currentEntry.id}-${state.historyIndex}` : "empty"

  return (
    <TooltipProvider delayDuration={300}>
    <div
      className={`relative shrink-0 h-full border-l border-border border-l-4 ${leftBorder} bg-background transition-all duration-200 ease-in-out overflow-hidden`}
      style={{ width: collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_EXPANDED_WIDTH }}
    >
      {/* Toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleCollapsed}
            className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 size-7 rounded-full border border-border bg-background shadow-sm hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            {collapsed ? (
              <ChevronLeft className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={12}>
          <p className="text-xs">{collapsed ? "Expand panel" : "Collapse panel"}</p>
        </TooltipContent>
      </Tooltip>

      {collapsed ? (
        <CollapsedDrawerView type={type!} id={id!} />
      ) : (
        <div className="flex flex-col h-full">
          {/* Navigation bar with back/forward/breadcrumbs/close */}
          <NavigationBar />

          {/* Panel content with slide animation */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={panelKey}
                custom={direction}
                variants={panelVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "tween", duration: 0.2, ease: "easeInOut" },
                  opacity: { duration: 0.15 },
                }}
                className="absolute inset-0"
              >
                {renderPanel()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}
