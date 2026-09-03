import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CalendarDays, CircleSlash, Link2, Plus, Trash2, X, CornerDownRight, History, StickyNote, User,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import { STATUS_LABELS, PRIORITY_LABELS, type Task, type Priority, type TaskStatus } from '@/types'
import { BlockingIndicator, TaskCheckbox, StatusBadge } from '@/components/bits'
import { relativeLabel, timeAgo } from '@/lib/dates'
import { useQuery } from '@tanstack/react-query'
import { getTaskHistory } from '@/lib/api/tasks'
import { useAppCommands } from '@/store/app-commands'
import { TaskComments } from '@/components/TaskComments'
import { EntityTypeBadge } from '@/components/EntityTypeBadge'
import { AttachmentSection } from '@/components/AttachmentSection'
import { createAutosaveDraftController } from '@/lib/autosave-draft-controller'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'
import {
  clearSubmittedCommentDraft,
  commentDraftBody,
  createTaskCommentDraftMap,
  updateCommentDraft,
  type TaskCommentDraftMap,
  type TaskCommentScope,
  type TaskCommentSubmission,
} from '@/lib/task-comment-draft'

interface TaskDrawerCtx {
  openTask: (id: string, origin?: HTMLElement | null, options?: { nonModal?: boolean }) => void
  closeTask: () => void
  openTaskId: string | null
}

const Ctx = createContext<TaskDrawerCtx>({ openTask: () => {}, closeTask: () => {}, openTaskId: null })
// eslint-disable-next-line react-refresh/only-export-components
export const useTaskDrawer = () => useContext(Ctx)

export function TaskDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [drawerNonModal, setDrawerNonModal] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<TaskCommentDraftMap>(createTaskCommentDraftMap)
  const originRef = useRef<HTMLElement | null>(null)
  const flushDraftsRef = useRef<(() => Promise<boolean>) | null>(null)
  const transitionGeneration = useRef(0)
  const { getTask } = useWorkspace()
  const commands = useAppCommands()

  const transitionTask = useCallback((apply: () => void) => {
    const generation = ++transitionGeneration.current
    const flush = flushDraftsRef.current
    if (!flush) {
      apply()
      return
    }
    void flush().then((saved) => {
      if (!saved || transitionGeneration.current !== generation) return
      flushDraftsRef.current = null
      apply()
    })
  }, [])
  const openTask = useCallback((id: string, origin?: HTMLElement | null, options?: { nonModal?: boolean }) => {
    transitionTask(() => {
      originRef.current = origin ?? (document.activeElement as HTMLElement | null)
      setDrawerNonModal(options?.nonModal ?? false)
      setOpenTaskId(id)
    })
  }, [transitionTask])
  const closeTask = useCallback(() => {
    transitionTask(() => {
      setOpenTaskId(null)
      setDrawerNonModal(false)
      window.setTimeout(() => originRef.current?.focus?.(), 60)
    })
  }, [transitionTask])
  const navigateTask = useCallback((id: string) => {
    transitionTask(() => setOpenTaskId(id))
  }, [transitionTask])
  const registerDraftFlush = useCallback((flush: (() => Promise<boolean>) | null) => {
    flushDraftsRef.current = flush
  }, [])
  const changeCommentDraft = useCallback((scope: TaskCommentScope, body: string) => {
    setCommentDrafts((current) => updateCommentDraft(current, scope, body))
  }, [])
  const clearSubmittedDraft = useCallback((submission: TaskCommentSubmission) => {
    setCommentDrafts((current) => clearSubmittedCommentDraft(current, submission))
  }, [])

  useEffect(() => {
    return commands.subscribe('open-task', ({ taskId }) => openTask(taskId))
  }, [commands, openTask])

  useEffect(() => {
    return commands.subscribe('task-deleted', ({ taskId }) => {
      if (taskId !== openTaskId) return
      transitionGeneration.current += 1
      flushDraftsRef.current = null
      setOpenTaskId(null)
      setDrawerNonModal(false)
      window.setTimeout(() => originRef.current?.focus?.(), 60)
    })
  }, [commands, openTaskId])

  useEffect(() => {
    if (!openTaskId || drawerNonModal) return
    const options = { capture: true, passive: false } as const
    const preventBackgroundScroll = (event: Event) => {
      const target = event.target
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
      if (!element?.closest('[data-slot="sheet-content"]')) event.preventDefault()
    }
    document.addEventListener('wheel', preventBackgroundScroll, options)
    document.addEventListener('touchmove', preventBackgroundScroll, options)
    return () => {
      document.removeEventListener('wheel', preventBackgroundScroll, options)
      document.removeEventListener('touchmove', preventBackgroundScroll, options)
    }
  }, [drawerNonModal, openTaskId])

  const task = getTask(openTaskId)

  return (
    <Ctx.Provider value={{ openTask, closeTask, openTaskId }}>
      {children}
      <Sheet
        modal={!drawerNonModal}
        open={!!openTaskId}
        onOpenChange={(open) => {
          if (!open) closeTask()
        }}
      >
        <SheetContent
          side="right"
          className="w-full min-w-0 overflow-x-hidden sm:max-w-[440px] p-0 flex flex-col gap-0 [&>[data-slot=sheet-close]]:size-11 lg:[&>[data-slot=sheet-close]]:size-auto data-[state=closed]:!duration-150 data-[state=open]:!duration-200"
          aria-label="Task details"
          onInteractOutside={(event) => {
            if (drawerNonModal && event.target instanceof Element && event.target.closest('[data-calendar-agenda]')) {
              event.preventDefault()
            }
          }}
        >
          {task ? (
            <TaskDrawerBody
              key={task.id}
              task={task}
              commentDrafts={commentDrafts}
              onCommentDraftChange={changeCommentDraft}
              onCommentDraftSubmitted={clearSubmittedDraft}
              onNavigateTask={navigateTask}
              onDraftFlushChange={registerDraftFlush}
            />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">This task no longer exists.</div>
          )}
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2 min-h-8">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function useAutosaveDraft({
  serverValue,
  canEdit,
  save,
  valid = () => true,
  normalize = (value) => value,
  invalidMessage,
}: {
  serverValue: string
  canEdit: boolean
  save: (value: string) => Promise<boolean>
  valid?: (value: string) => boolean
  normalize?: (value: string) => string
  invalidMessage?: string
}) {
  const saveRef = useRef(save)
  const validRef = useRef(valid)
  const normalizeRef = useRef(normalize)
  saveRef.current = save
  validRef.current = valid
  normalizeRef.current = normalize
  const [controller] = useState(() => createAutosaveDraftController({
    initialValue: serverValue,
    canEdit,
    save: (value) => saveRef.current(value),
    valid: (value) => validRef.current(value),
    normalize: (value) => normalizeRef.current(value),
    invalidMessage,
  }))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)

  useEffect(() => controller.setCanEdit(canEdit), [canEdit, controller])
  useEffect(() => controller.syncServerValue(serverValue), [controller, serverValue])
  useEffect(() => () => { void controller.flush() }, [controller])

  return {
    ...snapshot,
    flush: controller.flush,
    reset: controller.reset,
    setValue: controller.edit,
  }
}

function TaskDrawerBody({
  task,
  commentDrafts,
  onCommentDraftChange,
  onCommentDraftSubmitted,
  onNavigateTask,
  onDraftFlushChange,
}: {
  task: Task
  commentDrafts: TaskCommentDraftMap
  onCommentDraftChange: (scope: TaskCommentScope, body: string) => void
  onCommentDraftSubmitted: (submission: TaskCommentSubmission) => void
  onNavigateTask: (id: string) => void
  onDraftFlushChange: (flush: (() => Promise<boolean>) | null) => void
}) {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const { closeTask } = useTaskDrawer()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newSub, setNewSub] = useState('')
  const newSubRef = useRef<HTMLInputElement>(null)
  const [addingDep, setAddingDep] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const historyQuery = useQuery({
    queryKey: ['work-item-history', ws.workspaceId, task.id],
    queryFn: ({ signal }) => getTaskHistory(ws.workspaceId!, task.id, signal),
    enabled: showHistory && Boolean(ws.supportsTaskHistory && ws.workspaceId && task.source),
    staleTime: 30_000,
  })

  const done = task.status === 'done'
  const project = ws.getProject(task.projectId)
  const subtasks = ws.subtasksOf(task.id)
  const blockers = ws.blockersOf(task)
  const parent = ws.getTask(task.parentId)
  const depCandidates = ws.tasks.filter(
    (t) => t.id !== task.id && !t.parentId && t.status !== 'done' && !task.dependsOn.includes(t.id),
  )
  const related = task.related.map((id) => ws.getTask(id)).filter((t): t is Task => !!t)
  const blocked = ws.isBlocked(task)
  const blocking = !done && ws.tasks.some((candidate) => candidate.status !== 'done' && candidate.dependsOn.includes(task.id))
  const blockedTasks = ws.tasks.filter((candidate) => candidate.status !== 'done' && candidate.dependsOn.includes(task.id))
  const canEdit = ws.canMutateTasks
  const commentScope = ws.workspaceId ? { workspaceId: ws.workspaceId, taskId: task.id } : null
  const titleDraft = useAutosaveDraft({
    serverValue: task.title,
    canEdit,
    save: (value) => ws.updateTask(task.id, { title: value }, { silent: true }),
    valid: (value) => Boolean(value.trim()),
    normalize: (value) => value.trim(),
    invalidMessage: 'Task title cannot be empty.',
  })
  const descriptionDraft = useAutosaveDraft({
    serverValue: task.description,
    canEdit,
    save: (value) => ws.updateTask(task.id, { description: value }, { silent: true }),
  })
  const flushTitleDraft = titleDraft.flush
  const flushDescriptionDraft = descriptionDraft.flush
  const flushDrafts = useCallback(async () => {
    const results = await Promise.all([flushTitleDraft(), flushDescriptionDraft()])
    return results.every(Boolean)
  }, [flushDescriptionDraft, flushTitleDraft])
  useEffect(() => {
    onDraftFlushChange(flushDrafts)
    return () => onDraftFlushChange(null)
  }, [flushDrafts, onDraftFlushChange])

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-3 pr-12 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-11 items-center lg:h-auto lg:pt-1 lg:[&>button]:size-[18px] [&>button]:size-11">
            <TaskCheckbox checked={done} onToggle={() => ws.toggleTask(task.id)} blocked={blocked && !done} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="sr-only">Task details</SheetTitle>
            <SheetDescription className="sr-only">{canEdit ? 'View and edit this task' : 'View this task'}</SheetDescription>
            <input
              value={titleDraft.value}
              readOnly={!canEdit}
              onChange={(e) => titleDraft.setValue(e.target.value)}
              onBlur={() => { void titleDraft.flush() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') titleDraft.reset()
              }}
              aria-label="Task title"
              aria-invalid={titleDraft.error ? true : undefined}
              aria-describedby={titleDraft.error ? 'task-title-save-error' : undefined}
              className={cn(
                'w-full bg-transparent text-[17px] font-semibold leading-snug outline-none rounded px-1 -ml-1 focus:bg-accent/50 transition-colors',
                done && 'line-through text-muted-foreground',
              )}
            />
            <span className="sr-only" aria-live="polite">{titleDraft.saving || descriptionDraft.saving ? 'Saving task changes' : ''}</span>
            {titleDraft.error && <p id="task-title-save-error" className="mt-1 text-xs text-destructive" role="status">{titleDraft.error}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <EntityTypeBadge type="task" />
              <StatusBadge status={task.status} />
              {blocked && !done && (
                <span className="inline-flex items-center gap-1 text-[12.5px] text-red-600 dark:text-red-400">
                  <CircleSlash className="h-3 w-3" /> Blocked
                </span>
              )}
              {blocking && <BlockingIndicator />}
              {parent && (
                <button
                  onClick={() => onNavigateTask(parent.id)}
                  className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CornerDownRight className="h-3 w-3" /> {parent.title}
                </button>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>
      <Separator />
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-thin">
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <label htmlFor={`task-description-${task.id}`} className="text-xs font-medium text-foreground">Description</label>
              <p className="mt-0.5 text-[12px] text-muted-foreground">The context needed to complete this task.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs text-muted-foreground"
              onClick={() => {
                closeTask()
                navigate(WORKSPACE_PATHS.notes)
              }}
            >
              <StickyNote className="size-3.5" aria-hidden="true" /> Open Notes
            </Button>
          </div>
          <textarea
            id={`task-description-${task.id}`}
            value={descriptionDraft.value}
            readOnly={!canEdit}
            onChange={(e) => descriptionDraft.setValue(e.target.value)}
            onBlur={() => { void descriptionDraft.flush() }}
            aria-label="Task description"
            aria-invalid={descriptionDraft.error ? true : undefined}
            aria-describedby={descriptionDraft.error ? 'task-description-save-error' : undefined}
            placeholder="Add instructions, context, or the expected outcome…"
            rows={4}
            className="mt-1 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
          />
          {descriptionDraft.error && <p id="task-description-save-error" className="mt-1 text-xs text-destructive" role="status">{descriptionDraft.error}</p>}
        </div>
        <Separator />
        <div className="px-5 py-4 space-y-1.5">
          <Field label="Project">
            <Select
              value={task.projectId ?? 'none'}
              disabled={!canEdit || ws.taskMutationPending}
              onValueChange={(v) => ws.updateTask(task.id, { projectId: v === 'none' ? null : v })}
            >
              <SelectTrigger aria-label="Project" className="h-11 data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8 text-sm border-0 bg-transparent hover:bg-accent/60 px-2 -ml-2 w-auto max-w-full shadow-none focus:ring-1">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {ws.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select disabled={!canEdit || ws.taskMutationPending} value={task.status} onValueChange={(v) => void ws.updateTask(task.id, { status: v as TaskStatus })}>
              <SelectTrigger aria-label="Status" className="h-11 data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8 text-sm border-0 bg-transparent hover:bg-accent/60 px-2 -ml-2 w-auto shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).filter((s) => ws.supportsBlockedStatus || s !== 'blocked').map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select disabled={!canEdit || ws.taskMutationPending} value={task.priority} onValueChange={(v) => void ws.updateTask(task.id, { priority: v as Priority })}>
              <SelectTrigger aria-label="Priority" className="h-11 data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8 text-sm border-0 bg-transparent hover:bg-accent/60 px-2 -ml-2 w-auto shadow-none focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).filter((p) => ws.supportsNoPriority || p !== 'none').map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date">
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button aria-label="Due date" disabled={!canEdit || ws.taskMutationPending} className="h-11 lg:h-8 px-2 -ml-2 rounded-md text-sm hover:bg-accent/60 transition-colors inline-flex items-center gap-1.5 text-left disabled:cursor-default">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {task.dueDate ? relativeLabel(task.dueDate) : <span className="text-muted-foreground">Set a date</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={task.dueDate ? parseISO(task.dueDate) : undefined}
                    onSelect={(d) => void ws.updateTask(task.id, { dueDate: d ? format(d, 'yyyy-MM-dd') : null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {task.dueDate && canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => void ws.updateTask(task.id, { dueDate: null })}
                      aria-label="Clear due date"
                      className="size-11 lg:size-6 rounded hover:bg-accent inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Clear date</TooltipContent>
                </Tooltip>
              )}
            </div>
          </Field>
          <Field label="Assignee">
            <Select
              value={task.assigneeId ?? 'unassigned'}
              disabled={!canEdit || ws.taskMutationPending}
              onValueChange={(value) => void ws.updateTask(task.id, { assigneeId: value === 'unassigned' ? null : value })}
            >
              <SelectTrigger aria-label="Assignee" className="h-11 w-auto max-w-full border-0 bg-transparent px-2 -ml-2 text-sm shadow-none hover:bg-accent/60 focus:ring-1 data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {ws.state.people.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Custom labels">
            <div className="flex flex-wrap gap-1 py-1">
              {ws.state.labels.map((l) => {
                const active = task.labelIds.includes(l.id)
                const color = l.color.includes('(') || l.color.startsWith('#') || l.color === 'currentColor' ? l.color : `hsl(${l.color})`
                return (
                  <button
                    key={l.id}
                    aria-pressed={active}
                    disabled={!canEdit || ws.taskMutationPending}
                    onClick={() =>
                      void ws.updateTask(
                        task.id,
                        { labelIds: active ? task.labelIds.filter((x) => x !== l.id) : [...task.labelIds, l.id] },
                        { silent: true },
                      )
                    }
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[12.5px] font-medium transition-[opacity,background-color,border-color,box-shadow,transform]',
                      active ? 'opacity-100' : 'opacity-40 hover:opacity-80',
                    )}
                    style={{ borderColor: color, color, backgroundColor: active ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent' }}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <Separator />
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Subtasks{subtasks.length > 0 && ` · ${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length}`}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => newSubRef.current?.focus()}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add subtask
              </button>
            )}
          </div>
          <ul className="space-y-0.5">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 group rounded-md px-1 -mx-1 py-1 hover:bg-accent/50">
                <span className="flex h-11 items-center [&>button]:size-11 lg:h-auto lg:[&>button]:size-4"><TaskCheckbox size="sm" checked={s.status === 'done'} onToggle={() => ws.toggleTask(s.id)} /></span>
                <button
                  onClick={() => onNavigateTask(s.id)}
                  className={cn('flex-1 text-left text-sm truncate', s.status === 'done' && 'line-through text-muted-foreground')}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
          {canEdit && <form
            onSubmit={(e) => {
              e.preventDefault()
              const v = newSub.trim()
              if (!v) return
              void ws.addTask({ title: v, projectId: task.projectId, parentId: task.id, status: 'planned', priority: task.priority }).then((created) => {
                if (created) setNewSub((current) => current.trim() === v ? '' : current)
              })
            }}
            className="mt-1.5 flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={newSubRef}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Subtask title"
              aria-label="Add a subtask"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 lg:h-7"
            />
          </form>}
        </div>

        {(blockers.length > 0 || canEdit) && (
          <>
            <Separator />
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Blocked by</span>
                {canEdit && depCandidates.length > 0 && !addingDep && (
                  <button
                    type="button"
                    onClick={() => setAddingDep(true)}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add blocker
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-1">
                {blockers.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-md px-1 -mx-1 py-1 hover:bg-accent/50 group">
                    <CircleSlash className={cn('h-3.5 w-3.5 shrink-0', b.status === 'done' ? 'text-emerald-500' : 'text-red-500/80')} />
                    <button onClick={() => onNavigateTask(b.id)} className="flex-1 text-left text-sm truncate hover:underline underline-offset-2">
                      {b.title}
                    </button>
                    <span className="text-[12.5px] text-muted-foreground">{STATUS_LABELS[b.status]}</span>
                    {canEdit && <button
                      aria-label={`Remove dependency on ${b.title}`}
                      onClick={() => ws.updateTask(task.id, { dependsOn: task.dependsOn.filter((d) => d !== b.id) }, { silent: true })}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>}
                  </li>
                ))}
              </ul>
              {blockers.length === 0 && !addingDep && (
                <p className="text-sm text-muted-foreground">No blockers.</p>
              )}
              {addingDep && (
                <div className="mt-2 rounded-md border border-border bg-background shadow-[0_1px_2px_hsl(240_8%_10%/0.04)]">
                  <div className="flex h-8 items-center justify-between border-b border-border px-2.5">
                    <span className="text-xs font-medium text-muted-foreground">Choose a blocker</span>
                    <button
                      type="button"
                      onClick={() => setAddingDep(false)}
                      aria-label="Cancel adding blocker"
                      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto p-1 scrollbar-thin">
                    {depCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          ws.updateTask(task.id, { dependsOn: [...task.dependsOn, candidate.id] }, { silent: true })
                          setAddingDep(false)
                        }}
                        className="flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                        <span className="shrink-0 text-[12.5px] text-muted-foreground">{STATUS_LABELS[candidate.status]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {blockedTasks.length > 0 && (
          <>
            <Separator />
            <div className="px-5 py-4">
              <span className="text-xs text-muted-foreground">Blocking</span>
              <ul className="mt-2 space-y-1">
                {blockedTasks.map((blockedTask) => (
                  <li key={blockedTask.id} className="flex items-center gap-2 rounded-md px-1 -mx-1 py-1 hover:bg-accent/50">
                    <CircleSlash className="h-3.5 w-3.5 shrink-0 rotate-45 text-orange-500/80" />
                    <button onClick={() => onNavigateTask(blockedTask.id)} className="flex-1 text-left text-sm truncate hover:underline underline-offset-2">
                      {blockedTask.title}
                    </button>
                    <span className="text-[12.5px] text-muted-foreground">{STATUS_LABELS[blockedTask.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {related.length > 0 && (
          <>
            <Separator />
            <div className="px-5 py-4">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> Related tasks</span>
              <ul className="mt-2 space-y-1">
                {related.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onNavigateTask(r.id)} className="text-sm hover:underline underline-offset-2 truncate">
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {ws.mode.kind === 'server' && ws.workspaceId && task.source && <>
          <Separator />
          <AttachmentSection
            workspaceId={ws.workspaceId}
            target={{ workItemId: task.id }}
            projectId={task.projectId}
            canUpload={canEdit}
            className="px-5 py-4"
          />
        </>}

        {ws.mode.kind === 'server' && commentScope && task.source && <>
          <Separator />
          <TaskComments
            workspaceId={commentScope.workspaceId}
            taskId={commentScope.taskId}
            members={ws.state.people}
            canComment={canEdit}
            draftBody={commentDraftBody(commentDrafts, commentScope)}
            onDraftChange={(body) => onCommentDraftChange(commentScope, body)}
            onDraftSubmitted={onCommentDraftSubmitted}
          />
        </>}

        <Separator />
        <div className="px-5 py-4">
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <History className="h-3.5 w-3.5" /> History
            <span className={cn('inline-block transition-transform text-[12.5px]', showHistory ? 'rotate-180' : '')}>▾</span>
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 border-l border-border pl-3 ml-0.5">
              {ws.supportsTaskHistory ? (
                historyQuery.isLoading ? <li className="text-xs text-muted-foreground">Loading history…</li> :
                historyQuery.isError ? <li className="text-xs text-destructive">History could not be loaded.</li> :
                historyQuery.data?.length ? historyQuery.data.map((event) => (
                  <li key={event.id} className="text-xs text-muted-foreground">
                    <span className="text-foreground/80">{event.summary}</span> · {timeAgo(new Date(event.createdAt).getTime())}
                  </li>
                )) : <li className="text-xs text-muted-foreground">No recorded changes yet.</li>
              ) : [...task.history].reverse().map((h, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="text-foreground/80">{h.text}</span> · {timeAgo(h.at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canEdit && <>
      <Separator />
      <div className="min-w-0 px-5 py-3 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">
          {project ? `In ${project.name}` : 'Not in a project'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 text-destructive hover:text-destructive hover:bg-destructive/10 lg:h-8"
          onClick={() => setConfirmDelete(true)}
          disabled={ws.taskMutationPending}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete task
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title}” will be removed{ws.deletionIsRecoverable && ' and can be undone right after from the toast'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep task</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await ws.deleteTask(task.id)
              }}
              disabled={ws.taskMutationPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>}
    </>
  )
}
