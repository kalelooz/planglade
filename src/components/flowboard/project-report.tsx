"use client"

import * as React from "react"
import {
  ArrowLeft,
  Printer,
  ListChecks,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNavStore } from "@/components/flowboard/nav-store"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { toast } from "sonner"
import { useDrawer } from "@/components/flowboard/drawer-context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectStatus = "Active" | "On Hold" | "Completed"
type Priority = "High" | "Medium" | "Low"
type TaskStatus = "Backlog" | "In Progress" | "In Review" | "Done"

interface ProjectTask {
  id: string
  title: string
  priority: Priority
  status: TaskStatus
  assignee: string
  assigneeName: string
  dueDate: string
}

interface ProjectInfo {
  id: string
  name: string
  color: string
  status: ProjectStatus
  progress: number
  owner: string
  ownerName: string
  startDate: string
  endDate: string
  tasks: ProjectTask[]
}

// ---------------------------------------------------------------------------
// Mock Project Data
// ---------------------------------------------------------------------------

const projectsData: ProjectInfo[] = [
  {
    id: "P1",
    name: "Website Redesign",
    color: "#01696f",
    status: "Active",
    progress: 72,
    owner: "AM",
    ownerName: "Alex Morgan",
    startDate: "Apr 1, 2026",
    endDate: "May 28, 2026",
    tasks: [
      { id: "T1", title: "Define color palette & tokens", priority: "Medium", status: "Backlog", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 5" },
      { id: "T2", title: "Write SEO metadata for all pages", priority: "Low", status: "Backlog", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10" },
      { id: "T3", title: "Research analytics integration", priority: "Low", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 12" },
      { id: "T4", title: "Build responsive navigation", priority: "High", status: "In Progress", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20" },
      { id: "T5", title: "Design contact page layout", priority: "Medium", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 22" },
      { id: "T6", title: "Implement auth API endpoints", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 19" },
      { id: "T7", title: "Hero section with animations", priority: "High", status: "In Review", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 18" },
      { id: "T8", title: "Footer component & links", priority: "Low", status: "In Review", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 21" },
      { id: "T9", title: "Accessibility audit pass 1", priority: "Medium", status: "In Review", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 23" },
      { id: "T10", title: "Project scaffolding & CI/CD", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 10" },
      { id: "T11", title: "Wireframes for all key pages", priority: "Medium", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8" },
      { id: "T12", title: "Brand guidelines document", priority: "Low", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5" },
      { id: "T13", title: "User interview synthesis", priority: "Medium", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 3" },
    ],
  },
  {
    id: "P2",
    name: "Mobile App v2",
    color: "#8b5cf6",
    status: "Active",
    progress: 45,
    owner: "SK",
    ownerName: "Sara Kim",
    startDate: "Apr 15, 2026",
    endDate: "Jun 15, 2026",
    tasks: [
      { id: "M1", title: "User auth flow design", priority: "High", status: "Done", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 5" },
      { id: "M2", title: "Onboarding screen redesign", priority: "High", status: "In Progress", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 25" },
      { id: "M3", title: "Push notification integration", priority: "Medium", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 1" },
      { id: "M4", title: "Offline mode support", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 28" },
      { id: "M5", title: "App store listing copy", priority: "Low", status: "Backlog", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10" },
      { id: "M6", title: "Beta testing plan", priority: "Medium", status: "In Review", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 22" },
      { id: "M7", title: "Performance profiling", priority: "High", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 5" },
      { id: "M8", title: "Dark mode polish", priority: "Low", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 12" },
      { id: "M9", title: "Accessibility labels", priority: "Medium", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 30" },
    ],
  },
  {
    id: "P3",
    name: "API Migration",
    color: "#f59e0b",
    status: "Completed",
    progress: 90,
    owner: "JD",
    ownerName: "Jake Davis",
    startDate: "Mar 10, 2026",
    endDate: "May 20, 2026",
    tasks: [
      { id: "A1", title: "JWT auth implementation", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 15" },
      { id: "A2", title: "Cursor-based pagination", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 20" },
      { id: "A3", title: "Rate limiting middleware", priority: "Medium", status: "In Review", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 18" },
      { id: "A4", title: "Deprecation headers", priority: "Low", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25" },
      { id: "A5", title: "Migration guide documentation", priority: "High", status: "In Progress", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 22" },
      { id: "A6", title: "Consumer notification emails", priority: "Medium", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 1" },
      { id: "A7", title: "Load testing v3 endpoints", priority: "Medium", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10" },
      { id: "A8", title: "Rollback procedure", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 25" },
    ],
  },
  {
    id: "P4",
    name: "Design System",
    color: "#ec4899",
    status: "On Hold",
    progress: 30,
    owner: "LP",
    ownerName: "Lisa Park",
    startDate: "May 1, 2026",
    endDate: "Jul 1, 2026",
    tasks: [
      { id: "D1", title: "Design tokens specification", priority: "High", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 20" },
      { id: "D2", title: "Figma component library", priority: "High", status: "Backlog", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 1" },
      { id: "D3", title: "Code generation pipeline", priority: "Medium", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 15" },
      { id: "D4", title: "Color system documentation", priority: "Medium", status: "In Review", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 18" },
      { id: "D5", title: "Typography scale", priority: "Low", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8" },
      { id: "D6", title: "Spacing & grid system", priority: "Low", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 10" },
    ],
  },
  {
    id: "P5",
    name: "Analytics Dashboard",
    color: "#10b981",
    status: "Active",
    progress: 58,
    owner: "RC",
    ownerName: "Raj Chen",
    startDate: "Apr 20, 2026",
    endDate: "Jun 22, 2026",
    tasks: [
      { id: "R1", title: "Chart widget library", priority: "High", status: "In Progress", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25" },
      { id: "R2", title: "Data aggregation API", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 22" },
      { id: "R3", title: "Dashboard layout system", priority: "Medium", status: "In Review", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20" },
      { id: "R4", title: "Export to PDF feature", priority: "Medium", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 5" },
      { id: "R5", title: "Real-time data streaming", priority: "High", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 10" },
      { id: "R6", title: "Filter & drill-down UI", priority: "Medium", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 8" },
      { id: "R7", title: "KPI card components", priority: "Low", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10" },
      { id: "R8", title: "User preference storage", priority: "Low", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5" },
      { id: "R9", title: "Embeddable widget SDK", priority: "Low", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 20" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeStyle(status: ProjectStatus) {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    case "On Hold":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    case "Completed":
      return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800"
  }
}

function priorityBadgeStyle(priority: Priority) {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
}

/** Status colors matching the Kanban column accent colors */
const STATUS_COLORS: Record<TaskStatus, string> = {
  Backlog: "#9ca3af",
  "In Progress": "#01696f",
  "In Review": "#f59e0b",
  Done: "#10b981",
}

const priorityOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

/** Generate burndown data for the last 14 days */
function generateBurndownData(totalTasks: number, completedCount: number) {
  const data: { day: string; remaining: number }[] = []
  const today = new Date()
  const remaining0 = totalTasks
  const remaining14 = totalTasks - completedCount

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    // Linear interpolation with slight randomness for realism
    const progress = (13 - i) / 13
    const noise = Math.sin(i * 1.5) * 0.8
    const remaining = Math.max(
      remaining14,
      Math.round(remaining0 - (remaining0 - remaining14) * progress + noise)
    )
    data.push({ day: dayLabel, remaining })
  }
  return data
}

// ---------------------------------------------------------------------------
// Project Report Component with TanStack Table
// ---------------------------------------------------------------------------

export function ProjectReport() {
  const storeProjectId = useNavStore((s) => s.selectedProjectId)
  const setSelectedProjectId = useNavStore((s) => s.setSelectedProjectId)
  const setActiveView = useNavStore((s) => s.setActiveView)
  const { openDrawer } = useDrawer()

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "priority", desc: false },
  ])
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  // Find project by ID, fallback to first
  const project = projectsData.find((p) => p.id === storeProjectId) ?? projectsData[0]

  const handleBack = () => {
    setSelectedProjectId(null)
    setActiveView("dashboard")
    toast.info("Returned to Home")
  }

  // KPI calculations
  const totalTasks = project.tasks.length
  const completed = project.tasks.filter((t) => t.status === "Done").length
  const inProgress = project.tasks.filter((t) => t.status === "In Progress").length
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = project.tasks.filter((t) => {
    if (t.status === "Done") return false
    const parsed = new Date(`${t.dueDate}, 2026`)
    if (isNaN(parsed.getTime())) return false
    parsed.setHours(0, 0, 0, 0)
    return parsed < today
  }).length

  // Chart data
  const burndownData = generateBurndownData(totalTasks, completed)

  const statusBreakdown = (["Backlog", "In Progress", "In Review", "Done"] as TaskStatus[]).map(
    (status) => ({
      name: status,
      value: project.tasks.filter((t) => t.status === status).length,
      color: STATUS_COLORS[status],
    })
  )

  // Team workload: count tasks per assignee
  const assigneeMap = new Map<string, { name: string; count: number }>()
  for (const task of project.tasks) {
    const existing = assigneeMap.get(task.assignee)
    if (existing) {
      existing.count++
    } else {
      assigneeMap.set(task.assignee, {
        name: task.assigneeName,
        count: 1,
      })
    }
  }
  const workloadData = Array.from(assigneeMap.values())
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ name: m.name, tasks: m.count }))

  // Filter tasks by status
  const filteredTasks = React.useMemo(() => {
    if (statusFilter === "all") return project.tasks
    return project.tasks.filter((t) => t.status === statusFilter)
  }, [project.tasks, statusFilter])

  // Column definitions
  const columns = React.useMemo<ColumnDef<ProjectTask, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Task",
        cell: ({ row }) => (
          <EntityChip type="task" variant="subtle" className="text-sm font-medium" entityId={row.original.id}>
            {row.original.title}
          </EntityChip>
        ),
      },
      {
        accessorKey: "priority",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Priority
              {sorted === "asc" ? (
                <ArrowUp className="size-3 text-primary" />
              ) : sorted === "desc" ? (
                <ArrowDown className="size-3 text-primary" />
              ) : (
                <ArrowUpDown className="size-3 text-muted-foreground/50" />
              )}
            </button>
          )
        },
        sortingFn: (rowA, rowB) => {
          return priorityOrder[rowA.original.priority] - priorityOrder[rowB.original.priority]
        },
        cell: ({ row }) => (
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(row.original.priority)}`}>
            {row.original.priority}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Status
              {sorted === "asc" ? (
                <ArrowUp className="size-3 text-primary" />
              ) : sorted === "desc" ? (
                <ArrowDown className="size-3 text-primary" />
              ) : (
                <ArrowUpDown className="size-3 text-muted-foreground/50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[row.original.status] }}
            />
            <span className="text-sm">{row.original.status}</span>
          </div>
        ),
      },
      {
        accessorKey: "assigneeName",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Assignee
              {sorted === "asc" ? (
                <ArrowUp className="size-3 text-primary" />
              ) : sorted === "desc" ? (
                <ArrowDown className="size-3 text-primary" />
              ) : (
                <ArrowUpDown className="size-3 text-muted-foreground/50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar
              className="size-6 cursor-pointer"
              onClick={() => openDrawer("member", row.original.assignee)}
            >
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {row.original.assignee}
              </AvatarFallback>
            </Avatar>
            <EntityChip type="user" variant="subtle" className="text-sm" entityId={row.original.assignee}>
              {row.original.assigneeName}
            </EntityChip>
          </div>
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Due Date
              {sorted === "asc" ? (
                <ArrowUp className="size-3 text-primary" />
              ) : sorted === "desc" ? (
                <ArrowDown className="size-3 text-primary" />
              ) : (
                <ArrowUpDown className="size-3 text-muted-foreground/50" />
              )}
            </button>
          )
        },
        cell: ({ row }) => (
          <span className={`text-sm ${(() => {
            if (row.original.status === "Done") return "text-muted-foreground"
            const parsed = new Date(`${row.original.dueDate}, 2026`)
            if (isNaN(parsed.getTime())) return "text-muted-foreground"
            const t = new Date()
            t.setHours(0, 0, 0, 0)
            parsed.setHours(0, 0, 0, 0)
            return parsed < t ? "text-destructive font-medium" : "text-muted-foreground"
          })()}`}>
            {row.original.dueDate}
          </span>
        ),
      },
    ],
    [openDrawer]
  )

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handleExportReport = () => {
    window.print()
    toast.success("Report exported", {
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      description: `${project.name} report sent to printer`,
    })
  }

  return (
    <div className="grid gap-6 print-content">
      {/* ── Header ── */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleBack}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to Home</span>
          </Button>
          <div className="flex items-center gap-3">
            <span className="size-3.5 rounded-full" style={{ backgroundColor: project.color }} />
            <h2 className="text-lg font-semibold tracking-tight">{project.name}</h2>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeStyle(project.status)}`}>
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="size-6 cursor-pointer" onClick={() => openDrawer("member", project.owner)}>
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {project.owner}
              </AvatarFallback>
            </Avatar>
            <EntityChip type="user" variant="subtle" entityId={project.owner}>{project.ownerName}</EntityChip>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">{project.startDate} — {project.endDate}</span>
          <Separator orientation="vertical" className="h-5" />
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExportReport}>
            <Printer className="size-3.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print-header">
        <div className="flex items-center gap-3 mb-2">
          <span className="size-3.5 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{project.name}</h1>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}> — {project.status} · {project.ownerName} · {project.startDate} — {project.endDate}</span>
        </div>
        <hr style={{ marginBottom: "1rem" }} />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold tracking-tight">{totalTasks}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <ListChecks className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{completed}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-emerald-500/20">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${totalTasks ? Math.round((completed / totalTasks) * 100) : 0}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{totalTasks ? Math.round((completed / totalTasks) * 100) : 0}% completion rate</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold tracking-tight text-primary">{inProgress}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className={`text-2xl font-bold tracking-tight ${overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{overdue}</p>
              </div>
              <div className={`flex size-10 items-center justify-center rounded-lg ${overdue > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`size-5 ${overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Burndown Chart */}
        <Card className="lg:col-span-2 py-0">
          <CardHeader className="pt-5">
            <CardTitle className="text-base">Burndown Chart</CardTitle>
            <p className="text-xs text-muted-foreground">Remaining tasks over the last 14 days</p>
          </CardHeader>
          <CardContent className="pb-5">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={burndownData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke={project.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: project.color, stroke: "var(--background)", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: project.color }}
                  name="Remaining"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="py-0">
          <CardHeader className="pt-5">
            <CardTitle className="text-base">Task Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Tasks by status</p>
          </CardHeader>
          <CardContent className="pb-5 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              {statusBreakdown.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Team Workload Bar Chart ── */}
      <Card className="py-0">
        <CardHeader className="pt-5">
          <CardTitle className="text-base">Team Workload</CardTitle>
          <p className="text-xs text-muted-foreground">Task count per team member</p>
        </CardHeader>
        <CardContent className="pb-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={workloadData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
              />
              <Bar dataKey="tasks" fill={project.color} radius={[4, 4, 0, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Task List Table (TanStack Table) ── */}
      <Card className="py-0">
        <CardHeader className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All Tasks</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{filteredTasks.length} tasks for {project.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Status filter dropdown */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Filter className="size-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Backlog">Backlog</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="In Review">In Review</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{project.progress}% complete</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No tasks matching this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => openDrawer("task", row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
