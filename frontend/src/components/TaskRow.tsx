import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { TaskCheckbox, PriorityBadge, DueBadge, ProjectChip, BlockedIndicator, BlockingIndicator, StatusBadge } from '@/components/bits'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { daysFromToday } from '@/lib/dates'
import { CheckCheck, CalendarDays, Flag, FolderInput, Trash2 } from 'lucide-react'

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
  const priorityOptions: Task['priority'][] = ws.readOnly ? ['high', 'medium', 'low'] : ['high', 'medium', 'low', 'none']
  const field = (name: string) => !visibleFields || visibleFields.has(name)
  const hasMobileStatus = showStatus && field('status') && !done && task.status !== 'blocked'
  const hasMobileDue = field('dueDate') && !!task.dueDate
  const hasMobilePriority = field('priority') && task.priority !== 'none'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-task-id={task.id}
          className={cn(
            'group relative grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3 rounded-md px-2.5 lg:grid-cols-[18px_minmax(0,1fr)_104px_28px]',
            compact ? 'py-2.5 lg:py-1' : 'py-2.5 lg:py-2',
            className,
          )}
        >
          <button
            type="button"
            onClick={(event) => openTask(task.id, event.currentTarget)}
            aria-label={`Task: ${task.title}${done ? ' (done)' : ''}${blocked && !done ? ' (blocked)' : ''}`}
            className={cn(
              'absolute inset-0 rounded-md cursor-pointer transition-colors duration-150 active:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected ? 'bg-accent/80' : 'hover:bg-accent/60 focus-visible:bg-accent/60',
            )}
          />
          <span className="relative z-10 flex h-6 items-start justify-center pt-0.5 [&>button]:size-6 lg:h-auto lg:justify-start lg:pt-0.5 lg:[&>button]:size-[18px]"><TaskCheckbox checked={done} onToggle={() => ws.toggleTask(task.id)} blocked={blocked && !done} /></span>
          <div className="relative z-10 min-w-0 pointer-events-none">
            <div className="flex items-start gap-2">
              <p className={cn('pg-item-title min-w-0 flex-1', done && 'line-through text-muted-foreground font-normal')}>
                {task.title}
              </p>
              {showStatus && field('status') && !done && task.status !== 'blocked' && <StatusBadge status={task.status} className={cn('mt-0.5 shrink-0', listMobileLayout && 'hidden lg:inline-flex')} />}
            </div>
            {(subs.length > 0 || showProject || (blocked && !done) || blocking || hasMobileStatus || hasMobileDue || hasMobilePriority) && (
              <div className={cn('mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] leading-4 text-muted-foreground lg:flex-wrap', done && 'opacity-75')}>
                {subs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground/75" aria-label={`${subsDone} of ${subs.length} subtasks done`}>
                    <span className="h-1 w-7 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={subs.length} aria-valuenow={subsDone}>
                      <span className="block h-full rounded-full bg-foreground/55" style={{ width: `${(subsDone / subs.length) * 100}%` }} />
                    </span>
                    {subsDone}/{subs.length} subtasks
                  </span>
                )}
                {showProject && field('project') && <ProjectChip project={project} className="pointer-events-auto inline-flex max-w-[120px] shrink items-center sm:max-w-[150px]" onClick={() => project && navigate(`/projects/${project.id}`)} />}
                {blocked && !done && <BlockedIndicator className="shrink-0" />}
                {blocking && <BlockingIndicator className="shrink-0" />}
                {hasMobileStatus && <StatusBadge status={task.status} className="shrink-0" />}
                {hasMobileDue && <DueBadge date={task.dueDate} done={done} className="max-w-full shrink-0 text-[11.5px]" />}
                {hasMobilePriority && <PriorityBadge priority={task.priority} className={cn('inline-flex min-w-4 shrink-0 items-center justify-center', mutedPriority && 'text-muted-foreground')} />}
              </div>
            )}
          </div>
          <div className={cn('relative z-10 hidden items-center overflow-hidden lg:col-auto lg:flex lg:pt-0.5', done && 'opacity-70')}>
            {field('dueDate') && <DueBadge date={task.dueDate} done={done} className="justify-start w-full" />}
          </div>
          <div className={cn('relative z-10 hidden items-center justify-start lg:col-auto lg:flex lg:pt-0.5', done && 'opacity-70')}>
            {field('priority') && <PriorityBadge priority={task.priority} className={mutedPriority ? 'text-muted-foreground' : undefined} />}
          </div>
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
          <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => void ws.deleteTask(task.id)} disabled={ws.taskMutationPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete task
          </ContextMenuItem>
        </>}
      </ContextMenuContent>}
    </ContextMenu>
  )
}
