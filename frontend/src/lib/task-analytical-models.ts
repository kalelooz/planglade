import { addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Project, Task } from '@/types'

export const MAX_TIMELINE_DAYS = 370

export type TaskTimelineRange = {
  start: Date
  end: Date
  days: number
  bounded: boolean
}

export type ScheduledTaskSpan = {
  task: Task
  start: Date
  end: Date
  visibleStart: Date
  visibleEnd: Date
  startDay: number
  durationDays: number
  startsBeforeRange: boolean
  endsAfterRange: boolean
  offRange: 'before' | 'after' | null
}

export type TaskTimelineRow = {
  project: Project | null
  spans: ScheduledTaskSpan[]
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function validCalendarDate(value: string | null | undefined) {
  const match = value?.match(DATE_ONLY)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText) - 1
  const day = Number(dayText)
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
}

function scheduledTaskSpans(tasks: Task[]) {
  const spans: Array<{ task: Task; start: Date; end: Date }> = []
  let invalidDates = 0

  for (const task of tasks) {
    if (!task.dueDate) continue
    const end = validCalendarDate(task.dueDate)
    if (!end) {
      invalidDates += 1
      continue
    }

    const sourceStart = task.source?.startDate?.slice(0, 10)
    const startValue = task.startDate ?? sourceStart
    const parsedStart = startValue ? validCalendarDate(startValue) : end
    const validOrder = parsedStart !== null && Number(parsedStart) <= Number(end)
    if (startValue && !validOrder) invalidDates += 1
    spans.push({ task, start: validOrder ? parsedStart : end, end })
  }

  return { spans, invalidDates }
}

function buildTaskTimelineRange(spans: Array<{ start: Date; end: Date }>, today: Date): TaskTimelineRange | null {
  if (!spans.length) return null
  const anchor = startOfDay(today)
  const min = new Date(Math.min(...spans.map((span) => Number(span.start)), Number(anchor)))
  const max = new Date(Math.max(...spans.map((span) => Number(span.end)), Number(anchor)))
  const requestedDays = Math.max(14, differenceInCalendarDays(max, min) + 8)
  const bounded = requestedDays > MAX_TIMELINE_DAYS
  const start = bounded ? addDays(anchor, -30) : min
  const days = bounded ? MAX_TIMELINE_DAYS : requestedDays
  return { start, end: addDays(start, days - 1), days, bounded }
}

export function buildTaskTimelineProjection(tasks: Task[], projects: Project[], today = new Date()) {
  const scheduled = scheduledTaskSpans(tasks)
  const range = buildTaskTimelineRange(scheduled.spans, today)
  const spans: ScheduledTaskSpan[] = range ? scheduled.spans.map(({ task, start, end }) => {
    const startsBeforeRange = Number(start) < Number(range.start)
    const endsAfterRange = Number(end) > Number(range.end)
    const offRange = Number(end) < Number(range.start)
      ? 'before' as const
      : Number(start) > Number(range.end)
        ? 'after' as const
        : null
    const visibleStart = offRange === 'before' || startsBeforeRange
      ? range.start
      : offRange === 'after'
        ? range.end
        : start
    const visibleEnd = offRange === 'after' || endsAfterRange
      ? range.end
      : offRange === 'before'
        ? range.start
        : end
    return {
      task,
      start,
      end,
      visibleStart,
      visibleEnd,
      startDay: differenceInCalendarDays(visibleStart, range.start),
      durationDays: Math.max(1, differenceInCalendarDays(visibleEnd, visibleStart) + 1),
      startsBeforeRange,
      endsAfterRange,
      offRange,
    }
  }) : []

  const knownProjectIds = new Set(projects.map((project) => project.id))
  const projectRows = projects
    .map((project) => ({ project, spans: spans.filter((span) => span.task.projectId === project.id) }))
    .filter((row) => row.spans.length > 0)
  const unassigned = spans.filter((span) => !span.task.projectId || !knownProjectIds.has(span.task.projectId))
  const rows: TaskTimelineRow[] = [...projectRows, ...(unassigned.length ? [{ project: null, spans: unassigned }] : [])]

  return {
    range,
    spans,
    rows,
    counts: {
      scheduled: spans.length,
      unscheduled: tasks.filter((task) => !task.dueDate && task.status !== 'done').length,
      invalidDates: scheduled.invalidDates,
      beforeRange: spans.filter((span) => span.offRange === 'before').length,
      afterRange: spans.filter((span) => span.offRange === 'after').length,
      clipped: spans.filter((span) => span.startsBeforeRange || span.endsAfterRange).length,
    },
  }
}

export function buildTaskOverview(tasks: Task[], blocked: (task: Task) => boolean, today = startOfDay(new Date())) {
  const open = tasks.filter((task) => task.status !== 'done')
  const done = tasks.filter((task) => task.status === 'done')
  const overdue = open.filter((task) => task.dueDate && differenceInCalendarDays(parseISO(task.dueDate), today) < 0)
  const upcoming = open.filter((task) => task.dueDate && differenceInCalendarDays(parseISO(task.dueDate), today) >= 0 && differenceInCalendarDays(parseISO(task.dueDate), today) <= 7)
  return { open, done, overdue, upcoming, blocked: open.filter(blocked) }
}
