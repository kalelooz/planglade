import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Plus, FolderOpen, X, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/types'
import { EmptyState, PageContainer } from '@/components/bits'
import { isOverdue, relativeLabel, timeAgo } from '@/lib/dates'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group'
import { isValidProjectSlug, projectSlugFromName } from '@/lib/project-slug'
import { ProjectColorField, ProjectDateField, ProjectIconField } from '@/components/ProjectFields'
import { DEFAULT_PROJECT_COLOR } from '@/lib/project-fields'
import { DEFAULT_PROJECT_ICON, inferProjectIcon, projectIcon, type ProjectIconName } from '@/lib/project-icons'

export default function Projects() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ProjectStatus>('all')
  const [sort, setSort] = useState<'name' | 'progress' | 'due'>('name')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [desc, setDesc] = useState('')
  const [createStatus, setCreateStatus] = useState<Exclude<ProjectStatus, 'completed'>>('active')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR)
  const [icon, setIcon] = useState<ProjectIconName>(DEFAULT_PROJECT_ICON)
  const [iconEdited, setIconEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const projectStatuses = ws.supportsCompletedProjectStatus
    ? (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[])
    : (['active', 'in_review', 'on_hold', 'archived'] as const)

  const list = useMemo(() => {
    let l = [...ws.projects]
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    if (status !== 'all') l = l.filter((p) => p.status === status)
    const progressOf = (id: string) => {
      const pr = ws.projectProgress(id)
      return pr.total ? pr.done / pr.total : 0
    }
    const nextDue = (id: string) =>
      ws.tasks
        .filter((t) => t.projectId === id && t.status !== 'done' && t.dueDate)
        .map((t) => t.dueDate!)
        .sort()[0] ?? null
    l.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'progress') return progressOf(b.id) - progressOf(a.id)
      return (nextDue(a.id) ?? '9999').localeCompare(nextDue(b.id) ?? '9999')
    })
    return l
  }, [ws, search, status, sort])

  const portfolioSummary = useMemo(() => {
    const topLevelTasks = ws.tasks.filter((task) => !task.parentId)
    return [
      { label: 'Active projects', value: ws.projects.filter((project) => project.status === 'active').length },
      { label: 'In review', value: ws.projects.filter((project) => project.status === 'in_review').length },
      { label: 'On hold', value: ws.projects.filter((project) => project.status === 'on_hold').length },
      { label: 'Open tasks', value: topLevelTasks.filter((task) => task.status !== 'done').length },
      { label: 'Overdue', value: topLevelTasks.filter((task) => task.status !== 'done' && isOverdue(task.dueDate, false)).length },
    ]
  }, [ws.projects, ws.tasks])

  const create = async () => {
    if (!name.trim() || !isValidProjectSlug(slug) || (startDate && targetDate && targetDate < startDate) || saving) return
    setSaving(true)
    const p = await ws.addProject({
      name: name.trim(),
      slug: slug.trim(),
      description: desc.trim(),
      status: createStatus,
      color,
      icon,
      startDate: startDate || null,
      targetDate: targetDate || null,
    })
    setSaving(false)
    if (!p) return
    setCreateOpen(false)
    setName('')
    setSlug('')
    setSlugEdited(false)
    setDesc('')
    setCreateStatus('active')
    setStartDate('')
    setTargetDate('')
    setColor(DEFAULT_PROJECT_COLOR)
    setIcon(DEFAULT_PROJECT_ICON)
    setIconEdited(false)
    navigate(`/projects/${p.id}`)
  }

  return (
    <PageContainer width="wide" className="py-6 sm:py-8">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="pg-page-title">Projects</h1>
          <p className="pg-page-kicker">{ws.projects.filter((p) => p.status === 'active').length} active</p>
        </div>
        <InputGroup className="h-8 w-[160px] border-input bg-card shadow-none sm:w-[200px]">
          <InputGroupAddon className="pl-2.5 pr-0">
            <Search className="h-3.5 w-3.5" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="h-8 px-2 text-[13px] placeholder:text-muted-foreground/60"
          />
          {search && (
            <InputGroupButton type="button" size="icon-sm" onClick={() => setSearch('')} aria-label="Clear search" className="mr-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </InputGroupButton>
          )}
        </InputGroup>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-8 w-auto text-[13px] border-input bg-card" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {projectStatuses.map((s) => (
              <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-8 w-auto text-[13px] border-input bg-card" aria-label="Sort projects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by name</SelectItem>
            <SelectItem value="progress">Sort by progress</SelectItem>
            <SelectItem value="due">Sort by next due</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New project
        </button>
      </header>

      <dl className="mb-6 flex max-w-full flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border/60 bg-card/70 px-4 py-3 shadow-[0_1px_2px_hsl(var(--foreground)/0.03)]" aria-label="Project portfolio overview">
        {portfolioSummary.map((item) => (
          <div key={item.label} className="flex shrink-0 items-baseline gap-1.5">
            <dd className="text-base font-semibold tabular-nums">{item.value}</dd>
            <dt className="text-[12.5px] text-muted-foreground">{item.label}</dt>
          </div>
        ))}
      </dl>

      {list.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-7 w-7" />} title="No projects found" hint="Try a different search or create a new project." />
      ) : (
        <div className="border-y border-border/60 divide-y divide-border/60">
          {list.map((p) => {
            const prog = ws.projectProgress(p.id)
            const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0
            const open = ws.tasks.filter((t) => t.projectId === p.id && t.status !== 'done' && !t.parentId)
            const nextDue = open.filter((t) => t.dueDate).map((t) => t.dueDate!).sort()[0] ?? null
            const overdueCount = open.filter((t) => isOverdue(t.dueDate, false)).length
            const recentNote = ws.notes.filter((n) => n.projectId === p.id).sort((a, b) => b.updatedAt - a.updatedAt)[0]
            const ProjectIcon = projectIcon(p.source?.icon ?? inferProjectIcon(p.name)).icon
            return (
              <button
                key={p.id}
                onClick={() => { ws.pushRecent({ type: 'project', id: p.id }); navigate(`/projects/${p.id}`) }}
                className="w-full text-left px-2 sm:px-3 py-3 hover:bg-accent/50 transition-colors rounded-md group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ProjectIcon className="h-4 w-4 shrink-0" style={{ color: p.source?.color ?? DEFAULT_PROJECT_COLOR }} aria-hidden />
                      <span className="text-[14px] font-medium truncate">{p.name}</span>
                      <span className={cn('text-[12.5px] rounded px-1.5 py-px shrink-0', p.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : p.status === 'on_hold' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400')}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                      {overdueCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[12.5px] text-red-600 dark:text-red-400 shrink-0">
                          <CircleAlert className="h-3 w-3" /> {overdueCount} overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground truncate mt-0.5">{p.description}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 shrink-0 text-[12.5px] text-muted-foreground">
                    <div className="w-[110px]">
                      <div className="flex justify-between mb-1">
                        <span className="tabular-nums">{pct}%</span>
                        <span className="tabular-nums">{prog.done}/{prog.total}</span>
                      </div>
                      <Progress value={pct} className="h-1" aria-label={`${p.name} progress: ${pct}%`} />
                    </div>
                    <span className="w-[86px] text-right">{nextDue ? relativeLabel(nextDue) : 'No due date'}</span>
                  </div>
                </div>
                {recentNote && (
                  <p className="text-[12.5px] text-muted-foreground/80 mt-1 truncate pl-0">
                    Latest note: {recentNote.title} · {timeAgo(recentNote.updatedAt)}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base">New project</DialogTitle>
            <DialogDescription className="sr-only">Create a project to group tasks and notes.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="np-name" className="text-[12px] text-muted-foreground">Name</label>
              <input
                id="np-name"
                autoFocus
                required
                value={name}
                onChange={(e) => {
                  const nextName = e.target.value
                  setName(nextName)
                  if (!slugEdited) setSlug(projectSlugFromName(nextName))
                  if (!iconEdited) setIcon(inferProjectIcon(nextName))
                }}
                placeholder="e.g. Autumn workshop series"
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 h-9 text-[14px] outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label htmlFor="np-slug" className="text-[12px] text-muted-foreground">Project URL slug</label>
              <input
                id="np-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true)
                  setSlug(e.target.value.toLowerCase())
                }}
                placeholder="e.g. autumn-workshop-series"
                pattern="[a-z0-9-]{2,50}"
                required
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 h-9 text-[14px] outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label htmlFor="np-desc" className="text-[12px] text-muted-foreground">Short description</label>
              <textarea
                id="np-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60 resize-none"
              />
            </div>
            <fieldset>
              <legend className="text-[12px] text-muted-foreground">Schedule</legend>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <ProjectDateField id="np-start-date" label="Start date" value={startDate} onChange={setStartDate} />
                <ProjectDateField id="np-target-date" label="Target date" value={targetDate} min={startDate || undefined} onChange={setTargetDate} />
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectColorField id="np-color" value={color} onChange={setColor} />
              <ProjectIconField id="np-icon" value={icon} color={color} onChange={(value) => { setIconEdited(true); setIcon(value) }} />
            </div>
            <div>
              <label htmlFor="np-status" className="text-[12px] text-muted-foreground">Status</label>
              <Select value={createStatus} onValueChange={(value) => setCreateStatus(value as Exclude<ProjectStatus, 'completed'>)}>
                <SelectTrigger id="np-status" className="mt-1 h-9 w-full text-[13px] border-input bg-card" aria-label="Project status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['active', 'in_review', 'on_hold', 'archived'] as const).map((value) => <SelectItem key={value} value={value}>{PROJECT_STATUS_LABELS[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} aria-busy={saving} className="h-8 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
