import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { CalendarRange, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { EmptyState, PageContainer } from '@/components/bits'
import { buildTaskTimelineRange } from '@/lib/task-analytical-models'

function isoStart(task: Task) {
  return task.startDate ?? task.source?.startDate ?? task.dueDate
}

type ScheduleGesture = { task: Task; mode: 'move' | 'resize'; startX: number; delta: number; pixelsPerDay: number }

export function TaskTimeline({ tasks }: { tasks: Task[] }) {
  const ws = useWorkspace()
  const { openTask } = useTaskDrawer()
  const [gesture, setGesture] = useState<ScheduleGesture | null>(null)
  const [scale, setScale] = useState<'weeks' | 'days'>('weeks')
  const [canvasWidth, setCanvasWidth] = useState(1080)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const suppressOpen = useRef(false)
  const scheduled = useMemo(() => tasks.filter((task) => task.dueDate), [tasks])
  const unscheduled = useMemo(() => tasks.filter((task) => !task.dueDate && task.status !== 'done'), [tasks])
  const range = useMemo(() => buildTaskTimelineRange(scheduled), [scheduled])

  useEffect(() => {
    if (!gesture) return
    const move = (event: PointerEvent) => setGesture((current) => current ? { ...current, delta: Math.round((event.clientX - current.startX) / current.pixelsPerDay) } : null)
    const end = (event: PointerEvent) => {
      const delta = Math.round((event.clientX - gesture.startX) / gesture.pixelsPerDay)
      if (delta) {
        const start = parseISO(isoStart(gesture.task)!)
        const due = parseISO(gesture.task.dueDate!)
        suppressOpen.current = true
        if (gesture.mode === 'move') {
          void ws.updateTask(gesture.task.id, { startDate: format(addDays(start, delta), 'yyyy-MM-dd'), dueDate: format(addDays(due, delta), 'yyyy-MM-dd') }, { silent: true })
        } else {
          const nextDue = addDays(due, delta)
          void ws.updateTask(gesture.task.id, { dueDate: format(nextDue < start ? start : nextDue, 'yyyy-MM-dd') }, { silent: true })
        }
      }
      setGesture(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [gesture, ws])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const measure = () => setCanvasWidth(scroller.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [range])

  if (!range) {
    return <PageContainer className="pb-10"><EmptyState icon={<CalendarRange className="h-7 w-7" />} title="Nothing to place on the timeline" hint="Add a due date to a task. Start dates make task spans more precise." /></PageContainer>
  }

  const timelineDays = scale === 'weeks' ? Math.max(42, range.days) : range.days
  const timelineWidth = Math.max(1, canvasWidth - 240)
  const dayWidth = timelineWidth / timelineDays
  const dates = Array.from({ length: timelineDays }, (_, index) => addDays(range.start, index))
  const todayIndex = differenceInCalendarDays(startOfDay(new Date()), range.start)
  const groups = ws.projects.map((project) => ({ project, tasks: scheduled.filter((task) => task.projectId === project.id) })).filter((group) => group.tasks.length)
  const noProject = scheduled.filter((task) => !task.projectId)
  const rows = [...groups, ...(noProject.length ? [{ project: null, tasks: noProject }] : [])]
  const months = dates.reduce<Array<{ label: string; days: number }>>((result, date) => {
    const label = format(date, 'MMM yyyy')
    const previous = result.at(-1)
    if (previous?.label === label) previous.days += 1
    else result.push({ label, days: 1 })
    return result
  }, [])
  const weeks = Array.from({ length: Math.ceil(dates.length / 7) }, (_, index) => {
    const start = dates[index * 7]
    const end = dates[Math.min(dates.length - 1, index * 7 + 6)]
    return { start, end, days: Math.min(7, dates.length - index * 7) }
  })

  const scrollToToday = () => {
    const scroller = scrollerRef.current
    if (!scroller || todayIndex < 0 || todayIndex >= timelineDays) return
    scroller.scrollTo({ left: Math.max(0, todayIndex * dayWidth - scroller.clientWidth / 2), behavior: 'smooth' })
  }

  return (
    <PageContainer width="wide" className="pb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{scale === 'weeks' ? 'A calm roadmap across projects. Switch to Days for precise scheduling.' : 'Drag a bar to move it. Drag its right edge to change the due date.'}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
          <button type="button" onClick={scrollToToday} className="h-8 rounded px-2.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Today</button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <div className="flex rounded bg-muted/70 p-0.5" aria-label="Timeline scale">
            {(['weeks', 'days'] as const).map((option) => <button key={option} type="button" aria-pressed={scale === option} onClick={() => setScale(option)} className={cn('h-7 rounded px-2.5 text-[11px] font-medium capitalize text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', scale === option && 'bg-card text-foreground shadow-sm')}>{option}</button>)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div ref={scrollerRef} data-timeline-scroller className="max-h-[68vh] overflow-x-hidden overflow-y-auto">
          <div className="relative w-full">
            <div className="sticky top-0 z-40 flex h-16 border-b border-border bg-card/95 backdrop-blur-sm">
              <div className="sticky left-0 z-30 flex w-60 shrink-0 items-end bg-card px-4 pb-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Task</div>
              <div className="relative min-w-0 flex-1 border-l border-border">
                <div className="flex h-6 border-b border-border/60">
                  {months.map((month) => <div key={month.label} className="shrink-0 whitespace-nowrap border-r border-border/60 px-2 pt-1 text-[10px] font-semibold text-muted-foreground" style={{ width: month.days * dayWidth }}>{month.label}</div>)}
                </div>
                <div className="flex h-10">
                  {scale === 'weeks' ? weeks.map((week) => <div key={week.start.toISOString()} className="flex shrink-0 items-center justify-center border-r border-border/50 px-2 text-[10px] font-medium tabular-nums text-muted-foreground" style={{ width: week.days * dayWidth }}>{format(week.start, 'MMM d')}–{format(week.end, 'MMM d')}</div>) : dates.map((date) => <div key={date.toISOString()} className={cn('flex shrink-0 flex-col items-center justify-center border-r border-border/40 tabular-nums text-muted-foreground', (date.getDay() === 0 || date.getDay() === 6) && 'bg-muted/35', isSameDay(date, new Date()) && 'font-semibold text-primary')} style={{ width: dayWidth }}><span className="text-[8px] font-medium uppercase leading-none">{format(date, 'EEE')}</span><span className="mt-1 text-[11px] font-semibold leading-none">{format(date, 'd')}</span></div>)}
                </div>
              </div>
            </div>

            {todayIndex >= 0 && todayIndex < timelineDays && <div aria-hidden className="pointer-events-none absolute bottom-0 top-16 z-20 w-px bg-primary/70" style={{ left: 240 + todayIndex * dayWidth + dayWidth / 2 }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" /></div>}

            {rows.map(({ project, tasks: projectTasks }) => (
              <section key={project?.id ?? 'none'}>
                <header className="sticky left-0 z-30 flex h-8 w-60 items-center border-r border-border bg-muted/60 px-4 text-[11px] font-semibold">
                  <span className="truncate">{project?.name ?? 'No project'}</span><span className="ml-2 tabular-nums text-muted-foreground">{projectTasks.length}</span>
                </header>
                {projectTasks.map((task) => {
                  const start = parseISO(isoStart(task)!)
                  const end = parseISO(task.dueDate!)
                  const leftDays = Math.max(0, differenceInCalendarDays(start, range.start))
                  const widthDays = Math.max(1, differenceInCalendarDays(end, start) + 1)
                  const activeGesture = gesture?.task.id === task.id ? gesture : null
                  const previewLeftDays = Math.max(0, leftDays + (activeGesture?.mode === 'move' ? activeGesture.delta : 0))
                  const previewWidthDays = Math.max(1, widthDays + (activeGesture?.mode === 'resize' ? activeGesture.delta : 0))
                  const dependencies = scheduled.filter((candidate) => task.dependsOn.includes(candidate.id))
                  return (
                    <div key={task.id} className="flex h-11 border-b border-border/45">
                      <button onClick={(event) => openTask(task.id, event.currentTarget)} className="sticky left-0 z-30 flex w-60 shrink-0 items-center gap-2 bg-card px-4 text-left hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', task.status === 'done' ? 'bg-emerald-500' : task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-muted-foreground/35')} />
                        <span className={cn('truncate text-[12.5px] font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
                        {dependencies.length > 0 && <span className="ml-auto shrink-0 text-muted-foreground" title={`Depends on ${dependencies.map((item) => item.title).join(', ')}`}><Link2 className="h-3 w-3" /><span className="sr-only">Depends on {dependencies.map((item) => item.title).join(', ')}</span></span>}
                      </button>
                      <div className="relative min-w-0 flex-1 border-l border-border">
                        <div className="absolute inset-0 flex" aria-hidden>{scale === 'weeks' ? weeks.map((week) => <span key={week.start.toISOString()} className="h-full shrink-0 border-r border-border/40" style={{ width: week.days * dayWidth }} />) : dates.map((date) => <span key={date.toISOString()} className={cn('h-full shrink-0 border-r border-border/35', (date.getDay() === 0 || date.getDay() === 6) && 'bg-muted/25')} style={{ width: dayWidth }} />)}</div>
                        <button
                          onPointerDown={(event) => { if (event.button === 0) setGesture({ task, mode: 'move', startX: event.clientX, delta: 0, pixelsPerDay: dayWidth }) }}
                          onClick={(event) => { if (suppressOpen.current) { suppressOpen.current = false; return } openTask(task.id, event.currentTarget) }}
                          onKeyDown={(event) => {
                            if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
                            event.preventDefault()
                            const delta = event.key === 'ArrowRight' ? 1 : -1
                            if (event.shiftKey) {
                              const nextDue = addDays(end, delta)
                              void ws.updateTask(task.id, { dueDate: format(nextDue < start ? start : nextDue, 'yyyy-MM-dd') }, { silent: true })
                            } else void ws.updateTask(task.id, { startDate: format(addDays(start, delta), 'yyyy-MM-dd'), dueDate: format(addDays(end, delta), 'yyyy-MM-dd') }, { silent: true })
                          }}
                          className={cn('absolute flex cursor-grab touch-none items-center text-left font-semibold shadow-sm active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', previewWidthDays === 1 ? 'top-3 h-5 w-5 justify-center rounded-full' : 'top-2 h-7 truncate rounded-md px-2.5 pr-4 text-[10.5px]', activeGesture && 'ring-2 ring-ring', task.status === 'done' ? 'bg-emerald-600/18 text-emerald-800 dark:text-emerald-100' : task.priority === 'high' ? 'bg-red-500/18 text-red-800 dark:text-red-100' : task.priority === 'medium' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-100' : 'bg-primary/14 text-foreground')}
                          style={{ left: previewLeftDays * dayWidth + (previewWidthDays === 1 ? (dayWidth - 20) / 2 : 4), width: previewWidthDays === 1 ? 20 : previewWidthDays * dayWidth - 8 }}
                          title={`${task.title}: ${format(start, 'MMM d')}–${format(end, 'MMM d')}`}
                        >
                          {previewWidthDays === 1 ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <span className="truncate">{format(start, 'MMM d')} – {format(end, 'MMM d')}</span>}
                          {previewWidthDays > 1 && <span onPointerDown={(event) => { event.stopPropagation(); if (event.button === 0) setGesture({ task, mode: 'resize', startX: event.clientX, delta: 0, pixelsPerDay: dayWidth }) }} aria-hidden className="absolute inset-y-1 right-1 w-2 cursor-ew-resize rounded-sm border-r-2 border-current/40" />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{scheduled.length} scheduled · {unscheduled.length} without dates</span>
          <span className="hidden items-center gap-2 sm:flex"><ChevronLeft className="h-3 w-3" /> Switch between Weeks and Days <ChevronRight className="h-3 w-3" /></span>
        </div>
      </div>
    </PageContainer>
  )
}
