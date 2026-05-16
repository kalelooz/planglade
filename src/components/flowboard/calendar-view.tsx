"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDrawer } from "@/components/flowboard/drawer-context"
import { tasks, projects, type DrawerTask, type DrawerProject } from "@/components/flowboard/drawer-data"
import { useIsMobile } from "@/hooks/use-mobile"

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"]

/** Parse a dueDate string like "May 20" or "Jun 5" into a Date for the given year */
function parseDueDate(dueDate: string, year: number): Date | null {
  const cleaned = dueDate.trim().replace(",", "")
  const match = cleaned.match(/^(\w+)\s+(\d+)$/)
  if (!match) return null
  const monthStr = match[1]
  const day = parseInt(match[2], 10)
  const monthIndex = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === monthStr.toLowerCase() || m.slice(0, 3).toLowerCase() === monthStr.toLowerCase()
  )
  if (monthIndex === -1) return null
  return new Date(year, monthIndex, day)
}

/** Get all days in a month grid (including leading/trailing days from adjacent months) */
function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const startDayOfWeek = firstDay.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: (Date | null)[] = []

  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null)
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d))
  }

  // Trailing empty cells to fill the last row
  const remainder = days.length % 7
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      days.push(null)
    }
  }

  return days
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

// ── Priority dot colors ────────────────────────────────────────────────────

function priorityDotColor(priority: string): string {
  switch (priority) {
    case "High": return "bg-red-500"
    case "Medium": return "bg-amber-500"
    case "Low": return "bg-gray-400 dark:bg-gray-500"
    default: return "bg-gray-400"
  }
}

// ── Calendar Grid (Desktop) ────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  tasksByDate,
  onTaskClick,
  expandedDay,
  setExpandedDay,
}: {
  year: number
  month: number
  tasksByDate: Map<string, DrawerTask[]>
  onTaskClick: (taskId: string) => void
  expandedDay: string | null
  setExpandedDay: (key: string | null) => void
}) {
  const days = getCalendarDays(year, month)
  const today = new Date()
  const MAX_VISIBLE = 3

  return (
    <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
      {/* Day headers */}
      {DAY_LABELS.map((label, i) => (
        <div
          key={label + i}
          className="py-2 text-center text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border"
        >
          {label}
        </div>
      ))}

      {/* Day cells */}
      {days.map((date, idx) => {
        if (!date) {
          return <div key={`empty-${idx}`} className="min-h-[110px] bg-muted/20 border-b border-r border-border p-1" />
        }

        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const dayTasks = tasksByDate.get(dateKey) || []
        const weekend = isWeekend(date)
        const isCurrentMonth = date.getMonth() === month
        const todayHighlight = isToday(date)
        const isExpanded = expandedDay === dateKey
        const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE)
        const hiddenCount = !isExpanded && dayTasks.length > MAX_VISIBLE ? dayTasks.length - MAX_VISIBLE : 0

        return (
          <div
            key={dateKey}
            className={`
              min-h-[110px] border-b border-r border-border p-1.5 transition-colors
              ${weekend ? "bg-muted/30" : "bg-card"}
              ${!isCurrentMonth ? "opacity-40" : ""}
            `}
          >
            {/* Date number */}
            <div className="flex items-center justify-center mb-1">
              <span
                className={`
                  inline-flex items-center justify-center size-7 text-sm font-medium rounded-full
                  ${todayHighlight
                    ? "bg-teal-500 text-white font-bold shadow-sm"
                    : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                `}
              >
                {date.getDate()}
              </span>
            </div>

            {/* Task pills */}
            <div className="flex flex-col gap-0.5">
              {visibleTasks.map((task) => (
                <TaskPill
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setExpandedDay(dateKey)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1 py-0.5 rounded transition-colors cursor-pointer text-left"
                >
                  +{hiddenCount} more
                </button>
              )}
              {isExpanded && dayTasks.length > MAX_VISIBLE && (
                <button
                  onClick={() => setExpandedDay(null)}
                  className="text-[11px] font-medium text-primary hover:text-primary/80 px-1 py-0.5 rounded transition-colors cursor-pointer text-left"
                >
                  Show less
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Task Pill ──────────────────────────────────────────────────────────────

function TaskPill({ task, onClick }: { task: DrawerTask; onClick: () => void }) {
  const dotColor = priorityDotColor(task.priority)

  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center gap-1.5 w-full px-1.5 py-[3px] rounded text-[11px] leading-tight
        text-foreground/90 hover:text-foreground transition-colors cursor-pointer
        border border-transparent hover:border-border/60
      `}
      style={{ backgroundColor: `${task.projectColor}15` }}
    >
      <span
        className={`shrink-0 size-2 rounded-full ${dotColor}`}
        style={{ boxShadow: `0 0 0 1.5px ${task.projectColor}30` }}
      />
      <span className="truncate font-medium" style={{ color: task.projectColor }}>
        {task.title}
      </span>
    </button>
  )
}

// ── Mobile List View ───────────────────────────────────────────────────────

function MobileCalendarList({
  year,
  month,
  tasksByDate,
  onTaskClick,
}: {
  year: number
  month: number
  tasksByDate: Map<string, DrawerTask[]>
  onTaskClick: (taskId: string) => void
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // Collect all days that have tasks
  const daysWithTasks: { date: Date; tasks: DrawerTask[] }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dateKey = `${year}-${month}-${d}`
    const dayTasks = tasksByDate.get(dateKey) || []
    if (dayTasks.length > 0) {
      daysWithTasks.push({ date, tasks: dayTasks })
    }
  }

  if (daysWithTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarDays className="size-10 mb-3 opacity-40" />
        <p className="text-sm">No tasks scheduled this month</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {daysWithTasks.map(({ date, tasks: dayTasks }) => {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const todayHighlight = isToday(date)
        const dayName = DAY_LABELS[date.getDay()]

        return (
          <motion.div
            key={dateKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            {/* Date header */}
            <div className="flex items-center gap-2.5 px-1">
              <span
                className={`
                  inline-flex items-center justify-center size-8 text-sm font-semibold rounded-full
                  ${todayHighlight
                    ? "bg-teal-500 text-white"
                    : "bg-muted text-foreground"
                  }
                `}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {dayName}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Task pills */}
            <div className="ml-11 space-y-1">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors cursor-pointer text-left"
                >
                  <span
                    className={`shrink-0 size-2.5 rounded-full ${priorityDotColor(task.priority)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: task.projectColor,
                          backgroundColor: `${task.projectColor}15`,
                        }}
                      >
                        {task.projectName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Project Color Legend ───────────────────────────────────────────────────

function ProjectLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {projects.map((project) => (
        <div key={project.id} className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            {project.name}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main CalendarView ──────────────────────────────────────────────────────

export function CalendarView() {
  const isMobile = useIsMobile()
  const { openDrawer } = useDrawer()

  // Default to May 2026 (as specified), but allow navigation
  const [currentDate, setCurrentDate] = React.useState(() => new Date(2026, 4, 1)) // May 2026
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Build tasks-by-date map
  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, DrawerTask[]>()
    for (const task of tasks) {
      const parsed = parseDueDate(task.dueDate, year)
      if (parsed) {
        const key = `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`
        const existing = map.get(key) || []
        existing.push(task)
        map.set(key, existing)
      }
    }
    // Sort tasks within each day by priority
    const priorityOrder = { High: 0, Medium: 1, Low: 2 }
    for (const [key, taskList] of map) {
      taskList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      map.set(key, taskList)
    }
    return map
  }, [year])

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setExpandedDay(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setExpandedDay(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setExpandedDay(null)
  }

  const handleTaskClick = (taskId: string) => {
    openDrawer("task", taskId)
  }

  // Total tasks this month
  const tasksThisMonth = React.useMemo(() => {
    let count = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${month}-${d}`
      count += tasksByDate.get(dateKey)?.length || 0
    }
    return count
  }, [year, month, tasksByDate])

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {tasksThisMonth} task{tasksThisMonth !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="text-xs"
          >
            Today
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={goToNextMonth}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Project color legend */}
      <div className="px-1">
        <ProjectLegend />
      </div>

      {/* Calendar body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {isMobile ? (
            <MobileCalendarList
              year={year}
              month={month}
              tasksByDate={tasksByDate}
              onTaskClick={handleTaskClick}
            />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              tasksByDate={tasksByDate}
              onTaskClick={handleTaskClick}
              expandedDay={expandedDay}
              setExpandedDay={setExpandedDay}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
