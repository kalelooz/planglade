import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Task } from '@/types'

function taskStart(task: Task) {
  return task.startDate ?? task.source?.startDate ?? task.dueDate
}

export function buildTaskTimelineRange(tasks: Task[], today = startOfDay(new Date())) {
  const scheduled = tasks.filter((task) => task.dueDate)
  if (!scheduled.length) return null
  const starts = scheduled.map((task) => parseISO(taskStart(task)!))
  const ends = scheduled.map((task) => parseISO(task.dueDate!))
  const min = new Date(Math.min(...starts.map(Number), Number(today)))
  const max = new Date(Math.max(...ends.map(Number), Number(today)))
  return { start: min, days: Math.max(14, differenceInCalendarDays(max, min) + 8) }
}

export function buildTaskOverview(tasks: Task[], blocked: (task: Task) => boolean, today = startOfDay(new Date())) {
  const open = tasks.filter((task) => task.status !== 'done')
  const done = tasks.filter((task) => task.status === 'done')
  const overdue = open.filter((task) => task.dueDate && differenceInCalendarDays(parseISO(task.dueDate), today) < 0)
  const upcoming = open.filter((task) => task.dueDate && differenceInCalendarDays(parseISO(task.dueDate), today) >= 0 && differenceInCalendarDays(parseISO(task.dueDate), today) <= 7)
  return { open, done, overdue, upcoming, blocked: open.filter(blocked) }
}
