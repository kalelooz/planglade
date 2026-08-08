import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, SlidersHorizontal, Plus, ArrowUpDown, CheckSquare, X, Rows3,
} from 'lucide-react'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import type { Task, TaskStatus } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/types'
import { TaskRow } from '@/components/TaskRow'
import { Board } from '@/pages/Board'
import { TaskTimeline } from '@/pages/TaskTimeline'
import { TASK_VIEW_CATALOG } from '@/lib/task-view-catalog'
import { CountBadge, EmptyState, PageContainer } from '@/components/bits'
import { isOverdue, isDueToday } from '@/lib/dates'
import {
  taskPresentationFromQuery,
  taskPresentationToQuery,
  type TaskGroup as GroupKey,
  type TaskQuickFilter as QuickFilter,
  type TaskSort as SortKey,
  type TaskPresentation,
  type TaskView,
} from '@/lib/task-views'
import { useSavedViews } from '@/hooks/use-saved-views'
import { savedViewToPresentation } from '@/lib/saved-presentations'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group'

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'no_date', label: 'No date' },
  { key: 'blocked', label: 'Blocked' },
]

function NewTaskDialog({
  open,
  onOpenChange,
  defaultStatus,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultStatus: TaskStatus
}) {
  const ws = useWorkspace()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string>('none')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<'none' | 'low' | 'medium' | 'high'>('none')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base">New task</DialogTitle>
          <DialogDescription className="sr-only">Create a task. You can add details later.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!title.trim() || saving) return
            setSaving(true)
            const saved = await ws.addTask({
              title: title.trim(),
              projectId: projectId === 'none' ? null : projectId,
              status,
              ...(priority !== 'none' ? { priority } : {}),
              dueDate: dueDate || null,
            })
            setSaving(false)
            if (saved || !ws.readOnly) onOpenChange(false)
          }}
          className="space-y-3"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="Task title"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60 py-1"
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-8 text-[13px] w-auto min-w-[130px]" aria-label="Project">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {ws.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={saving}>
              <SelectTrigger className="h-8 text-[13px] w-auto" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).filter((s) => !ws.readOnly || s !== 'blocked').map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)} disabled={saving}>
              <SelectTrigger className="h-8 text-[13px] w-auto" aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as Array<typeof priority>).filter((p) => !ws.readOnly || p !== 'none').map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className="sr-only">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
                aria-label="Due date"
                className="h-8 rounded-md border border-input bg-card px-2 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim() || saving} aria-busy={saving} className="h-8 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Tasks() {
  const ws = useWorkspace()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const presentation = taskPresentationFromQuery(searchParams)
  const { view, search, showCompleted, sort, group } = presentation
  const quick = useMemo(() => new Set(presentation.quick), [presentation.quick])
  const projectFilter = useMemo(() => new Set(presentation.projects), [presentation.projects])
  const priorityFilter = useMemo(() => new Set(presentation.priorities), [presentation.priorities])
  const workspaceId = ws.workspaceId ?? 'reference-workspace'
  const savedViews = useSavedViews(workspaceId)
  const defaultApplied = useRef(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<TaskStatus>('planned')
  const newTaskRequested = ws.canMutateTasks && !!(location.state as { newTask?: boolean } | null)?.newTask
  const newTaskDialogOpen = newOpen || newTaskRequested

  useEffect(() => {
    if (defaultApplied.current || savedViews.loading) return
    defaultApplied.current = true
    if (searchParams.toString()) return
    const defaultView = savedViews.views.find((saved) => saved.isDefault)
    if (defaultView) setSearchParams(taskPresentationToQuery(savedViewToPresentation(defaultView), defaultView.id), { replace: true })
  }, [savedViews.loading, savedViews.views, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    const today = startOfDay(new Date())
    let list = ws.tasks.filter((t) => !t.parentId)
    if (!showCompleted) list = list.filter((t) => t.status !== 'done')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    }
    if (quick.size > 0) {
      list = list.filter((t) => {
        const checks: Record<QuickFilter, boolean> = {
          today: isDueToday(t.dueDate),
          upcoming: !!t.dueDate && differenceInCalendarDays(parseISO(t.dueDate), today) > 0,
          overdue: isOverdue(t.dueDate, t.status === 'done'),
          no_date: !t.dueDate,
          blocked: ws.isBlocked(t),
        }
        return Array.from(quick).some((k) => checks[k])
      })
    }
    if (projectFilter.size > 0) list = list.filter((t) => t.projectId && projectFilter.has(t.projectId))
    if (priorityFilter.size > 0) list = list.filter((t) => priorityFilter.has(t.priority))
    const prioRank = { high: 0, medium: 1, low: 2, none: 3 }
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'due':
          return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.createdAt - b.createdAt
        case 'priority':
          return prioRank[a.priority] - prioRank[b.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
        case 'created':
          return b.createdAt - a.createdAt
        case 'title':
          return a.title.localeCompare(b.title)
      }
    })
    return sorted
  }, [ws, search, quick, projectFilter, priorityFilter, showCompleted, sort])

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '', tasks: filtered }]
    const map = new Map<string, Task[]>()
    const labelOf = (key: string) => {
      if (group === 'project') return key === 'none' ? 'No project' : ws.getProject(key)?.name ?? 'No project'
      if (group === 'status') return STATUS_LABELS[key as TaskStatus]
      // due
      if (key === 'overdue') return 'Overdue'
      if (key === 'today') return 'Today'
      if (key === 'week') return 'This week'
      if (key === 'later') return 'Later'
      return 'No date'
    }
    const keyOf = (t: Task) => {
      if (group === 'project') return t.projectId ?? 'none'
      if (group === 'status') return t.status
      if (!t.dueDate) return 'none'
      const d = differenceInCalendarDays(parseISO(t.dueDate), startOfDay(new Date()))
      if (d < 0) return 'overdue'
      if (d === 0) return 'today'
      if (d <= 7) return 'week'
      return 'later'
    }
    filtered.forEach((t) => {
      const k = keyOf(t)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    })
    const order = group === 'due' ? ['overdue', 'today', 'week', 'later', 'none'] : group === 'status' ? ['backlog', 'planned', 'in_progress', 'in_review', 'blocked', 'done'] : Array.from(map.keys())
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ key: k, label: labelOf(k), tasks: map.get(k)! }))
  }, [filtered, group, ws])

  const activeFilterCount = quick.size + projectFilter.size + priorityFilter.size

  const taskCounts = useMemo(() => {
    const scope = ws.tasks.filter((task) => !task.parentId)
    return [
      { label: 'Open', value: scope.filter((task) => task.status !== 'done').length },
      { label: 'Backlog', value: scope.filter((task) => task.status === 'backlog').length },
      { label: 'In progress', value: scope.filter((task) => task.status === 'in_progress').length },
      { label: 'In review', value: scope.filter((task) => task.status === 'in_review').length },
      { label: 'Done', value: scope.filter((task) => task.status === 'done').length },
    ]
  }, [ws.tasks])

  const updatePresentation = (patch: Partial<TaskPresentation>, replace = false) => {
    setSearchParams(taskPresentationToQuery({ ...presentation, ...patch }, searchParams.get('saved')), { replace })
  }

  const chooseBuiltInView = (nextView: TaskView) => setSearchParams(taskPresentationToQuery({ ...presentation, view: nextView }))

  const toggleSet = <T,>(set: Set<T>, v: T, apply: (values: T[]) => void) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    apply([...n])
  }

  const openNew = (status: TaskStatus = 'planned') => {
    if (!ws.canMutateTasks || (ws.readOnly && status === 'blocked')) return
    setNewStatus(status)
    setNewOpen(true)
  }

  return (
    <div className="flex w-full min-w-0 flex-col flex-1 min-h-0 overflow-x-hidden">
      <PageContainer width="wide" className="pt-5 sm:pt-7">
        <header className="mb-5">
          <div className="flex items-center gap-3">
            <div className="mr-auto">
              <h1 className="pg-page-title">Tasks</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Plan, review, and present work from one place.</p>
            </div>
            <button
              onClick={() => openNew()}
              disabled={!ws.canMutateTasks}
              title={!ws.canMutateTasks ? 'Task creation is unavailable in read-only mode' : undefined}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
          </div>

          <dl className="mt-4 flex max-w-full flex-wrap gap-1.5 rounded-xl border border-border/50 bg-card/45 p-1 shadow-[0_1px_2px_hsl(var(--foreground)/0.03)]" aria-label="Task summary">
            {taskCounts.map((item) => (
              <div key={item.label} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground">
                <dt className="text-[11px] leading-none">{item.label}</dt>
                <dd className="text-[11px] font-medium leading-none tabular-nums text-foreground/70">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5 overflow-x-hidden rounded-2xl border border-border/60 bg-card/80 p-1.5 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_hsl(var(--foreground)/0.035)] backdrop-blur">
            <div className="grid w-full flex-none grid-cols-3 gap-1 sm:w-auto sm:flex sm:shrink-0 sm:items-center" role="tablist" aria-label="Task view">
              {TASK_VIEW_CATALOG.map((item) => {
                const Icon = item.icon
                const selected = view === item.view
                return (
                  <button
                    key={item.view}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => chooseBuiltInView(item.view)}
                    className={cn(
                      'relative isolate inline-flex h-8 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-xl px-1.5 text-[12px] transition-[color,transform] duration-200 active:scale-[0.96] sm:shrink-0',
                      selected ? 'text-background' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="task-view-active-pill"
                        className="absolute inset-0 rounded-xl bg-foreground shadow-[0_6px_18px_hsl(var(--foreground)/0.16)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5" aria-hidden /> <span className="relative z-10 truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <InputGroup className="h-9 w-full min-w-[8.5rem] flex-1 border-input bg-background/80 shadow-none sm:w-[132px] sm:flex-none lg:h-8 xl:w-[160px]">
            <InputGroupAddon className="pl-2.5 pr-0">
              <Search className="h-3.5 w-3.5" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(e) => updatePresentation({ search: e.target.value }, true)}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="h-9 px-2 text-[13px] placeholder:text-muted-foreground/60 lg:h-8"
            />
            {search && (
              <InputGroupButton type="button" size="icon-sm" onClick={() => updatePresentation({ search: '' })} aria-label="Clear search" className="mr-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </InputGroupButton>
            )}
          </InputGroup>

          <Popover>
            <PopoverTrigger asChild>
              <button className={cn('inline-flex h-9 shrink-0 items-center gap-1 rounded-md border px-2 text-[13px] transition-colors lg:h-8', activeFilterCount > 0 ? 'border-foreground/30 bg-accent text-foreground' : 'border-input bg-background/80 text-muted-foreground hover:text-foreground')} aria-label="Filters">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {activeFilterCount > 0 && <CountBadge count={activeFilterCount} label={`${activeFilterCount} active filters`} className="border-foreground bg-foreground text-background" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">When</p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        aria-pressed={quick.has(f.key)}
                        onClick={() => toggleSet(quick, f.key, (values) => updatePresentation({ quick: values }))}
                        className={cn('rounded-full border px-2.5 py-1 text-[12px] transition-colors', quick.has(f.key) ? 'border-foreground/40 bg-accent text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-input')}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Project</p>
                  <div className="flex flex-wrap gap-1">
                    {ws.projects.map((p) => (
                      <button
                        key={p.id}
                        aria-pressed={projectFilter.has(p.id)}
                        onClick={() => toggleSet(projectFilter, p.id, (values) => updatePresentation({ projects: values }))}
                        className={cn('rounded-full border px-2.5 py-1 text-[12px] transition-colors max-w-[160px] truncate', projectFilter.has(p.id) ? 'border-foreground/40 bg-accent text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-input')}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Priority</p>
                  <div className="flex flex-wrap gap-1">
                    {(['high', 'medium', 'low'] as const).map((p) => (
                      <button
                        key={p}
                        aria-pressed={priorityFilter.has(p)}
                        onClick={() => toggleSet(priorityFilter, p, (values) => updatePresentation({ priorities: values }))}
                        className={cn('rounded-full border px-2.5 py-1 text-[12px] capitalize transition-colors', priorityFilter.has(p) ? 'border-foreground/40 bg-accent text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-input')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <>
                    <Separator />
                    <button
                      onClick={() => updatePresentation({ quick: [], projects: [], priorities: [] })}
                      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {(view === 'list' || view === 'board') && <Select value={sort} onValueChange={(v) => updatePresentation({ sort: v as SortKey })}>
            <SelectTrigger className="h-9 w-auto shrink-0 gap-1 border-input bg-background/80 px-2 text-[13px] data-[size=default]:h-9 lg:h-8 lg:data-[size=default]:h-8" aria-label="Sort tasks">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="priority">Prio</SelectItem>
              <SelectItem value="created">New</SelectItem>
              <SelectItem value="title">A-Z</SelectItem>
            </SelectContent>
          </Select>}

          {view === 'list' && <Select value={group} onValueChange={(v) => updatePresentation({ group: v as GroupKey })}>
              <SelectTrigger className="h-9 w-auto shrink-0 border-input bg-background/80 px-2 text-[13px] data-[size=default]:h-9 lg:h-8 lg:data-[size=default]:h-8" aria-label="Group tasks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Group</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="due">Due date</SelectItem>
              </SelectContent>
          </Select>}

          {(view === 'list' || view === 'board') && <Popover>
            <PopoverTrigger asChild><button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background/80 text-muted-foreground hover:text-foreground lg:h-8 lg:w-8" aria-label="Display options"><Rows3 className="h-3.5 w-3.5" /></button></PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-2">
              <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">Density</p>
              {(['comfortable', 'compact'] as const).map((density) => <button key={density} onClick={() => updatePresentation({ density })} className={cn('w-full rounded px-2 py-1.5 text-left text-[12px] capitalize hover:bg-accent', presentation.density === density && 'bg-accent font-medium')}>{density}</button>)}
              <Separator className="my-2" />
              <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">Visible fields</p>
              {([['project', 'Project'], ['status', 'Status'], ['dueDate', 'Due date'], ['priority', 'Priority']] as const).map(([field, label]) => <label key={field} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-accent"><input type="checkbox" checked={presentation.fields.includes(field)} onChange={() => toggleSet(new Set(presentation.fields), field, (fields) => updatePresentation({ fields }))} /> {label}</label>)}
            </PopoverContent>
          </Popover>}

          <label className="ml-auto inline-flex min-h-9 shrink-0 cursor-pointer select-none items-center gap-2 pl-1 text-[12.5px] text-muted-foreground lg:min-h-8">
            <Switch checked={showCompleted} onCheckedChange={(checked) => updatePresentation({ showCompleted: checked })} aria-label="Show completed tasks" />
            Done
          </label>
        </div>
        </header>
      </PageContainer>

      {/* Content */}
      {view === 'list' ? (
        <PageContainer className="pb-10">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-7 w-7" />}
              title={search || activeFilterCount > 0 ? 'No tasks match' : 'No open tasks'}
              hint={search || activeFilterCount > 0 ? 'Try widening the filters or search.' : 'Everything is done, or nothing exists yet. Capture something to get started.'}
              action={
                activeFilterCount > 0 ? (
                  <button onClick={() => updatePresentation({ quick: [], projects: [], priorities: [], search: '' })} className="text-[13px] text-foreground underline underline-offset-4">
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            groups.map((g) => (
              <section
                key={g.key}
                aria-labelledby={g.label ? `task-group-${g.key}` : undefined}
                className={cn(
                  'mb-5',
                  group !== 'none' && 'overflow-hidden rounded-lg border border-border/60 bg-card/35',
                )}
              >
                {g.label && (
                  <h2
                    id={`task-group-${g.key}`}
                    className="flex min-h-10 items-center gap-2 border-b border-border/50 bg-muted/20 px-3 text-[11px] font-semibold uppercase text-foreground/75"
                  >
                    <span>{g.label}</span>
                    <CountBadge count={g.tasks.length} label={`${g.tasks.length} tasks`} />
                  </h2>
                )}
                <div className={cn('divide-y divide-border/50', group === 'none' && 'border-y border-border/60')}>
                  <AnimatePresence initial={false}>
                    {g.tasks.map((t) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{ duration: 0.16, ease: 'easeOut', layout: { duration: 0.18, ease: 'easeOut' } }}
                      >
                        <TaskRow task={t} showStatus listMobileLayout compact={presentation.density === 'compact'} visibleFields={new Set(presentation.fields)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))
          )}
        </PageContainer>
      ) : view === 'board' ? (
        <div className="flex w-full min-w-0 flex-1 min-h-0 flex-col overflow-hidden">
          {filtered.length === 0 ? (
            <PageContainer>
              <EmptyState icon={<CheckSquare className="h-7 w-7" />} title="No tasks match" hint="Try widening the filters." />
            </PageContainer>
          ) : (
            <Board tasks={filtered} onAddTask={(s) => openNew(s)} density={presentation.density} visibleFields={new Set(presentation.fields)} />
          )}
        </div>
      ) : (
        <TaskTimeline tasks={filtered} />
      )}

      <NewTaskDialog
        key={`${newTaskDialogOpen}-${newStatus}`}
        open={newTaskDialogOpen}
        onOpenChange={(next) => {
          setNewOpen(next)
          if (!next && newTaskRequested) navigate(location.pathname, { replace: true, state: null })
        }}
        defaultStatus={newStatus}
      />
    </div>
  )
}
