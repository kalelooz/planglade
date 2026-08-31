import { useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { EntityTypeBadge } from '@/components/EntityTypeBadge'
import { TaskCheckbox, PriorityBadge, DueBadge, ProjectChip, BlockedIndicator, BlockingIndicator, StatusBadge } from '@/components/bits'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { daysFromToday } from '@/lib/dates'
import { CheckCheck, CalendarDays, Flag, FolderInput, Trash2 } from 'lucide-react'
import { workspaceProjectPath } from '@/lib/workspace-routes'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function TaskRow({
  task,
  showProject = true,
  showStatus = false,
  listMobileLayout = false,
  compact = false,
  mutedPriority = false,
  visibleFields,
  className,
}: {
  task: Task
  showProject?: boolean
  showStatus?: boolean
  listMobileLayout?: boolean
  compact?: boolean
  mutedPriority?: boolean
  visibleFields?: Set<string>
  className?: string
}) {
  const ws = useWorkspace()
  const { openTask, openTaskId } = useTaskDrawer()
  const navigate = useNavigate()
  const done = task.status === 'done'
  const project = ws.getProject(task.projectId)
  const subs = ws.subtasksOf(task.id)
  const subsDone = subs.filter((s) => s.status === 'done').length
  const blocked = ws.isBlocked(task)
  const blocking = !done && ws.tasks.some((candidate) => candidate.status !== 'done' && candidate.dependsOn.includes(task.id))
  const selected = openTaskId === task.id
  const priorityOptions: Task['priority'][] = ws.supportsNoPriority ? ['high', 'medium', 'low', 'none'] : ['high', 'medium', 'low']
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const taskButtonRef = useRef<HTMLButtonElement>(null)
  const field = (name: string) => !visibleFields || visibleFields.has(name)
  const hasMobileStatus = listMobileLayout && showStatus && field('status') && !done && task.status !== 'blocked'
  const hasMobileDue = field('dueDate') && !!task.dueDate
  const hasMobilePriority = field('priority') && task.priority !== 'none'
  const listDesktopColumns = [
    '18px',
    'minmax(280px, min(20rem, 45vw))',
    field('status') ? '96px' : null,
    field('dueDate') ? '104px' : null,
    field('priority') ? '28px' : null,
  ].filter(Boolean).join(' ')

  const removeTask = async () => {
    if (deleting || ws.taskMutationPending) return
    setDeleting(true)
    const deleted = await ws.deleteTask(task.id)
    setDeleting(false)
    if (deleted) setConfirmDelete(false)
  }

  return (<>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-task-id={task.id}
          style={listMobileLayout ? { '--task-list-columns': listDesktopColumns } as CSSProperties : undefined}
          className={cn(
            'group relative grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-2 rounded-md px-1.5 lg:gap-x-3 lg:px-2.5',
            listMobileLayout
              ? 'lg:justify-center lg:gap-x-5 lg:[grid-template-columns:var(--task-list-columns)]'
              : 'lg:grid-cols-[18px_minmax(0,1fr)_104px_28px]',
            compact ? 'py-2.5 lg:py-1' : 'py-2.5 lg:py-2',
            className,
          )}
        >
          <button
            ref={taskButtonRef}
            type="button"
            onClick={(event) => openTask(task.id, event.currentTarget)}
            aria-label={`Task: ${task.title}${done ? ' (done)' : ''}${blocked && !done ? ' (blocked)' : ''}`}
            className={cn(
              'absolute inset-0 rounded-md cursor-pointer transition-colors duration-150 active:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected ? 'bg-accent/80' : 'hover:bg-accent/60 focus-visible:bg-accent/60',
            )}
          />
          <span data-task-field={listMobileLayout ? 'completion' : undefined} className="relative z-10 flex h-11 items-center justify-center [&>button]:size-11 lg:h-auto lg:justify-start lg:pt-0.5 lg:[&>button]:size-[18px]"><TaskCheckbox checked={done} onToggle={() => ws.toggleTask(task.id)} blocked={blocked && !done} /></span>
          <div className="relative z-10 min-w-0 pointer-events-none" data-task-field={listMobileLayout ? 'identity' : undefined}>
            <div className="flex items-start gap-2">
              <p className={cn('pg-item-title min-w-0 flex-1', done && 'line-through text-muted-foreground font-normal')}>
                <span data-task-field={listMobileLayout ? 'title' : undefined}>{task.title}</span>
              </p>
              <EntityTypeBadge type="task" className="mt-0.5" />
              {showStatus && field('status') && !listMobileLayout && !done && task.status !== 'blocked' && <StatusBadge status={task.status} className="mt-0.5 shrink-0" />}
            </div>
            {(subs.length > 0 || showProject || (blocked && !done) || blocking || hasMobileStatus || hasMobileDue || hasMobilePriority) && (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-4 text-muted-foreground">
                {subs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground/75" aria-label={`${subsDone} of ${subs.length} subtasks done`}>
                    <span className="h-1 w-7 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${subsDone} of ${subs.length} subtasks done`} aria-valuemin={0} aria-valuemax={subs.length} aria-valuenow={subsDone}>
                      <span className="block h-full rounded-full bg-foreground/55" style={{ width: `${(subsDone / subs.length) * 100}%` }} />
                    </span>
                    {subsDone}/{subs.length} subtasks
                  </span>
                )}
                {showProject && field('project') && <ProjectChip project={project} className="pointer-events-auto inline-flex min-h-11 min-w-11 max-w-[120px] shrink items-center sm:max-w-[150px] lg:min-h-0 lg:min-w-0" onClick={() => project && navigate(workspaceProjectPath(project.id))} />}
                {blocked && !done && <BlockedIndicator className="shrink-0" />}
                {blocking && <BlockingIndicator className="shrink-0" />}
                {hasMobileStatus && <StatusBadge status={task.status} className="shrink-0 lg:hidden" />}
                {hasMobileDue && <DueBadge date={task.dueDate} done={done} className="max-w-full shrink-0 text-[12.5px] lg:hidden" />}
                {hasMobilePriority && <PriorityBadge priority={task.priority} className={cn('inline-flex min-w-4 shrink-0 items-center justify-center lg:hidden', mutedPriority && 'text-muted-foreground')} />}
              </div>
            )}
          </div>
          {listMobileLayout && field('status') && (
            <div className="pointer-events-none relative z-10 hidden items-center lg:flex lg:pt-0.5" data-task-field="status">
              {showStatus && !done && task.status !== 'blocked' && <StatusBadge status={task.status} />}
            </div>
          )}
          {field('dueDate') && (
            <div className="pointer-events-none relative z-10 hidden items-center overflow-hidden lg:col-auto lg:flex lg:pt-0.5" data-task-field={listMobileLayout ? 'due-date' : undefined}>
              <DueBadge date={task.dueDate} done={done} className="w-full justify-start" />
            </div>
          )}
          {field('priority') && (
            <div className="pointer-events-none relative z-10 hidden items-center justify-start lg:col-auto lg:flex lg:pt-0.5" data-task-field={listMobileLayout ? 'priority' : undefined}>
              <PriorityBadge priority={task.priority} className={mutedPriority ? 'text-muted-foreground' : undefined} />
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      {ws.canMutateTasks && <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => ws.toggleTask(task.id)}>
          <CheckCheck className="mr-2 h-4 w-4" /> {done ? 'Reopen task' : 'Mark done'}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CalendarDays className="mr-2 h-4 w-4" /> Set due date
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => ws.updateTask(task.id, { dueDate: daysFromToday(0) })}>Today</ContextMenuItem>
            <ContextMenuItem onClick={() => ws.updateTask(task.id, { dueDate: daysFromToday(1) })}>Tomorrow</ContextMenuItem>
            <ContextMenuItem onClick={() => ws.updateTask(task.id, { dueDate: daysFromToday(7) })}>Next week</ContextMenuItem>
            <ContextMenuItem onClick={() => ws.updateTask(task.id, { dueDate: null })}>No date</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" /> Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {priorityOptions.map((p) => (
              <ContextMenuItem key={p} onClick={() => ws.updateTask(task.id, { priority: p })} className="capitalize">
                {p}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderInput className="mr-2 h-4 w-4" /> Move to project
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => ws.updateTask(task.id, { projectId: null })}>No project</ContextMenuItem>
            {ws.projects.map((p) => (
              <ContextMenuItem key={p.id} onClick={() => ws.updateTask(task.id, { projectId: p.id })}>
                {p.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {ws.canMutateTasks && <>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)} disabled={deleting || ws.taskMutationPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete task
          </ContextMenuItem>
        </>}
      </ContextMenuContent>}
    </ContextMenu>
    <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!deleting) setConfirmDelete(open) }}>
      <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); taskButtonRef.current?.focus() }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
          <AlertDialogDescription>This task will be permanently removed. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep task</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting || ws.taskMutationPending}
            aria-busy={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => { event.preventDefault(); void removeTask() }}
          >
            {deleting ? 'Deleting…' : 'Delete task'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>)
}
