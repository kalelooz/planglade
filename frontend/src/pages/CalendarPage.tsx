import { useMemo, useState } from 'react'
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  startOfMonth, startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import type { Task } from '@/types'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { EmptyState, PageContainer } from '@/components/bits'
import { relativeLabel } from '@/lib/dates'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'

function chipTone(t: Task): { bg: string; text: string; dot: string } {
  if (t.status === 'done') return { bg: 'bg-muted', text: 'text-muted-foreground line-through', dot: 'bg-muted-foreground/50' }
  if (t.priority === 'high') return { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' }
  if (t.priority === 'medium') return { bg: 'bg-amber-500/10', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' }
  return { bg: 'bg-secondary', text: 'text-secondary-foreground', dot: 'bg-muted-foreground/50' }
}

function TaskChip({ task, overlay, active, onOpen }: { task: Task; overlay?: boolean; active?: boolean; onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `chip-${task.id}` })
  const tone = chipTone(task)
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      aria-label={`Task: ${task.title}. Press to open. Drag with a pointer to reschedule.`}
      aria-pressed={active}
      onClick={(e) => {
        if (!isDragging) onOpen(e)
      }}
      className={cn(
        'min-h-11 w-full cursor-grab select-none truncate rounded px-1.5 py-[3px] text-left lg:min-h-0 text-[12.5px] leading-tight transition-[background-color,color,box-shadow,transform] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
        active ? 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_6px_18px_hsl(var(--foreground)/0.08)]' : [tone.bg, tone.text],
        isDragging && 'opacity-40',
        overlay && 'shadow-[0_6px_18px_hsl(240_8%_10%/0.18)]',
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle shrink-0', tone.dot)} aria-hidden />
      {task.title}
    </button>
  )
}

function DayCell({
  date,
  inMonth,
  tasks,
  selected,
  maxVisible,
  onOpenDay,
  onOpenTask,
  activeTaskId,
}: {
  date: Date
  inMonth: boolean
  tasks: Task[]
  selected: boolean
  maxVisible: number
  onOpenDay: () => void
  onOpenTask: (task: Task, event: React.MouseEvent<HTMLButtonElement>) => void
  activeTaskId: string | null
}) {
  const iso = format(date, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({ id: `day-${iso}` })
  const visible = tasks.slice(0, maxVisible)
  const extra = tasks.length - visible.length
  const hasOverflow = tasks.length >= 3

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[92px] border-b border-r border-border/60 p-1 transition-colors text-left flex flex-col',
        !inMonth && 'bg-muted/30',
        selected && 'bg-accent/25 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.16)]',
        isOver && 'bg-accent',
      )}
    >
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full text-[12.5px] mb-0.5 self-start',
          isToday(date) ? 'bg-foreground text-background font-semibold' : inMonth ? 'text-foreground/80' : 'text-muted-foreground',
        )}
      >
        {format(date, 'd')}
      </span>
      <div className="space-y-0.5 w-full">
        {visible.map((t) => (
          <TaskChip
            key={t.id}
            task={t}
            active={activeTaskId === t.id}
            onOpen={(event) => hasOverflow ? onOpenDay() : onOpenTask(t, event)}
          />
        ))}
      </div>
      {extra > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenDay()
          }}
          aria-label={`Show all ${tasks.length} tasks for ${format(date, 'MMMM d')}`}
          className="mt-auto inline-flex min-h-11 w-fit items-center lg:min-h-6 gap-1 rounded-[5px] border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-left text-[12.5px] font-medium tabular-nums text-sky-700 transition-[background-color,color,border-color,transform] hover:border-sky-500/30 hover:bg-sky-500/15 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-sky-300"
        >
          <span className="font-semibold">{tasks.length}</span>
          <span>{tasks.length === 1 ? 'task' : 'tasks'}</span>
        </button>
      )}
    </div>
  )
}

export default function CalendarPage({ embedded = false, tasks: providedTasks }: { embedded?: boolean; tasks?: Task[] }) {
  const ws = useWorkspace()
  const { openTask, openTaskId } = useTaskDrawer()
  const isMobile = useIsMobile()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [prioFilter, setPrioFilter] = useState<string>('all')
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [panelOpen, setPanelOpen] = useState(false)
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [activeChip, setActiveChip] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const tasks = useMemo(() => {
    let l = providedTasks ?? ws.tasks.filter((t) => !t.parentId)
    if (providedTasks) return l
    if (projectFilter !== 'all') l = l.filter((t) => t.projectId === projectFilter)
    if (prioFilter !== 'all') {
      if (prioFilter === 'done') l = l.filter((t) => t.status === 'done')
      else if (prioFilter === 'open') l = l.filter((t) => t.status !== 'done')
      else l = l.filter((t) => t.priority === prioFilter)
    }
    return l
  }, [providedTasks, ws.tasks, projectFilter, prioFilter])

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>()
    tasks.forEach((t) => {
      if (!t.dueDate) return
      const arr = m.get(t.dueDate) ?? []
      arr.push(t)
      m.set(t.dueDate, arr)
    })
    return m
  }, [tasks])

  const weeks = useMemo(() => {
    if (calendarMode === 'week') {
      const start = startOfWeek(selectedDay, { weekStartsOn: ws.state.settings.weekStartsOn })
      return Array.from({ length: 7 }, (_, index) => addDays(start, index))
    }
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: ws.state.settings.weekStartsOn })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: ws.state.settings.weekStartsOn })
    const days: Date[] = []
    let d = start
    while (d <= end) {
      days.push(d)
      d = addDays(d, 1)
    }
    return days
  }, [calendarMode, month, selectedDay, ws.state.settings.weekStartsOn])

  const unscheduled = useMemo(() => tasks.filter((t) => !t.dueDate && t.status !== 'done'), [tasks])
  const selectedIso = format(selectedDay, 'yyyy-MM-dd')
  const selectedTasks = byDay.get(selectedIso) ?? []

  const agendaDays = useMemo(() => {
    const arr: { date: Date; tasks: Task[] }[] = []
    for (let d = startOfMonth(month); isSameMonth(d, month); d = addDays(d, 1)) {
      const iso = format(d, 'yyyy-MM-dd')
      const ts = byDay.get(iso)
      if (ts) arr.push({ date: d, tasks: ts })
    }
    return arr
  }, [byDay, month])

  const changeMonth = (offset: number) => {
    if (calendarMode === 'week') {
      const next = addDays(selectedDay, offset * 7)
      setSelectedDay(next)
      setMonth(startOfMonth(next))
      return
    }
    const next = startOfMonth(addMonths(month, offset))
    setMonth(next)
    setSelectedDay(next)
  }

  const goToToday = () => {
    const today = new Date()
    setMonth(startOfMonth(today))
    setSelectedDay(today)
  }

  const onDragStart = (e: DragStartEvent) => setActiveChip(String(e.active.id).replace('chip-', ''))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveChip(null)
    const taskId = String(e.active.id).replace('chip-', '')
    const over = e.over ? String(e.over.id) : null
    if (over?.startsWith('day-')) {
      ws.updateTask(taskId, { dueDate: over.replace('day-', '') })
    }
  }

  const activeTask = activeChip ? ws.getTask(activeChip) : undefined
  const weekStart = ws.state.settings.weekStartsOn
  const weekdayNames = useMemo(() => {
    const base = weekStart === 1 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return base
  }, [weekStart])

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveChip(null)}>
      <div className="flex flex-col flex-1 min-h-0">
        <PageContainer width="canvas" className="pt-6 sm:pt-8">
          <header className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="mr-auto">
              {embedded ? (
                <p className="text-sm text-muted-foreground">Tasks by due date.</p>
              ) : (
                <>
                  <h1 className="pg-page-title">Calendar</h1>
                  <p className="pg-page-kicker">Your tasks, by due date.</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isMobile && <div className="mr-2 inline-flex rounded-md border border-border bg-card p-0.5" aria-label="Calendar range">
                {(['month', 'week'] as const).map((mode) => <button key={mode} onClick={() => setCalendarMode(mode)} aria-pressed={calendarMode === mode} className={cn('h-11 rounded px-2 text-[12.5px] capitalize lg:h-7 text-muted-foreground hover:text-foreground', calendarMode === mode && 'bg-accent font-medium text-foreground')}>{mode}</button>)}
              </div>}
              <button onClick={() => changeMonth(-1)} aria-label={calendarMode === 'month' ? 'Previous month' : 'Previous week'} className="inline-flex size-11 rounded-md lg:size-8 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[14px] font-medium min-w-[110px] text-center" aria-live="polite">{calendarMode === 'month' ? format(month, 'MMMM yyyy') : `${format(weeks[0], 'MMM d')}–${format(weeks[6], 'MMM d')}`}</span>
              <button onClick={() => changeMonth(1)} aria-label={calendarMode === 'month' ? 'Next month' : 'Next week'} className="inline-flex size-11 rounded-md lg:size-8 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToToday}
                className="h-11 rounded-md px-2.5 text-[12.5px] lg:h-8 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Today
              </button>
            </div>
            {!providedTasks && <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-11 w-full min-w-0 max-w-full text-[13px] border-input bg-card lg:h-8 lg:w-auto lg:min-w-[120px]" aria-label="Filter by project">
                <span className="min-w-0 truncate"><SelectValue /></span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {ws.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>}
            {!providedTasks && <Select value={prioFilter} onValueChange={setPrioFilter}>
              <SelectTrigger className="h-11 w-full min-w-0 max-w-full text-[13px] border-input bg-card lg:h-8 lg:w-auto" aria-label="Filter by priority or status">
                <span className="min-w-0 truncate"><SelectValue /></span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any priority</SelectItem>
                <SelectItem value="high">High priority</SelectItem>
                <SelectItem value="medium">Medium priority</SelectItem>
                <SelectItem value="low">Low priority</SelectItem>
                <SelectItem value="open">Open only</SelectItem>
                <SelectItem value="done">Done only</SelectItem>
              </SelectContent>
            </Select>}
          </header>
        </PageContainer>

        <PageContainer width="canvas" className="pb-8 flex gap-6 flex-1 min-h-0">
          {/* Month grid (desktop/tablet) */}
          {!isMobile && (
            <div className="flex-1 min-w-0">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                  {weekdayNames.map((d) => (
                    <div key={d} className="text-[12.5px] font-medium text-muted-foreground px-2 py-1.5 border-r border-border/60 last:border-r-0">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {weeks.map((d) => {
                    const iso = format(d, 'yyyy-MM-dd')
                    return (
                      <DayCell
                        key={iso}
                        date={d}
                        inMonth={isSameMonth(d, month)}
                        tasks={byDay.get(iso) ?? []}
                        selected={isSameDay(d, selectedDay) && panelOpen}
                        maxVisible={2}
                        onOpenDay={() => { setSelectedDay(d); setPanelOpen(true) }}
                        onOpenTask={(task, event) => openTask(task.id, event.currentTarget)}
                        activeTaskId={openTaskId}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Unscheduled */}
              <div className="mt-4">
                <button
                  onClick={() => setShowUnscheduled((v) => !v)}
                  aria-expanded={showUnscheduled}
                  className="min-h-11 rounded px-1 py-0.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground lg:min-h-0"
                >
                  {showUnscheduled ? '▾' : '▸'} No date set ({unscheduled.length})
                </button>
                {showUnscheduled && (
                  <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border/60">
                    {unscheduled.length === 0 ? (
                      <p className="pg-body-muted px-4 py-4">Everything has a date.</p>
                    ) : (
                      unscheduled.slice(0, 10).map((t) => (
                        <button
                          key={t.id}
                          onClick={(e) => openTask(t.id, e.currentTarget)}
                          aria-current={openTaskId === t.id ? 'true' : undefined}
                          className={cn(
                            'pg-item-title min-h-11 w-full truncate px-3.5 py-2 text-left transition-colors hover:bg-accent/50',
                            openTaskId === t.id && 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-accent',
                          )}
                        >
                          {t.title}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile agenda */}
          {isMobile && (
            <div className="flex-1 min-w-0">
              <h2 className="mb-2 px-1 text-balance text-[12px] font-semibold uppercase text-muted-foreground">Agenda</h2>
              {agendaDays.length === 0 ? (
                <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nothing scheduled" hint="Add due dates to tasks to see them here." />
              ) : (
                <div className="space-y-4">
                  {agendaDays.map(({ date, tasks: ts }) => (
                    <div key={date.toISOString()}>
                      <p className={cn('text-[12px] font-medium mb-1 px-1', isToday(date) ? 'text-foreground' : 'text-muted-foreground')}>
                        {relativeLabel(format(date, 'yyyy-MM-dd'))} · {format(date, 'MMM d')}
                      </p>
                      <div className="space-y-1.5">
                        {ts.map((t) => (
                          <button
                            key={t.id}
                            onClick={(e) => openTask(t.id, e.currentTarget)}
                            aria-current={openTaskId === t.id ? 'true' : undefined}
                            className={cn(
                              'pg-item-title min-h-[44px] w-full rounded-md border border-border bg-card px-3 py-2.5 text-left transition-[background-color,color,border-color,box-shadow]',
                              t.status === 'done' && 'opacity-60',
                              openTaskId === t.id && 'border-border bg-accent text-accent-foreground shadow-[0_8px_24px_hsl(var(--foreground)/0.08)]',
                            )}
                          >
                            <span className={cn(t.status === 'done' && 'line-through')}>{t.title}</span>
                            {t.projectId && <span className="pg-meta mt-0.5 block">{ws.getProject(t.projectId)?.name}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </PageContainer>

        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent
            data-calendar-agenda
            className="z-[60] max-h-[min(680px,calc(100dvh-2rem))] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[480px]"
            onCloseAutoFocus={(event) => {
              if (openTaskId) event.preventDefault()
            }}
          >
            <DialogHeader className="border-b border-border bg-muted/25 px-5 py-4 pr-12 text-left">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300" aria-hidden>
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-[16px]">{relativeLabel(selectedIso)}</DialogTitle>
                    <span className="inline-flex rounded-[5px] border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                  <DialogDescription className="mt-1 text-[12px]">{format(selectedDay, 'EEEE, MMMM d')}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[min(520px,calc(100dvh-10rem))] overflow-y-auto p-2.5 scrollbar-thin">
              {selectedTasks.length === 0 ? (
                <p className="pg-body-muted px-3 py-10 text-center">No tasks due here.</p>
              ) : (
                <div className="space-y-1">
                  {selectedTasks.map((task) => {
                    const project = ws.getProject(task.projectId)
                    const tone = chipTone(task)
                    return (
                      <button
                        key={task.id}
                        aria-current={openTaskId === task.id ? 'true' : undefined}
                        onClick={(event) => {
                          openTask(task.id, event.currentTarget, { nonModal: true })
                        }}
                        className={cn(
                          'group flex min-h-11 w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-[background-color,border-color,transform] hover:border-border hover:bg-accent/55 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          openTaskId === task.id && 'border-border bg-accent',
                        )}
                      >
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={cn('pg-item-title block text-[13px]', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {project && <span className="pg-meta">{project.name}</span>}
                            <span className="pg-meta capitalize">{task.priority} priority</span>
                          </span>
                        </span>
                        <span className="mt-0.5 text-[12.5px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Open</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeTask ? (
          <div className="w-[180px]">
            <TaskChip task={activeTask} overlay onOpen={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
