import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, FolderOpen, Plus, StickyNote, Flag, Trash2 } from 'lucide-react'
import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { useWorkspace } from '@/store/workspace'
import { PROJECT_STATUS_LABELS, type ProjectStatus, type Task } from '@/types'
import { TaskRow } from '@/components/TaskRow'
import { TaskOverview } from '@/pages/TaskOverview'
import { CountBadge, EmptyState, PageContainer, SectionHeader } from '@/components/bits'
import { isOverdue, relativeLabel, timeAgo } from '@/lib/dates'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { isValidProjectSlug, projectSlugFromName } from '@/lib/project-slug'
import { ProjectColorField, ProjectDateField, ProjectIconField } from '@/components/ProjectFields'
import { DEFAULT_PROJECT_COLOR, editableProjectColor } from '@/lib/project-fields'
import { inferProjectIcon, projectIcon, type ProjectIconName } from '@/lib/project-icons'
import { WORKSPACE_PATHS, workspaceNotePath } from '@/lib/workspace-routes'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PROJECT_TABS = ['overview', 'tasks', 'notes', 'calendar'] as const

function ProjectCalendar({ tasks }: { tasks: Task[] }) {
  const today = startOfDay(new Date())
  const [weeks, setWeeks] = useState(4)

  const { overdue, byDay, unscheduled } = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const overdue = open.filter((t) => isOverdue(t.dueDate, false)).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    const horizon = addDays(today, weeks * 7)
    const byDay = new Map<string, Task[]>()
    open
      .filter((t) => t.dueDate && parseISO(t.dueDate) >= today && parseISO(t.dueDate) <= horizon)
      .forEach((t) => {
        const arr = byDay.get(t.dueDate!) ?? []
        arr.push(t)
        byDay.set(t.dueDate!, arr)
      })
    const unscheduled = open.filter((t) => !t.dueDate)
    return { overdue, byDay, unscheduled }
  }, [tasks, weeks, today])

  const days = useMemo(() => {
    const arr: { iso: string; label: string; tasks: Task[] }[] = []
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(today, i)
      const iso = format(d, 'yyyy-MM-dd')
      const ts = byDay.get(iso)
      if (ts) arr.push({ iso, label: relativeLabel(iso), tasks: ts })
    }
    return arr
  }, [byDay, weeks, today])

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <section>
          <SectionHeader title="Overdue" count={overdue.length} />
          <div className="border-y border-border/60 divide-y divide-border/60">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} showProject={false} />
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionHeader title={`Next ${weeks} weeks`} />
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-3">No tasks due in this window.</p>
        ) : (
          <div className="space-y-4">
            {days.map((d) => (
              <div key={d.iso} className="grid grid-cols-[88px_1fr] sm:grid-cols-[110px_1fr] gap-3">
                <div className="text-[12px] text-muted-foreground pt-2 text-right shrink-0">{d.label}</div>
                <div className="border-l-2 border-border pl-3 space-y-0.5 min-w-0">
                  {d.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} showProject={false} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {weeks < 12 && (
          <button onClick={() => setWeeks((w) => w + 4)} className="mt-3 min-h-11 px-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground lg:min-h-0">
            Show further out
          </button>
        )}
      </section>
      {unscheduled.length > 0 && (
        <section>
          <SectionHeader title="No date set" count={unscheduled.length} />
          <div className="border-y border-border/60 divide-y divide-border/60">
            {unscheduled.map((t) => (
              <TaskRow key={t.id} task={t} showProject={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const ws = useWorkspace()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const project = ws.getProject(projectId)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftStatus, setDraftStatus] = useState<Exclude<ProjectStatus, 'completed'>>('active')
  const [draftSlug, setDraftSlug] = useState('')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftTargetDate, setDraftTargetDate] = useState('')
  const [draftColor, setDraftColor] = useState<string>(DEFAULT_PROJECT_COLOR)
  const [draftIcon, setDraftIcon] = useState<ProjectIconName>('folder')
  const [draftIconEdited, setDraftIconEdited] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const tabParam = searchParams.get('tab')
  const tab = PROJECT_TABS.find((value) => value === tabParam) ?? 'overview'

  useEffect(() => {
    if (project) ws.pushRecent({ type: 'project', id: project.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  const tasks = useMemo(() => ws.tasks.filter((t) => t.projectId === projectId && !t.parentId), [ws.tasks, projectId])
  const notes = useMemo(
    () => ws.notes.filter((n) => n.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt),
    [ws.notes, projectId],
  )

  if (!project) {
    return (
      <PageContainer width="reading" className="py-10">
        <EmptyState
          icon={<FolderOpen className="h-7 w-7" />}
          title="Project not found"
          hint="It may have been removed."
          action={
            <Link to={WORKSPACE_PATHS.projects} className="text-[13px] underline underline-offset-4">Back to projects</Link>
          }
        />
      </PageContainer>
    )
  }

  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  const addTask = () => {
    const value = newTaskTitle.trim()
    if (!value) return
    void ws.addTask({ title: value, projectId: project.id, status: 'planned' }).then((created) => {
      if (created) setNewTaskTitle((current) => current.trim() === value ? '' : current)
    })
  }
  const openEdit = () => {
    setDraftName(project.name)
    setDraftDescription(project.description)
    setDraftStatus(project.status === 'completed' ? 'active' : project.status)
    setDraftSlug(project.source?.slug ?? projectSlugFromName(project.name))
    setDraftStartDate(project.startDate ?? '')
    setDraftTargetDate(project.targetDate ?? '')
    setDraftColor(editableProjectColor(project.source?.color))
    setDraftIcon(projectIcon(project.source?.icon ?? inferProjectIcon(project.name)).name)
    setDraftIconEdited(Boolean(project.source?.icon))
    setEditOpen(true)
  }
  const saveProject = async () => {
    if (!draftName.trim() || !isValidProjectSlug(draftSlug) || (draftStartDate && draftTargetDate && draftTargetDate < draftStartDate) || savingProject) return
    const patch = {
      ...(draftName.trim() !== project.name ? { name: draftName.trim() } : {}),
      ...(draftSlug !== (project.source?.slug ?? projectSlugFromName(project.name)) ? { slug: draftSlug } : {}),
      ...(draftDescription.trim() !== project.description ? { description: draftDescription.trim() } : {}),
      ...(draftStatus !== project.status ? { status: draftStatus } : {}),
      ...(draftStartDate !== (project.startDate ?? '') ? { startDate: draftStartDate || null } : {}),
      ...(draftTargetDate !== (project.targetDate ?? '') ? { targetDate: draftTargetDate || null } : {}),
      ...(draftColor !== editableProjectColor(project.source?.color) ? { color: draftColor } : {}),
      ...(draftIcon !== (project.source?.icon ?? inferProjectIcon(project.name)) ? { icon: draftIcon } : {}),
    }
    if (!Object.keys(patch).length) return setEditOpen(false)
    setSavingProject(true)
    const saved = await ws.updateProject(project.id, patch)
    setSavingProject(false)
    if (saved) setEditOpen(false)
  }
  const removeProject = async () => {
    if (deletingProject) return
    setDeletingProject(true)
    const deleted = await ws.deleteProject(project.id)
    setDeletingProject(false)
    if (!deleted) return
    setConfirmDelete(false)
    setEditOpen(false)
    navigate(WORKSPACE_PATHS.projects, { replace: true })
  }

  return (
    <PageContainer width="wide" className="py-6 sm:py-8">
      <button onClick={() => navigate(WORKSPACE_PATHS.projects)} className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] lg:min-h-0 text-muted-foreground hover:text-foreground transition-colors mb-3 -ml-1 px-1 py-0.5 rounded">
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </button>

      <header className="mb-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              {(() => { const Icon = projectIcon(project.source?.icon ?? inferProjectIcon(project.name)).icon; return <Icon className="h-5 w-5 shrink-0" style={{ color: project.source?.color ?? DEFAULT_PROJECT_COLOR }} aria-hidden /> })()}
              <h1 className="pg-page-title">{project.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{project.description}</p>
            {(project.startDate || project.targetDate) && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                {project.startDate ? `Starts ${relativeLabel(project.startDate)}` : 'No start date'}
                {' · '}
                {project.targetDate ? `Target ${relativeLabel(project.targetDate)}` : 'No target date'}
              </p>
            )}
          </div>
          {ws.canMutateTasks && <button onClick={openEdit} className="h-11 rounded-md border border-input px-3 lg:h-8 bg-card text-[13px] hover:bg-accent transition-colors">Edit project</button>}
        </div>
      </header>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base">Edit project</DialogTitle>
            <DialogDescription className="sr-only">Update this project's details, schedule, appearance, or status.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void saveProject() }} className="space-y-3">
            <div>
              <label htmlFor="ep-name" className="text-[12px] text-muted-foreground">Name</label>
              <input id="ep-name" value={draftName} onChange={(event) => { const nextName = event.target.value; setDraftName(nextName); if (!draftIconEdited) setDraftIcon(inferProjectIcon(nextName)) }} required className="mt-1 w-full rounded-md border border-input bg-transparent px-3 h-9 text-[14px] outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label htmlFor="ep-description" className="text-[12px] text-muted-foreground">Short description</label>
              <textarea id="ep-description" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <fieldset>
              <legend className="text-[12px] text-muted-foreground">Schedule</legend>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <ProjectDateField id="ep-start-date" label="Start date" value={draftStartDate} onChange={setDraftStartDate} />
                <ProjectDateField id="ep-target-date" label="Target date" value={draftTargetDate} min={draftStartDate || undefined} onChange={setDraftTargetDate} />
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectColorField id="ep-color" value={draftColor} onChange={setDraftColor} />
              <ProjectIconField id="ep-icon" value={draftIcon} color={draftColor} onChange={(value) => { setDraftIconEdited(true); setDraftIcon(value) }} />
            </div>
            <div>
              <label htmlFor="ep-status" className="text-[12px] text-muted-foreground">Status</label>
              <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as Exclude<ProjectStatus, 'completed'>)}>
                <SelectTrigger id="ep-status" className="mt-1 h-9 w-full text-[13px] border-input bg-card" aria-label="Project status"><SelectValue /></SelectTrigger>
                <SelectContent>{(['active', 'in_review', 'on_hold', 'archived'] as const).map((value) => <SelectItem key={value} value={value}>{PROJECT_STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <details className="rounded-md border border-border/60 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground">Advanced</summary>
              <div className="mt-3">
                <label htmlFor="ep-slug" className="text-[12px] text-muted-foreground">Project URL slug</label>
                <input id="ep-slug" value={draftSlug} onChange={(event) => setDraftSlug(event.target.value.toLowerCase())} pattern="[a-z0-9-]{2,50}" required className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-[14px] outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </details>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setConfirmDelete(true)} className="mr-auto inline-flex h-11 items-center lg:h-8 gap-1.5 rounded-md px-2 text-sm text-destructive transition-colors hover:bg-destructive/10" disabled={savingProject || deletingProject}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete project
              </button>
              <button type="button" onClick={() => setEditOpen(false)} className="h-11 rounded-md px-3 lg:h-8 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button type="submit" disabled={savingProject} aria-busy={savingProject} className="h-11 rounded-md px-3 lg:h-8 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">{savingProject ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{project.name}” will be permanently deleted. Its tasks and notes will remain without a project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>Keep project</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deletingProject} onClick={(event) => { event.preventDefault(); void removeProject() }}>
              {deletingProject ? 'Deleting…' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })} className="gap-0">
        <TabsList aria-label="Project sections" className="flex h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          {PROJECT_TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="-mb-px h-11 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 pb-2 pt-1 text-[13px] font-normal capitalize text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none lg:h-8 dark:data-[state=active]:bg-transparent"
            >
              {t}
              {t === 'tasks' && open.length > 0 && <CountBadge className="ml-1.5" count={open.length} label={`${open.length} open tasks`} />}
              {t === 'notes' && notes.length > 0 && <CountBadge className="ml-1.5" count={notes.length} label={`${notes.length} notes`} />}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6"><TaskOverview tasks={tasks} /></TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addTask()
            }}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 mb-4"
          >
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={`Add a task to ${project.name}`}
              aria-label="Add a task to this project"
              className="flex-1 bg-transparent h-10 text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </form>
          {tasks.length === 0 ? (
            <EmptyState icon={<Flag className="h-6 w-6" />} title="No tasks yet" hint="Add the first task above." />
          ) : (
            <>
              <div className="border-y border-border/60 divide-y divide-border/60">
                {open.map((t) => (
                  <TaskRow key={t.id} task={t} showProject={false} showStatus />
                ))}
              </div>
              {done.length > 0 && (
                <details className="mt-4 group">
                  <summary className="text-[12.5px] text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 select-none transition-colors">
                    {done.length} completed
                  </summary>
                  <div className="border-y border-border/60 divide-y divide-border/60 mt-2">
                    {done.map((t) => (
                      <TaskRow key={t.id} task={t} showProject={false} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          {ws.canMutateNotes && <div className="flex justify-end mb-3">
            <button
              onClick={() => { void ws.addNote({ title: 'Untitled note', projectId: project.id }).then((note) => note && navigate(workspaceNotePath(note.id))) }}
              className="inline-flex h-11 items-center gap-1.5 px-3 lg:h-8 rounded-md text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New note
            </button>
          </div>}
          {notes.length === 0 ? (
            <EmptyState icon={<StickyNote className="h-6 w-6" />} title="No notes yet" hint="Notes stay close to their project." />
          ) : (
            <div className="border-y border-border/60 divide-y divide-border/60">
              {notes.map((n) => (
                <button key={n.id} onClick={() => navigate(workspaceNotePath(n.id))} className="min-h-11 w-full px-2 py-2.5 text-left hover:bg-accent/60 rounded-md transition-colors">
                  <p className="pg-item-title truncate">{n.title}</p>
                  <p className="pg-meta mt-0.5 truncate">
                    {/* eslint-disable-next-line no-useless-escape */}
                    {n.content.replace(/[#>*`\-|\[\]]/g, '').trim().slice(0, 90) || 'Empty note'} · {timeAgo(n.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <ProjectCalendar tasks={tasks} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
