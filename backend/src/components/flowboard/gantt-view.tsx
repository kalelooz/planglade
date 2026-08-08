"use client"

import * as React from "react"
import {
  tasks,
  projects,
  members,
  type DrawerTask,
  priorityBadgeStyle,
} from "@/components/flowboard/drawer-data"
import { useDrawer } from "@/components/flowboard/drawer-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { GanttChartSquare } from "lucide-react"
import { toast } from "sonner"

// ── Start dates for all tasks (spread across May 1 – June 15) ────────────

const taskStartDates: Record<string, Date> = {
  // Website Redesign — T1–T13
  T1:  new Date(2026, 4, 20), T2:  new Date(2026, 4, 25), T3:  new Date(2026, 4, 22),
  T4:  new Date(2026, 4, 8),  T5:  new Date(2026, 4, 12), T6:  new Date(2026, 4, 5),
  T7:  new Date(2026, 4, 1),  T8:  new Date(2026, 4, 10), T9:  new Date(2026, 4, 14),
  T10: new Date(2026, 3, 25), T11: new Date(2026, 3, 28), T12: new Date(2026, 3, 22),
  T13: new Date(2026, 3, 20),

  // Mobile App v2 — M1–M9
  M1: new Date(2026, 3, 25), M2: new Date(2026, 4, 10), M3: new Date(2026, 4, 22),
  M4: new Date(2026, 4, 15), M5: new Date(2026, 4, 28), M6: new Date(2026, 4, 12),
  M7: new Date(2026, 4, 25), M8: new Date(2026, 4, 1),  M9: new Date(2026, 4, 18),

  // API Migration — A1–A8
  A1: new Date(2026, 3, 5),  A2: new Date(2026, 3, 10), A3: new Date(2026, 4, 8),
  A4: new Date(2026, 4, 15), A5: new Date(2026, 4, 10), A6: new Date(2026, 3, 22),
  A7: new Date(2026, 4, 1),  A8: new Date(2026, 3, 15),

  // Design System — D1–D6
  D1: new Date(2026, 4, 8),  D2: new Date(2026, 4, 20), D3: new Date(2026, 5, 1),
  D4: new Date(2026, 4, 5),  D5: new Date(2026, 3, 28), D6: new Date(2026, 5, 1),

  // Analytics Dashboard — R1–R9
  R1: new Date(2026, 4, 10), R2: new Date(2026, 4, 8),  R3: new Date(2026, 4, 10),
  R4: new Date(2026, 5, 1),  R5: new Date(2026, 5, 5),  R6: new Date(2026, 5, 1),
  R7: new Date(2026, 4, 1),  R8: new Date(2026, 3, 25), R9: new Date(2026, 5, 10),
}

// ── Due date parsing ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function parseDueDate(dateStr: string): Date {
  const parts = dateStr.match(/^(\w{3})\s+(\d+)$/)
  if (!parts) return new Date(2026, 4, 15)
  return new Date(2026, MONTH_MAP[parts[1]] ?? 4, parseInt(parts[2], 10))
}

// ── Types ────────────────────────────────────────────────────────────────

interface GanttTask {
  task: DrawerTask
  startDate: Date
  dueDate: Date
  isOverdue: boolean
}

interface GanttGroup {
  project: { id: string; name: string; color: string; status: string }
  tasks: GanttTask[]
}

type ZoomLevel = "day" | "week" | "month"

// ── Date helpers ─────────────────────────────────────────────────────────

const TODAY = new Date(2026, 4, 16) // May 16, 2026

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (86400000))
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function fmtMD(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function fmtWeekRange(date: Date): string {
  const s = startOfWeek(date)
  return `${fmtMD(s)} – ${fmtMD(addDays(s, 6))}`
}

function fmtMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// ── Layout constants ─────────────────────────────────────────────────────

const LEFT_WIDTH = 240
const HEADER_HEIGHT = 44
const PROJECT_ROW_H = 32
const TASK_ROW_H = 36
const BAR_TOP_OFFSET = 7
const BAR_HEIGHT = 22

// ── Component ────────────────────────────────────────────────────────────

export function GanttView() {
  const { openDrawer } = useDrawer()
  const [zoom, setZoom] = React.useState<ZoomLevel>("week")
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const headerScrollRef = React.useRef<HTMLDivElement>(null)
  const leftScrollRef = React.useRef<HTMLDivElement>(null)

  // ── Build gantt groups ──────────────────────────────────────────────────

  const ganttGroups: GanttGroup[] = React.useMemo(
    () =>
      projects.map((project) => ({
        project: { id: project.id, name: project.name, color: project.color, status: project.status },
        tasks: tasks
          .filter((t) => t.projectId === project.id)
          .map((task) => {
            const startDate = taskStartDates[task.id] ?? addDays(parseDueDate(task.dueDate), -7)
            const dueDate = parseDueDate(task.dueDate)
            const isOverdue = dueDate < TODAY && task.status !== "Done"
            return { task, startDate, dueDate, isOverdue }
          })
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
      })),
    []
  )

  // ── Row layout: compute top offsets ─────────────────────────────────────

  const { rows, totalHeight } = React.useMemo(() => {
    const r: {
      type: "project" | "task"
      key: string
      top: number
      height: number
      group: GanttGroup
      ganttTask?: GanttTask
    }[] = []
    let y = 0
    for (const group of ganttGroups) {
      r.push({ type: "project", key: `proj-${group.project.id}`, top: y, height: PROJECT_ROW_H, group })
      y += PROJECT_ROW_H
      for (const gt of group.tasks) {
        r.push({ type: "task", key: gt.task.id, top: y, height: TASK_ROW_H, group, ganttTask: gt })
        y += TASK_ROW_H
      }
    }
    return { rows: r, totalHeight: y }
  }, [ganttGroups])

  // ── Date range ──────────────────────────────────────────────────────────

  const { rangeStart, rangeEnd, totalDays } = React.useMemo(() => {
    let min = new Date(2026, 3, 20)
    let max = new Date(2026, 5, 20)
    for (const g of ganttGroups)
      for (const t of g.tasks) {
        if (t.startDate < min) min = t.startDate
        if (t.dueDate > max) max = t.dueDate
      }
    min = addDays(min, -3)
    max = addDays(max, 3)
    return { rangeStart: min, rangeEnd: max, totalDays: diffDays(max, min) + 1 }
  }, [ganttGroups])

  // ── Column width ────────────────────────────────────────────────────────

  const colWidth = zoom === "day" ? 38 : zoom === "week" ? 84 : 168

  // ── Columns ─────────────────────────────────────────────────────────────

  const columns = React.useMemo(() => {
    const cols: { date: Date; label: string; isWeekend: boolean; isToday: boolean }[] = []
    if (zoom === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i)
        cols.push({ date: d, label: fmtMD(d), isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: diffDays(d, TODAY) === 0 })
      }
    } else if (zoom === "week") {
      let cur = startOfWeek(rangeStart)
      while (cur <= rangeEnd) {
        cols.push({
          date: cur,
          label: fmtWeekRange(cur),
          isWeekend: false,
          isToday: diffDays(TODAY, cur) >= 0 && diffDays(TODAY, addDays(cur, 6)) <= 0,
        })
        cur = addDays(cur, 7)
      }
    } else {
      let cur = startOfMonth(rangeStart)
      while (cur <= rangeEnd) {
        cols.push({
          date: cur,
          label: fmtMonth(cur),
          isWeekend: false,
          isToday: cur.getMonth() === TODAY.getMonth() && cur.getFullYear() === TODAY.getFullYear(),
        })
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      }
    }
    return cols
  }, [zoom, rangeStart, rangeEnd, totalDays])

  const timelineWidth = columns.length * colWidth

  // ── Today line offset ───────────────────────────────────────────────────

  const todayOffset = React.useMemo(() => {
    if (zoom === "day") return diffDays(TODAY, rangeStart) * colWidth
    if (zoom === "week") {
      const ws = startOfWeek(TODAY)
      return (diffDays(ws, startOfWeek(rangeStart)) / 7) * colWidth + (diffDays(TODAY, ws) / 7) * colWidth
    }
    const ms = startOfMonth(TODAY)
    return (diffDays(ms, startOfMonth(rangeStart)) / 30) * colWidth + (diffDays(TODAY, ms) / 30) * colWidth
  }, [zoom, rangeStart, colWidth])

  // ── Bar position helper ─────────────────────────────────────────────────

  const getBarPos = React.useCallback(
    (gt: GanttTask): { left: number; width: number } => {
      const { startDate, dueDate } = gt
      if (zoom === "day") {
        const left = diffDays(startDate, rangeStart) * colWidth
        const width = Math.max(diffDays(dueDate, startDate) + 1, 1) * colWidth
        return { left: Math.max(left, 0), width }
      }
      if (zoom === "week") {
        const so = diffDays(startDate, startOfWeek(rangeStart)) / 7
        const eo = diffDays(addDays(dueDate, 1), startOfWeek(rangeStart)) / 7
        return { left: Math.max(so * colWidth, 0), width: Math.max((eo - so) * colWidth, 8) }
      }
      const so = diffDays(startDate, startOfMonth(rangeStart)) / 30
      const eo = diffDays(addDays(dueDate, 1), startOfMonth(rangeStart)) / 30
      return { left: Math.max(so * colWidth, 0), width: Math.max((eo - so) * colWidth, 12) }
    },
    [zoom, rangeStart, colWidth]
  )

  // ── Scroll sync ─────────────────────────────────────────────────────────

  const syncing = React.useRef(false)

  const handleTimelineScroll = React.useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    const el = scrollContainerRef.current
    if (el) {
      if (headerScrollRef.current) headerScrollRef.current.scrollLeft = el.scrollLeft
      if (leftScrollRef.current) leftScrollRef.current.scrollTop = el.scrollTop
    }
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  const handleLeftScroll = React.useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    const el = leftScrollRef.current
    if (el && scrollContainerRef.current) scrollContainerRef.current.scrollTop = el.scrollTop
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  // ── Member color helper ─────────────────────────────────────────────────

  const getMemberColor = (initials: string) =>
    members.find((m) => m.initials === initials)?.color ?? "#9ca3af"

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <GanttChartSquare className="size-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
            <span className="text-sm text-muted-foreground">
              {tasks.length} tasks across {projects.length} projects
            </span>
          </div>
          {/* Zoom switcher */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
              <Button
                key={level}
                variant={zoom === level ? "default" : "ghost"}
                size="sm"
                className={cn("text-xs h-7 px-3 capitalize", zoom === level && "shadow-sm")}
                onClick={() => { setZoom(level); toast.success("Zoom level changed", { description: `${level} view` }) }}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>

        {/* Gantt grid */}
        <div className="flex flex-1 overflow-hidden border rounded-lg bg-background">
          {/* ═══ LEFT PANEL ═══ */}
          <div className="flex flex-col shrink-0 border-r bg-background z-10" style={{ width: LEFT_WIDTH }}>
            {/* Left header */}
            <div
              className="flex items-center justify-between px-3 border-b bg-muted/30 text-xs font-medium text-muted-foreground shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              <span>Task</span>
              <span className="text-[10px]">Assignee</span>
            </div>
            {/* Left body */}
            <div ref={leftScrollRef} className="overflow-y-auto overflow-x-hidden" onScroll={handleLeftScroll}>
              {ganttGroups.map((group) => (
                <React.Fragment key={group.project.id}>
                  {/* Project header */}
                  <div
                    className="flex items-center gap-2 px-3 text-xs font-semibold"
                    style={{
                      height: PROJECT_ROW_H,
                      backgroundColor: group.project.color + "18",
                      borderBottom: `2px solid ${group.project.color}40`,
                    }}
                  >
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.project.color }} />
                    <span className="truncate" style={{ color: group.project.color }}>{group.project.name}</span>
                    <span className="text-muted-foreground font-normal ml-auto">{group.tasks.length}</span>
                  </div>
                  {/* Task rows */}
                  {group.tasks.map((gt) => (
                    <div
                      key={gt.task.id}
                      className="flex items-center gap-2 px-3 border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                      style={{ height: TASK_ROW_H }}
                      onClick={() => openDrawer("task", gt.task.id)}
                    >
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: group.project.color }} />
                      <span className="text-xs truncate flex-1">{gt.task.title}</span>
                      <Avatar className="size-5 shrink-0">
                        <AvatarFallback
                          className="text-[9px] font-semibold text-white"
                          style={{ backgroundColor: getMemberColor(gt.task.assignee) }}
                        >
                          {gt.task.assignee}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ═══ RIGHT PANEL ═══ */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Timeline header (synced scroll) */}
            <div
              ref={headerScrollRef}
              className="overflow-hidden border-b bg-muted/30 shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="flex" style={{ width: timelineWidth, height: HEADER_HEIGHT }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center text-[11px] border-r border-border/30 shrink-0",
                      col.isToday && "bg-primary/10 font-semibold text-primary",
                      col.isWeekend && !col.isToday && "bg-muted/40 text-muted-foreground"
                    )}
                    style={{ width: colWidth }}
                  >
                    <span className="truncate px-1">{col.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline body (scrollable) */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto" onScroll={handleTimelineScroll}>
              <div className="relative" style={{ width: timelineWidth, height: totalHeight }}>
                {/* ── Grid columns (background) ── */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-border/15 shrink-0",
                        col.isWeekend && "bg-muted/15",
                        col.isToday && "bg-primary/[0.04]"
                      )}
                      style={{ width: colWidth }}
                    />
                  ))}
                </div>

                {/* ── Today line ── */}
                {todayOffset > 0 && todayOffset < timelineWidth && (
                  <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayOffset }}>
                    <div className="w-0 h-full border-l-2 border-dashed border-primary/60" />
                    <div className="absolute -top-0 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-b">
                      Today
                    </div>
                  </div>
                )}

                {/* ── Row backgrounds ── */}
                {rows.map((row) =>
                  row.type === "project" ? (
                    <div
                      key={row.key}
                      className="absolute left-0 right-0"
                      style={{
                        top: row.top,
                        height: row.height,
                        backgroundColor: row.group.project.color + "12",
                        borderBottom: `2px solid ${row.group.project.color}35`,
                      }}
                    />
                  ) : (
                    <div
                      key={row.key}
                      className="absolute left-0 right-0 border-b border-border/15"
                      style={{ top: row.top, height: row.height }}
                    />
                  )
                )}

                {/* ── Task bars ── */}
                {rows
                  .filter((r) => r.type === "task" && r.ganttTask)
                  .map((row) => {
                    const gt = row.ganttTask!
                    const { left, width } = getBarPos(gt)
                    const barColor = gt.isOverdue ? "#ef4444" : row.group.project.color
                    const showLabel = width > 70

                    return (
                      <Tooltip key={`bar-${row.key}`}>
                        <TooltipTrigger asChild>
                          <button
                            className="absolute z-10 cursor-pointer group"
                            style={{
                              left,
                              width: Math.max(width, 8),
                              top: row.top + BAR_TOP_OFFSET,
                              height: BAR_HEIGHT,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openDrawer("task", gt.task.id)
                            }}
                          >
                            {/* Bar shape */}
                            <div
                              className={cn(
                                "w-full h-full rounded-md transition-all",
                                "group-hover:brightness-110 group-hover:shadow-lg group-hover:scale-[1.02]",
                                gt.isOverdue ? "bg-red-500" : ""
                              )}
                              style={!gt.isOverdue ? { backgroundColor: barColor } : undefined}
                            >
                              {showLabel && (
                                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate pointer-events-none">
                                  {gt.task.title}
                                </span>
                              )}
                            </div>
                            {/* Overdue dot */}
                            {gt.isOverdue && (
                              <div className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-background" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3" sideOffset={6}>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{gt.task.title}</span>
                              <Badge
                                variant="secondary"
                                className={cn("text-[10px] px-1.5 py-0", priorityBadgeStyle(gt.task.priority))}
                              >
                                {gt.task.priority}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Avatar className="size-4">
                                <AvatarFallback
                                  className="text-[8px] text-white font-semibold"
                                  style={{ backgroundColor: getMemberColor(gt.task.assignee) }}
                                >
                                  {gt.task.assignee}
                                </AvatarFallback>
                              </Avatar>
                              <span>{gt.task.assigneeName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fmtMD(gt.startDate)} – {gt.task.dueDate}
                            </div>
                            {gt.isOverdue && (
                              <span className="text-[10px] font-medium text-red-500">Overdue</span>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
