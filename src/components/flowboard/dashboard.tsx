"use client"

import * as React from "react"
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Circle,
  Inbox,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useWorkspaceStore } from "@/components/flowboard/workspace-store"
import {
  selectHomeSections,
  type WorkspaceProject,
  type WorkspaceTask,
} from "@/components/flowboard/workspace-model"

type DashboardFocus = "home" | "inbox"

function priorityBadgeStyle(priority: WorkspaceTask["priority"]) {
  switch (priority) {
    case "High":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
    case "Medium":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
    case "Low":
      return "border-border bg-muted text-muted-foreground"
  }
}

function projectName(projectsById: Map<string, WorkspaceProject>, task: WorkspaceTask) {
  if (!task.projectId) return "Inbox"
  return projectsById.get(task.projectId)?.name ?? "Project"
}

function projectColor(projectsById: Map<string, WorkspaceProject>, task: WorkspaceTask) {
  if (!task.projectId) return "var(--muted-foreground)"
  return projectsById.get(task.projectId)?.color ?? "var(--muted-foreground)"
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) return null
  const date = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dueDate
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date)
}

function QuickCapture() {
  const [title, setTitle] = React.useState("")
  const quickCaptureTask = useWorkspaceStore((state) => state.quickCaptureTask)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const task = quickCaptureTask(title)
    if (!task) {
      toast.error("Add a task title first")
      return
    }

    setTitle("")
    toast.success("Added to Inbox", {
      description: task.title,
    })
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task, note, or reminder..."
            className="h-11 bg-background text-base sm:text-sm"
            aria-label="Quick capture"
          />
          <Button type="submit" className="h-11 shrink-0 gap-2">
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function StatStrip({
  counts,
}: {
  counts: ReturnType<typeof selectHomeSections>["counts"]
}) {
  const stats = [
    { label: "Today", value: counts.today, icon: CalendarClock },
    { label: "Overdue", value: counts.overdue, icon: AlertTriangle },
    { label: "Inbox", value: counts.inbox, icon: Inbox },
    { label: "Open", value: counts.openTasks, icon: Archive },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-h-20 items-center justify-between rounded-lg border bg-card px-4 py-3"
        >
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{stat.value}</p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <stat.icon className="size-4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskRow({
  task,
  projectsById,
}: {
  task: WorkspaceTask
  projectsById: Map<string, WorkspaceProject>
}) {
  const toggleTaskDone = useWorkspaceStore((state) => state.toggleTaskDone)
  const dueDate = formatDueDate(task.dueDate)

  return (
    <div className="flex items-start gap-3 py-3">
      <button
        type="button"
        onClick={() => toggleTaskDone(task.id)}
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        aria-label={`Complete ${task.title}`}
      >
        {task.status === "Done" ? (
          <CheckCircle2 className="size-5 fill-primary text-primary" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5">{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: projectColor(projectsById, task) }}
            />
            {projectName(projectsById, task)}
          </span>
          {dueDate ? <span>{dueDate}</span> : null}
        </div>
      </div>
      <Badge variant="outline" className={priorityBadgeStyle(task.priority)}>
        {task.priority}
      </Badge>
    </div>
  )
}

function TaskSection({
  title,
  description,
  tasks,
  projectsById,
  emptyLabel,
}: {
  title: string
  description: string
  tasks: WorkspaceTask[]
  projectsById: Map<string, WorkspaceProject>
  emptyLabel: string
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div>
            {tasks.map((task, index) => (
              <React.Fragment key={task.id}>
                <TaskRow task={task} projectsById={projectsById} />
                {index < tasks.length - 1 ? <Separator /> : null}
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function Dashboard({ focus = "home" }: { focus?: DashboardFocus }) {
  const tasks = useWorkspaceStore((state) => state.tasks)
  const projects = useWorkspaceStore((state) => state.projects)

  const projectsById = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const home = React.useMemo(
    () => selectHomeSections({ tasks, projects }, new Date()),
    [tasks, projects]
  )

  if (focus === "inbox") {
    return (
      <div className="grid gap-5">
        <QuickCapture />
        <TaskSection
          title="Inbox"
          description="Unassigned work captured from anywhere."
          tasks={home.inbox}
          projectsById={projectsById}
          emptyLabel="Inbox is clear."
        />
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <QuickCapture />
      <StatStrip counts={home.counts} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-5">
          <TaskSection
            title="Today"
            description="Due today and still open."
            tasks={home.today}
            projectsById={projectsById}
            emptyLabel="Nothing due today."
          />
          <TaskSection
            title="Overdue"
            description="Needs attention before new work."
            tasks={home.overdue}
            projectsById={projectsById}
            emptyLabel="No overdue tasks."
          />
        </div>
        <TaskSection
          title="Inbox"
          description="Captured work waiting to be organized."
          tasks={home.inbox}
          projectsById={projectsById}
          emptyLabel="Inbox is clear."
        />
      </div>
    </div>
  )
}

export function InboxView() {
  return <Dashboard focus="inbox" />
}
