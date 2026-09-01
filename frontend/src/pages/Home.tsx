import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Inbox as InboxIcon, StickyNote, ArrowRight, MoreHorizontal, Eye, EyeOff, Sprout, Clock, CheckCircle2, Circle,
} from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { TaskRow } from '@/components/TaskRow'
import { PageContainer, SectionHeader, EmptyState, ProjectChip } from '@/components/bits'
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
    () =>
      ws.state.recents
        .map((r) => {
          if (r.type === 'task') {
            const t = ws.getTask(r.id)
            return t ? { ...r, label: t.title } : null
          }
          if (r.type === 'project') {
            const p = ws.getProject(r.id)
            return p ? { ...r, label: p.name } : null
          }
          const n = ws.getNote(r.id)
          return n ? { ...r, label: n.title } : null
        })
        .filter((r): r is NonNullable<typeof r> => !!r)
        .slice(0, 5),
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
      <div className="rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(240_8%_10%/0.04)] mb-8">
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
            className="flex-1 h-11 border-0 bg-transparent px-0 text-[14px] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
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

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8 min-w-0">
          {/* Needs attention */}
          <section aria-labelledby="home-attention">
            <SectionHeader title="What needs your attention" count={attention.length} />
            {attention.length === 0 ? (
              <p className="pg-body-muted px-2 py-3">
                {data.doneToday.length > 0 ? 'All clear. Nice work today.' : 'Nothing overdue or due today. Enjoy the calm.'}
              </p>
            ) : (
              <div className="divide-y divide-border/60 border-y border-border/60">
                {attention.slice(0, 8).map((t) => (
                  <TaskRow key={t.id} task={t} mutedPriority />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming */}
          <section aria-labelledby="home-upcoming">
            <SectionHeader
              title="Coming up this week"
              count={data.upcoming.length}
              collapsible
              collapsed={!showUpcoming}
              onToggle={() => setShowUpcoming((v) => !v)}
            />
            {showUpcoming &&
              (data.upcoming.length === 0 ? (
                <p className="pg-body-muted px-2 py-3">Nothing scheduled this week. A blank week is a feature.</p>
              ) : (
                <div className="divide-y divide-border/60 border-y border-border/60">
                  {data.upcoming.slice(0, 7).map((t) => (
                    <TaskRow key={t.id} task={t} mutedPriority />
                  ))}
                </div>
              ))}
          </section>

          {/* Done today */}
          {!hideCompleted && data.doneToday.length > 0 && (
            <section aria-labelledby="home-done">
              <SectionHeader title="Done today" count={data.doneToday.length} />
              <div className="divide-y divide-border/60 border-y border-border/60">
                {data.doneToday.map((t) => (
                  <TaskRow key={t.id} task={t} mutedPriority />
                ))}
              </div>
            </section>
          )}

          {/* Project focus */}
          <section aria-labelledby="home-projects">
            <SectionHeader
              title="Project focus"
              collapsible
              collapsed={!showProjects}
              onToggle={() => setShowProjects((v) => !v)}
              action={
                <Link to={WORKSPACE_PATHS.projects} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                  All projects <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {showProjects && (
              <div className="border-y border-border/60 divide-y divide-border/60">
                {activeProjects.map((p) => {
                  const prog = ws.projectProgress(p.id)
                  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(workspaceProjectPath(p.id))}
                      className="w-full text-left px-2 py-2.5 hover:bg-accent/60 transition-colors rounded-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2"><span className="pg-item-title truncate">{p.name}</span><EntityTypeBadge type="project" /></span>
                        <span className="pg-meta shrink-0 tabular-nums">
                          {prog.done}/{prog.total} done
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Progress value={pct} className="h-1 flex-1" aria-label={`${pct}% complete`} />
                        {p.focus && <span className="pg-meta max-w-[55%] truncate">{p.focus}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-8 min-w-0">
          {/* Inbox summary */}
          <section aria-labelledby="home-inbox">
            <SectionHeader
              title="Inbox"
              count={ws.inbox.length}
              action={
                <Link to={WORKSPACE_PATHS.inbox} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
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
          </section>

          {/* Recent notes */}
          <section aria-labelledby="home-notes">
            <SectionHeader
              title="Recent notes"
              action={
                <Link to={WORKSPACE_PATHS.notes} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
                  All notes <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {recentNotes.length === 0 ? (
              <EmptyState icon={<StickyNote className="h-6 w-6" />} title="No notes yet" hint="Notes live close to your projects." />
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
          </section>

          {/* Recently opened */}
          {recents.length > 0 && (
            <section aria-labelledby="home-recent">
              <SectionHeader title="Recently opened" />
              <div className="border-y border-border/60 divide-y divide-border/60">
                {recents.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => {
                      if (r.type === 'task') openTask(r.id)
                      else if (r.type === 'project') navigate(workspaceProjectPath(r.id))
                      else navigate(workspaceNotePath(r.id))
                    }}
                    className="w-full text-left px-2 py-2 hover:bg-accent/60 transition-colors rounded-md flex items-center gap-2"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                    <span className="pg-item-title truncate">{r.label}</span>
                    <EntityTypeBadge type={r.type} className="ml-auto" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Quiet nudge */}
          <div className="rounded-lg bg-secondary/60 px-4 py-3.5 flex gap-3 items-start">
            <Sprout className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden />
            <p className="pg-body-muted text-[12.5px]">
              {attention.length > 0
                ? 'Start with one small thing. The rest can wait its turn.'
                : 'A clear list is a good excuse to close the app early.'}
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
