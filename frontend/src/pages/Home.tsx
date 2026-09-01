import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Inbox as InboxIcon, StickyNote, ArrowRight, MoreHorizontal, Eye, EyeOff, CheckCircle2, Circle, Clock,
} from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { TaskRow } from '@/components/TaskRow'
import { PageContainer, SectionHeader, ProjectChip } from '@/components/bits'
import { greeting, friendlyToday, isOverdue, isDueToday, timeAgo } from '@/lib/dates'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { WORKSPACE_PATHS, workspaceNotePath, workspaceProjectPath } from '@/lib/workspace-routes'
import { useSubmissionLifecycle } from '@/lib/use-submission-lifecycle'
import { EntityTypeBadge } from '@/components/EntityTypeBadge'
import { EngagementPrompt } from '@/components/EngagementPrompt'
import { cn } from '@/lib/utils'

function HomeCard({
  id,
  title,
  count,
  action,
  children,
  className,
}: {
  id: string
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]',
        className,
      )}
    >
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <SectionHeader id={id} title={title} count={count} action={action} />
      </div>
      {children}
    </section>
  )
}

export default function Home() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const { openTask } = useTaskDrawer()
  const [captureText, setCaptureText] = useState('')
  const { invalidate: invalidateCapture, pending: captureSaving, submit: submitCaptureOperation } = useSubmissionLifecycle()
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [showProjects, setShowProjects] = useState(true)
  const hideCompleted = ws.state.settings.hideHomeCompleted

  const data = useMemo(() => {
    const today = startOfDay(new Date())
    const open = ws.tasks.filter((t) => t.status !== 'done' && !t.parentId)
    const overdue = open.filter((t) => isOverdue(t.dueDate, false))
    const dueToday = open.filter((t) => isDueToday(t.dueDate))
    const blocked = open.filter((t) => ws.isBlocked(t) && !isOverdue(t.dueDate, false) && !isDueToday(t.dueDate))
    const blocking = open.filter((t) => !ws.isBlocked(t) && ws.tasks.some((candidate) => candidate.status !== 'done' && candidate.dependsOn.includes(t.id)))
    const upcoming = open
      .filter((t) => {
        if (!t.dueDate) return false
        const d = differenceInCalendarDays(parseISO(t.dueDate), today)
        return d > 0 && d <= 7
      })
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    const doneToday = ws.tasks.filter(
      (t) => t.status === 'done' && t.completedAt && differenceInCalendarDays(new Date(), new Date(t.completedAt)) === 0,
    )
    return { overdue, dueToday, blocked, blocking, upcoming, doneToday }
  }, [ws])

  const attention = useMemo(() => {
    const seen = new Set<string>()
    return [...data.overdue, ...data.dueToday, ...data.blocked, ...data.blocking].filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
  }, [data])

  const recentNotes = useMemo(() => [...ws.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [ws.notes])
  const activeProjects = useMemo(() => ws.projects.filter((p) => p.status === 'active').slice(0, 4), [ws.projects])
  const recents = useMemo(
    () => ws.state.recents
      .map((recent) => {
        if (recent.type === 'task') {
          const task = ws.getTask(recent.id)
          return task ? { ...recent, label: task.title } : null
        }
        if (recent.type === 'project') {
          const project = ws.getProject(recent.id)
          return project ? { ...recent, label: project.name } : null
        }
        const note = ws.getNote(recent.id)
        return note ? { ...recent, label: note.title } : null
      })
      .filter((recent): recent is NonNullable<typeof recent> => Boolean(recent))
      .slice(0, 3),
    [ws],
  )

  const submitCapture = async () => {
    if (!ws.canMutateTasks) return
    const text = captureText.trim()
    if (!text) return
    await submitCaptureOperation(
      { text },
      (submission) => ws.capture(submission.text),
      Boolean,
      () => setCaptureText(''),
    )
  }

  const hour = new Date().getHours()
  const firstName = ws.state.userName
  const firstRunSteps = [
    {
      label: 'Capture your first task',
      detail: 'Put one real item in Inbox. You can organize it later.',
      href: WORKSPACE_PATHS.inbox,
      action: 'Open Inbox',
      complete: ws.tasks.length + ws.inbox.length > 0,
    },
    {
      label: 'Create a project',
      detail: 'Give related tasks and notes a shared home.',
      href: WORKSPACE_PATHS.projects,
      action: 'Open Projects',
      complete: ws.projects.length > 0,
    },
    {
      label: 'Write a note',
      detail: 'Keep context beside the work it supports.',
      href: WORKSPACE_PATHS.notes,
      action: 'Open Notes',
      complete: ws.notes.length > 0,
    },
  ]
  const completedFirstRunSteps = firstRunSteps.filter((step) => step.complete).length
  const showFirstRun = ws.mode.kind === 'server' && completedFirstRunSteps < firstRunSteps.length

  return (
    <PageContainer width="wide" className="py-6 sm:py-8">
      {/* Greeting */}
      <header className="flex items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="pg-page-title">
            {greeting()}{hour >= 5 && hour < 22 ? `, ${firstName}` : ''}.
          </h1>
          <p className="pg-page-kicker">{friendlyToday()}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Home display options" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => ws.updateSettings({ hideHomeCompleted: !hideCompleted })}>
              {hideCompleted ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {hideCompleted ? 'Show completed today' : 'Hide completed today'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <EngagementPrompt
        eligible={ws.mode.kind === 'server' && completedFirstRunSteps === firstRunSteps.length}
        storageKey={`planglade-engagement-v1-${ws.workspaceId ?? 'self-hosted'}`}
        plansHref={WORKSPACE_PATHS.plans}
      />

      {/* Quick capture */}
      <div className="mb-8 overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
        <div className="flex items-center gap-2.5 px-3.5">
          <InboxIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <Input
            value={captureText}
            onChange={(e) => {
              invalidateCapture()
              setCaptureText(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submitCapture()}
            disabled={!ws.canMutateTasks || captureSaving}
            placeholder={ws.canMutateTasks ? 'Capture something - organize it later' : 'Task capture is read-only in API mode'}
            aria-label="Quick capture to inbox"
            className="h-11 flex-1 rounded-none border-0 bg-transparent px-0 text-[14px] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
          />
          {captureText.trim() && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={captureSaving}
              aria-busy={captureSaving}
              onClick={() => void submitCapture()}
              className="h-8 px-2 text-[13px] font-medium text-foreground disabled:opacity-40"
            >
              {captureSaving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {showFirstRun && (
        <section aria-labelledby="first-run-title" className="mb-8 rounded-lg border border-border/70 bg-card p-4 shadow-[0_1px_2px_hsl(240_8%_10%/0.04)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">First workspace</p>
              <h2 id="first-run-title" className="mt-1 text-base font-semibold tracking-tight">Make PlanGlade yours</h2>
              <p className="mt-1 text-sm text-muted-foreground">These steps update from your real workspace. No sample records are added.</p>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground" aria-label={`${completedFirstRunSteps} of ${firstRunSteps.length} setup steps complete`}>
              {completedFirstRunSteps}/{firstRunSteps.length} complete
            </p>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {firstRunSteps.map((step) => (
              <li key={step.label} className="rounded-md bg-secondary/55 p-3">
                <div className="flex items-start gap-2.5">
                  {step.complete
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                    : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                    {step.complete ? (
                      <p className="mt-2 text-xs font-medium text-foreground">Complete</p>
                    ) : (
                      <Link className="mt-2 inline-flex min-h-8 items-center text-xs font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" to={step.href}>
                        {step.action}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className="min-w-0 space-y-4">
          <HomeCard
            id="home-attention"
            title="What needs your attention"
            count={attention.length}
            action={<Link to={WORKSPACE_PATHS.tasks} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">View tasks <ArrowRight className="h-3 w-3" /></Link>}
          >
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
            {attention.length === 0 ? (
              <p className="pg-body-muted px-2 py-3">
                {data.doneToday.length > 0 ? 'All clear. Nice work today.' : 'Nothing overdue or due today. Enjoy the calm.'}
              </p>
            ) : (
              <div className="divide-y divide-border/60 border-y border-border/60">
                {attention.slice(0, 4).map((t) => (
                  <TaskRow key={t.id} task={t} mutedPriority />
                ))}
              </div>
            )}
            </div>

            <div className="border-t border-border/60">
              <div className="px-4 pt-4 sm:px-5">
                <SectionHeader
                  id="home-upcoming"
                  title="Coming up this week"
                  count={data.upcoming.length}
                  collapsible
                  collapsed={!showUpcoming}
                  onToggle={() => setShowUpcoming((value) => !value)}
                />
              </div>
              {showUpcoming && (
                <div className="px-2 pb-2 sm:px-3 sm:pb-3">
                  {data.upcoming.length === 0 ? (
                    <p className="pg-body-muted px-2 py-3">Nothing scheduled this week. A blank week is a feature.</p>
                  ) : (
                    <div className="divide-y divide-border/60 border-y border-border/60">
                      {data.upcoming.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} mutedPriority />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!hideCompleted && data.doneToday.length > 0 && (
              <div className="border-t border-border/60">
                <div className="px-4 pt-4 sm:px-5"><SectionHeader id="home-done" title="Done today" count={data.doneToday.length} /></div>
                <div className="divide-y divide-border/60 px-2 pb-2 sm:px-3 sm:pb-3">
                  {data.doneToday.map((task) => <TaskRow key={task.id} task={task} mutedPriority />)}
                </div>
              </div>
            )}
          </HomeCard>

          <HomeCard
            id="home-projects"
            title="Project focus"
            action={<Link to={WORKSPACE_PATHS.projects} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">All projects <ArrowRight className="h-3 w-3" /></Link>}
          >
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
              <button
                type="button"
                className="mb-1 inline-flex min-h-11 items-center rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground lg:min-h-8"
                aria-expanded={showProjects}
                onClick={() => setShowProjects((value) => !value)}
              >
                {showProjects ? 'Hide project progress' : 'Show project progress'}
              </button>
              {showProjects && (activeProjects.length === 0 ? (
                <p className="pg-body-muted px-2 py-3">No active projects yet.</p>
              ) : (
                <div className="divide-y divide-border/60 border-y border-border/60">
                  {activeProjects.map((project) => {
                    const progress = ws.projectProgress(project.id)
                    const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
                    return (
                      <button key={project.id} onClick={() => navigate(workspaceProjectPath(project.id))} className="w-full rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2"><span className="pg-item-title truncate">{project.name}</span><EntityTypeBadge type="project" /></span>
                          <span className="pg-meta shrink-0 tabular-nums">{progress.done}/{progress.total} done</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <Progress value={percent} className="h-1 flex-1" aria-label={`${percent}% complete`} />
                          {project.focus && <span className="pg-meta max-w-[55%] truncate">{project.focus}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </HomeCard>
        </div>

        <div className="min-w-0 space-y-4">
          <HomeCard id="home-inbox" title="Inbox" count={ws.inbox.length} action={<Link to={WORKSPACE_PATHS.inbox} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">Open <ArrowRight className="h-3 w-3" /></Link>}>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
            {ws.inbox.length === 0 ? (
              <p className="pg-body-muted px-2 py-3">Inbox zero. Savor it.</p>
            ) : (
              <div className="border-y border-border/60 divide-y divide-border/60">
                {ws.inbox.slice(0, 3).map((i) => (
                  <Link key={i.id} to={WORKSPACE_PATHS.inbox} className="block px-2 py-2 hover:bg-accent/60 transition-colors rounded-md">
                    <div className="flex min-w-0 items-center gap-2"><p className="pg-item-title min-w-0 flex-1 truncate">{i.text}</p><EntityTypeBadge type="capture" /></div>
                    <p className="pg-meta mt-0.5">{timeAgo(i.createdAt)}</p>
                </Link>
              ))}
                {ws.inbox.length > 3 && (
                  <Link to={WORKSPACE_PATHS.inbox} className="block px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    +{ws.inbox.length - 3} more to organize
                  </Link>
                )}
              </div>
            )}
            </div>
            {recents.length > 0 && (
              <div className="border-t border-border/60">
                <div className="px-4 pt-4 sm:px-5"><h3 id="home-recent" className="pg-section-title mb-2">Recently opened</h3></div>
                <div className="divide-y divide-border/60 px-2 pb-2 sm:px-3 sm:pb-3" aria-labelledby="home-recent">
                  {recents.map((recent) => (
                    <button
                      key={`${recent.type}-${recent.id}`}
                      onClick={() => {
                        if (recent.type === 'task') openTask(recent.id)
                        else if (recent.type === 'project') navigate(workspaceProjectPath(recent.id))
                        else navigate(workspaceNotePath(recent.id))
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60 lg:min-h-9"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="pg-item-title min-w-0 flex-1 truncate">{recent.label}</span>
                      <EntityTypeBadge type={recent.type} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </HomeCard>

          <HomeCard id="home-notes" title="Recent notes" action={<Link to={WORKSPACE_PATHS.notes} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">All notes <ArrowRight className="h-3 w-3" /></Link>}>
            <div className="px-2 pb-2 sm:px-3 sm:pb-3">
            {recentNotes.length === 0 ? (
              <div className="flex items-start gap-2 px-2 py-3"><StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /><p className="pg-body-muted">No notes yet. Notes live close to your projects.</p></div>
            ) : (
              <div className="border-y border-border/60 divide-y divide-border/60">
                {recentNotes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => navigate(workspaceNotePath(n.id))}
                    className="w-full text-left px-2 py-2 hover:bg-accent/60 transition-colors rounded-md"
                  >
                    <div className="flex min-w-0 items-center gap-2"><p className="pg-item-title min-w-0 flex-1 truncate">{n.title}</p><EntityTypeBadge type="note" /></div>
                    <p className="pg-meta mt-0.5 flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0">{timeAgo(n.updatedAt)}</span>
                      {n.projectId && <ProjectChip project={ws.getProject(n.projectId)} className="truncate" />}
                    </p>
                  </button>
                ))}
              </div>
            )}
            </div>
          </HomeCard>
        </div>
      </div>
    </PageContainer>
  )
}
