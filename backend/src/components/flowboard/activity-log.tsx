"use client"

import * as React from "react"
import {
  Download,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
} from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { useDrawer } from "@/components/flowboard/drawer-context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionType = "created" | "updated" | "moved" | "commented" | "completed" | "assigned" | "deleted"
type EntityType = "task" | "project" | "note"

interface ActivityEntry {
  id: string
  timestamp: Date
  user: string
  userName: string
  action: ActionType
  entityName: string
  entityType: EntityType
  entityId: string
  project: string
  projectId: string
  projectColor: string
}

// ---------------------------------------------------------------------------
// Action styling
// ---------------------------------------------------------------------------

const actionColors: Record<ActionType, string> = {
  completed: "border-l-emerald-500 dark:border-l-emerald-400",
  created: "border-l-primary",
  updated: "border-l-amber-500 dark:border-l-amber-400",
  deleted: "border-l-red-500 dark:border-l-red-400",
  commented: "border-l-gray-400 dark:border-l-gray-500",
  moved: "border-l-sky-500 dark:border-l-sky-400",
  assigned: "border-l-violet-500 dark:border-l-violet-400",
}

const actionBadges: Record<ActionType, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  created: "bg-primary/10 text-primary",
  updated: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  deleted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  commented: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  moved: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  assigned: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
}

// ---------------------------------------------------------------------------
// Mock Data — 20 activity entries
// ---------------------------------------------------------------------------

const NOW = new Date()
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())
const YESTERDAY = new Date(TODAY.getTime() - 86400000)
const MAY_14 = new Date(2026, 4, 14)
const MAY_13 = new Date(2026, 4, 13)
const MAY_12 = new Date(2026, 4, 12)

function makeTime(date: Date, hours: number, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
}

const mockActivities: ActivityEntry[] = [
  // Today — 6 entries
  {
    id: "a1",
    timestamp: makeTime(TODAY, 9, 15),
    user: "SK",
    userName: "Sara Kim",
    action: "completed",
    entityName: "Hero section with animations",
    entityType: "task",
    entityId: "T7",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a2",
    timestamp: makeTime(TODAY, 10, 2),
    user: "JD",
    userName: "Jake Davis",
    action: "created",
    entityName: "Rate limiting middleware",
    entityType: "task",
    entityId: "A3",
    project: "API Migration",
    projectId: "P3",
    projectColor: "#f59e0b",
  },
  {
    id: "a3",
    timestamp: makeTime(TODAY, 10, 45),
    user: "LP",
    userName: "Lisa Park",
    action: "updated",
    entityName: "Design Brief — Mobile v2",
    entityType: "note",
    entityId: "N3",
    project: "Mobile App v2",
    projectId: "P2",
    projectColor: "#8b5cf6",
  },
  {
    id: "a4",
    timestamp: makeTime(TODAY, 11, 30),
    user: "AM",
    userName: "Alex Morgan",
    action: "commented",
    entityName: "Footer component & links",
    entityType: "task",
    entityId: "T8",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a5",
    timestamp: makeTime(TODAY, 13, 10),
    user: "RC",
    userName: "Raj Chen",
    action: "moved",
    entityName: "Accessibility audit pass 1",
    entityType: "task",
    entityId: "T9",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a6",
    timestamp: makeTime(TODAY, 14, 20),
    user: "SK",
    userName: "Sara Kim",
    action: "assigned",
    entityName: "Push Notifications",
    entityType: "task",
    entityId: "M3",
    project: "Mobile App v2",
    projectId: "P2",
    projectColor: "#8b5cf6",
  },

  // Yesterday — 5 entries
  {
    id: "a7",
    timestamp: makeTime(YESTERDAY, 9, 0),
    user: "JD",
    userName: "Jake Davis",
    action: "completed",
    entityName: "Implement auth API endpoints",
    entityType: "task",
    entityId: "T6",
    project: "API Migration",
    projectId: "P3",
    projectColor: "#f59e0b",
  },
  {
    id: "a8",
    timestamp: makeTime(YESTERDAY, 10, 30),
    user: "AM",
    userName: "Alex Morgan",
    action: "created",
    entityName: "Analytics Dashboard",
    entityType: "project",
    entityId: "P5",
    project: "Analytics Dashboard",
    projectId: "P5",
    projectColor: "#10b981",
  },
  {
    id: "a9",
    timestamp: makeTime(YESTERDAY, 11, 15),
    user: "LP",
    userName: "Lisa Park",
    action: "updated",
    entityName: "Design System",
    entityType: "project",
    entityId: "P4",
    project: "Design System",
    projectId: "P4",
    projectColor: "#ec4899",
  },
  {
    id: "a10",
    timestamp: makeTime(YESTERDAY, 14, 0),
    user: "RC",
    userName: "Raj Chen",
    action: "deleted",
    entityName: "Legacy analytics doc",
    entityType: "note",
    entityId: "N4",
    project: "Analytics Dashboard",
    projectId: "P5",
    projectColor: "#10b981",
  },
  {
    id: "a11",
    timestamp: makeTime(YESTERDAY, 16, 45),
    user: "SK",
    userName: "Sara Kim",
    action: "commented",
    entityName: "Q3 Product Roadmap",
    entityType: "note",
    entityId: "N1",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },

  // May 14 — 4 entries
  {
    id: "a12",
    timestamp: makeTime(MAY_14, 8, 30),
    user: "AM",
    userName: "Alex Morgan",
    action: "created",
    entityName: "Q3 Product Roadmap",
    entityType: "note",
    entityId: "N1",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a13",
    timestamp: makeTime(MAY_14, 10, 0),
    user: "JD",
    userName: "Jake Davis",
    action: "assigned",
    entityName: "Endpoint Migration",
    entityType: "task",
    entityId: "A2",
    project: "API Migration",
    projectId: "P3",
    projectColor: "#f59e0b",
  },
  {
    id: "a14",
    timestamp: makeTime(MAY_14, 11, 20),
    user: "LP",
    userName: "Lisa Park",
    action: "completed",
    entityName: "Wireframes for all key pages",
    entityType: "task",
    entityId: "T11",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a15",
    timestamp: makeTime(MAY_14, 15, 0),
    user: "RC",
    userName: "Raj Chen",
    action: "updated",
    entityName: "User Research Findings",
    entityType: "note",
    entityId: "N4",
    project: "Analytics Dashboard",
    projectId: "P5",
    projectColor: "#10b981",
  },

  // May 13 — 3 entries
  {
    id: "a16",
    timestamp: makeTime(MAY_13, 9, 10),
    user: "SK",
    userName: "Sara Kim",
    action: "moved",
    entityName: "Build responsive navigation",
    entityType: "task",
    entityId: "T4",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
  {
    id: "a17",
    timestamp: makeTime(MAY_13, 12, 30),
    user: "AM",
    userName: "Alex Morgan",
    action: "commented",
    entityName: "Team Meeting Notes",
    entityType: "note",
    entityId: "N2",
    project: "Mobile App v2",
    projectId: "P2",
    projectColor: "#8b5cf6",
  },
  {
    id: "a18",
    timestamp: makeTime(MAY_13, 14, 0),
    user: "JD",
    userName: "Jake Davis",
    action: "created",
    entityName: "API Deprecation Plan",
    entityType: "note",
    entityId: "N5",
    project: "API Migration",
    projectId: "P3",
    projectColor: "#f59e0b",
  },

  // May 12 — 2 entries
  {
    id: "a19",
    timestamp: makeTime(MAY_12, 10, 0),
    user: "LP",
    userName: "Lisa Park",
    action: "created",
    entityName: "Design Tokens",
    entityType: "task",
    entityId: "D1",
    project: "Design System",
    projectId: "P4",
    projectColor: "#ec4899",
  },
  {
    id: "a20",
    timestamp: makeTime(MAY_12, 16, 0),
    user: "RC",
    userName: "Raj Chen",
    action: "completed",
    entityName: "User interview synthesis",
    entityType: "task",
    entityId: "T13",
    project: "Website Redesign",
    projectId: "P1",
    projectColor: "#01696f",
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uniqueUsers = Array.from(new Set(mockActivities.map((a) => a.userName))).sort()
const uniqueProjects = Array.from(new Set(mockActivities.map((a) => a.project))).sort()
const uniqueActions: ActionType[] = ["created", "updated", "moved", "commented", "completed", "assigned", "deleted"]

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

/** Map EntityType to EntityChip type */
function entityChipType(type: EntityType): "user" | "task" | "project" | "note" {
  return type
}

/** Export filtered activities as CSV using native JS */
function exportCSV(entries: ActivityEntry[]) {
  const headers = ["Timestamp", "User", "Action", "Entity", "Entity Type", "Project"]
  const rows = entries.map((e) => [
    e.timestamp.toISOString(),
    e.userName,
    e.action,
    `"${e.entityName.replace(/"/g, '""')}"`,
    e.entityType,
    `"${e.project.replace(/"/g, '""')}"`,
  ])

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `flowboard-activity-log-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
  toast.success("Activity log exported", {
    icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    description: `${entries.length} ${entries.length === 1 ? "entry" : "entries"} saved as CSV`,
  })
}

// ---------------------------------------------------------------------------
// Date Range type
// ---------------------------------------------------------------------------

type DateRange = "all" | "today" | "yesterday" | "7d" | "30d"

function filterByDateRange(entries: ActivityEntry[], range: DateRange): ActivityEntry[] {
  if (range === "all") return entries
  const cutoff = new Date(TODAY)
  switch (range) {
    case "today":
      return entries.filter((e) => e.timestamp >= TODAY)
    case "yesterday":
      return entries.filter((e) => e.timestamp >= YESTERDAY && e.timestamp < TODAY)
    case "7d":
      cutoff.setDate(cutoff.getDate() - 7)
      return entries.filter((e) => e.timestamp >= cutoff)
    case "30d":
      cutoff.setDate(cutoff.getDate() - 30)
      return entries.filter((e) => e.timestamp >= cutoff)
  }
}

// ---------------------------------------------------------------------------
// Activity Log Component with TanStack Table
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

export function ActivityLog() {
  const { openDrawer } = useDrawer()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [filterUser, setFilterUser] = React.useState<string>("all")
  const [filterProject, setFilterProject] = React.useState<string>("all")
  const [filterAction, setFilterAction] = React.useState<string>("all")
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all")

  // Apply external filters to the data before passing to the table
  const filteredData = React.useMemo(() => {
    let result = [...mockActivities]
    result = filterByDateRange(result, filterDateRange)
    if (filterUser !== "all") {
      result = result.filter((a) => a.userName === filterUser)
    }
    if (filterProject !== "all") {
      result = result.filter((a) => a.project === filterProject)
    }
    if (filterAction !== "all") {
      result = result.filter((a) => a.action === filterAction)
    }
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase()
      result = result.filter(
        (a) =>
          a.userName.toLowerCase().includes(q) ||
          a.entityName.toLowerCase().includes(q) ||
          a.project.toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q)
      )
    }
    return result
  }, [filterUser, filterProject, filterAction, filterDateRange, globalFilter])

  const hasActiveFilters =
    filterUser !== "all" ||
    filterProject !== "all" ||
    filterAction !== "all" ||
    filterDateRange !== "all" ||
    globalFilter.trim() !== ""

  const clearFilters = () => {
    setGlobalFilter("")
    setFilterUser("all")
    setFilterProject("all")
    setFilterAction("all")
    setFilterDateRange("all")
    toast.info("Filters cleared")
  }

  // Column definitions
  const columns = React.useMemo<ColumnDef<ActivityEntry, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Timestamp
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
          <span className="text-sm text-muted-foreground">
            {row.original.timestamp.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ),
      },
      {
        accessorKey: "userName",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              User
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
              className="size-6 shrink-0 cursor-pointer"
              onClick={() => openDrawer("member", row.original.user)}
            >
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {row.original.user}
              </AvatarFallback>
            </Avatar>
            <EntityChip
              type="user"
              variant="subtle"
              className="text-xs truncate"
              entityId={row.original.user}
            >
              {row.original.userName}
            </EntityChip>
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Action
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
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none capitalize ${actionBadges[row.original.action]}`}
          >
            {row.original.action}
          </span>
        ),
      },
      {
        accessorKey: "entityName",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Entity
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
          <div className="flex items-center gap-1.5 min-w-0">
            <EntityChip
              type={entityChipType(row.original.entityType)}
              variant="subtle"
              className="text-xs truncate"
              entityId={row.original.entityId}
            >
              {row.original.entityName}
            </EntityChip>
          </div>
        ),
      },
      {
        accessorKey: "project",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Project
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
          <div
            className="flex items-center gap-2 min-w-0 cursor-pointer"
            onClick={() => openDrawer("project", row.original.projectId)}
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: row.original.projectColor }}
            />
            <span className="text-xs text-muted-foreground truncate hover:text-foreground transition-colors">
              {row.original.project}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "time",
        header: "Time",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatTime(row.original.timestamp)}
          </span>
        ),
      },
    ],
    [openDrawer]
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
  })

  // Pagination info
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const totalRows = filteredData.length
  const pageStart = pageIndex * PAGE_SIZE + 1
  const pageEnd = Math.min((pageIndex + 1) * PAGE_SIZE, totalRows)

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Activity Log</h2>
          <p className="text-sm text-muted-foreground">
            Track all actions across your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="size-3" />
            {filteredData.length} {filteredData.length === 1 ? "entry" : "entries"}
          </Badge>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => exportCSV(filteredData)}
            disabled={filteredData.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by keyword..."
              className="pl-8 h-9"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>

          {/* User filter */}
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full md:w-[160px] h-9">
              <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project filter */}
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {uniqueProjects.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action type filter */}
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-full md:w-[150px] h-9">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((a) => (
                <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range filter */}
          <Select value={filterDateRange} onValueChange={(v) => setFilterDateRange(v as DateRange)}>
            <SelectTrigger className="w-full md:w-[140px] h-9">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="size-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* TanStack Table */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <Search className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No activity matching your filters</p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`border-l-4 ${actionColors[row.original.action]} hover:bg-muted/30 transition-colors`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Showing {pageStart}–{pageEnd} of {totalRows}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
