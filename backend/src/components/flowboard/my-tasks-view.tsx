"use client"

import * as React from "react"
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Trash2,
  UserPlus,
  FolderInput,
  X,
} from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Row,
  type RowSelectionState,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { useDrawer } from "@/components/flowboard/drawer-context"
import {
  tasks as allTasks,
  projects,
  type Priority,
  type TaskStatus,
  priorityBadgeStyle,
  taskStatusColor,
  taskStatusBadgeStyle,
} from "@/components/flowboard/drawer-data"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MyTask {
  id: string
  title: string
  priority: Priority
  status: TaskStatus
  assignee: string
  assigneeName: string
  dueDate: string
  projectId: string
  projectName: string
  projectColor: string
}

// ---------------------------------------------------------------------------
// Convert drawer-data tasks to MyTask format
// ---------------------------------------------------------------------------

const myTasks: MyTask[] = allTasks.map((t) => ({
  id: t.id,
  title: t.title,
  priority: t.priority,
  status: t.status,
  assignee: t.assignee,
  assigneeName: t.assigneeName,
  dueDate: t.dueDate,
  projectId: t.projectId,
  projectName: t.projectName,
  projectColor: t.projectColor,
}))

// ---------------------------------------------------------------------------
// Priority / Status ordering helpers
// ---------------------------------------------------------------------------

const priorityOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

const STATUS_COLORS: Record<TaskStatus, string> = {
  Backlog: "#9ca3af",
  "In Progress": "#01696f",
  "In Review": "#f59e0b",
  Done: "#10b981",
}

// ---------------------------------------------------------------------------
// My Tasks View Component
// ---------------------------------------------------------------------------

export function MyTasksView() {
  const { openDrawer } = useDrawer()

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [filterPriority, setFilterPriority] = React.useState<string>("all")
  const [filterProject, setFilterProject] = React.useState<string>("all")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({ [projects[0]?.id ?? "P1"]: true })

  // Apply external filters
  const filteredData = React.useMemo(() => {
    let result = [...myTasks]
    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority)
    }
    if (filterProject !== "all") {
      result = result.filter((t) => t.projectId === filterProject)
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus)
    }
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q)
      )
    }
    return result
  }, [filterPriority, filterProject, filterStatus, globalFilter])

  const hasActiveFilters =
    filterPriority !== "all" ||
    filterProject !== "all" ||
    filterStatus !== "all" ||
    globalFilter.trim() !== ""

  const clearFilters = () => {
    setGlobalFilter("")
    setFilterPriority("all")
    setFilterProject("all")
    setFilterStatus("all")
  }

  // Column definitions
  const columns = React.useMemo<ColumnDef<MyTask, unknown>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "title",
        header: ({ column }) => {
          const sorted = column.getIsSorted()
          return (
            <button
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Task
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
        sortingFn: (rowA, rowB) =>
          priorityOrder[rowA.original.priority] - priorityOrder[rowB.original.priority],
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
              onClick={(e) => {
                e.stopPropagation()
                openDrawer("member", row.original.assignee)
              }}
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
    data: filteredData,
    columns,
    state: {
      sorting,
      rowSelection,
      expanded,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded as never,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableGrouping: true,
    enableRowSelection: true,
    initialState: {
      grouping: ["projectId"],
    },
  })

  // Selected rows count
  const selectedCount = Object.keys(rowSelection).filter(
    (key) => rowSelection[key] && !key.includes("_group_")
  ).length

  // Get selected task IDs
  const selectedTaskIds = React.useMemo(() => {
    return table
      .getFilteredSelectedRowModel()
      .rows.filter((r) => !r.getIsGrouped())
      .map((r) => r.original.id)
  }, [rowSelection, table])

  // Action handlers (mock)
  const handleBulkAssign = () => {
    toast.success("Tasks assigned", {
      description: `${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? "s" : ""} assigned — this is a demo action.`,
    })
    setRowSelection({})
  }

  const handleBulkMove = () => {
    toast.info("Move to project", {
      description: `${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? "s" : ""} selected — this is a demo action.`,
    })
    setRowSelection({})
  }

  const handleBulkDelete = () => {
    toast.error("Tasks deleted", {
      description: `${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? "s" : ""} removed — this is a demo action.`,
    })
    setRowSelection({})
  }

  // Render group header with project color
  const renderGroupHeader = (row: Row<MyTask>) => {
    const projectId = row.getValue("projectId") as string
    const projectData = projects.find((p) => p.id === projectId)
    const projectColor = projectData?.color ?? "#9ca3af"
    const projectName = projectData?.name ?? projectId
    const subRows = row.subRows ?? []
    const taskCount = subRows.length

    return (
      <TableRow
        key={row.id}
        className="bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => row.toggleExpanded()}
      >
        <TableCell colSpan={columns.length} className="py-2.5">
          <div className="flex items-center gap-2.5">
            {row.getIsExpanded() ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <span
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <span className="text-sm font-semibold">{projectName}</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </Badge>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">My Tasks</h2>
          <p className="text-sm text-muted-foreground">
            All tasks across your projects with filters and bulk actions
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 self-start">
          {filteredData.length} {filteredData.length === 1 ? "task" : "tasks"}
        </Badge>
      </div>

      {/* Filters bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks, assignees, projects..."
              className="pl-8 h-9"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>

          {/* Priority filter */}
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-full md:w-[140px] h-9">
              <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Project filter */}
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[150px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Backlog">Backlog</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="In Review">In Review</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Bulk selection action bar */}
      {selectedCount > 0 && (
        <Card className="px-4 py-2.5 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="gap-1">
                {selectedCount} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setRowSelection({})}
              >
                <X className="size-3" />
                Clear selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleBulkAssign}
              >
                <UserPlus className="size-3.5" />
                Assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleBulkMove}
              >
                <FolderInput className="size-3.5" />
                Move to
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TanStack Grouped Table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-auto h-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
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
                    No tasks found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  if (row.getIsGrouped()) {
                    return renderGroupHeader(row)
                  }

                  return (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors ${
                        row.getIsSelected() ? "bg-primary/5" : ""
                      }`}
                      onClick={() => openDrawer("task", row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
