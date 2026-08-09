import { useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, useDraggable, type DragStartEvent, type DragMoveEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'
import { TASK_STATUS_ORDER, STATUS_LABELS } from '@/types'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { PriorityBadge, DueBadge, BlockedIndicator, CountBadge } from '@/components/bits'
import { getBoardDropPatch, placeBoardTask } from '@/lib/board-order'

type DragTarget = { status: TaskStatus; index: number }
type PickupSnapshot = {
  columns: Map<TaskStatus, DOMRect>
  cards: Map<string, DOMRect>
  board: DOMRect
  gap: number
  scrollLeft: number
  pointer: { x: number; y: number }
  keyboard: boolean
}

function BoardCard({ task, overlay, collapsed, density = 'comfortable', visibleFields }: { task: Task; overlay?: boolean; collapsed?: boolean; density?: 'comfortable' | 'compact'; visibleFields?: Set<string> }) {
  const ws = useWorkspace()
  const { openTask, openTaskId } = useTaskDrawer()
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  const { setNodeRef: setDropRef } = useDroppable({ id: `card-${task.id}`, disabled: overlay })
  const subs = ws.subtasksOf(task.id)
  const subsDone = subs.filter((s) => s.status === 'done').length
  const blocked = ws.isBlocked(task)
  const project = ws.getProject(task.projectId)
  const selected = openTaskId === task.id
  const field = (name: string) => !visibleFields || visibleFields.has(name)

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node) }}
      style={{ transform: collapsed ? undefined : CSS.Translate.toString(transform) }}
      data-task-id={task.id}
      data-drag-source={collapsed || undefined}
      className={cn(
        'group relative rounded-md border border-border bg-card select-none transition-[border-color,box-shadow,background-color,transform] duration-150',
        density === 'compact' ? 'p-2.5' : 'p-3',
        selected ? 'border-foreground/25 bg-accent/40' : 'hover:border-input hover:bg-accent/20 hover:shadow-[0_2px_8px_hsl(240_8%_10%/0.06)]',
        isDragging && 'opacity-40',
        collapsed && '!absolute h-0 w-0 overflow-hidden border-0 !p-0 opacity-0 pointer-events-none',
        overlay && 'shadow-[0_8px_24px_hsl(240_8%_10%/0.14)] rotate-[1.5deg] cursor-grabbing',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Task card: ${task.title}`}
        onClick={(event) => {
          if (!isDragging) openTask(task.id, event.currentTarget)
        }}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event)
          if (event.key === 'Enter') openTask(task.id, event.currentTarget)
        }}
        className="absolute inset-0 z-0 rounded-md cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <p className={cn('relative z-10 pointer-events-none text-[13px] font-medium leading-5 text-pretty', task.status === 'done' && 'line-through text-muted-foreground font-normal')}>
        {task.title}
      </p>
      <div className="pointer-events-none relative z-10 mt-2 flex h-7 min-w-0 items-center text-[12.5px] text-muted-foreground">
        {field('project') && project && <span className="min-w-0 flex-1 truncate">{project.name}</span>}
      </div>
      <div className="relative z-10 pointer-events-none mt-2 grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-x-2 text-[12.5px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="truncate text-[12.5px] text-muted-foreground">{STATUS_LABELS[task.status]}</span>
          {blocked && task.status !== 'done' && <BlockedIndicator />}
          {subs.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums" aria-label={`${subsDone} of ${subs.length} subtasks done`}>
              <span className="h-1 w-5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-foreground/55" style={{ width: `${(subsDone / subs.length) * 100}%` }} /></span>
              {subsDone}/{subs.length}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 overflow-hidden">
          {field('dueDate') && <DueBadge date={task.dueDate} done={task.status === 'done'} className="min-w-0 max-w-[88px] justify-start text-[12.5px]" />}
          {field('priority') && <PriorityBadge priority={task.priority} className="shrink-0" />}
        </div>
      </div>
    </div>
  )
}

function BoardColumn({
  status,
  tasks,
  onAddTask,
  activeId,
  target,
  holeHeight,
  density,
  visibleFields,
}: {
  status: TaskStatus
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  activeId: string | null
  target: DragTarget | null
  holeHeight: number
  density: 'comfortable' | 'compact'
  visibleFields?: Set<string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  const visibleTasks = tasks.filter((task) => activeId !== task.id)
  let visibleIndex = 0
  return (
    <section
      data-column-status={status}
      aria-label={`${STATUS_LABELS[status]} column`}
      className={cn(
        'flex min-w-[220px] flex-col rounded-lg transition-colors duration-150 max-h-full',
        isOver && 'bg-accent/50',
      )}
    >
      <header className="flex items-center gap-2 px-1.5 py-1.5">
        <h2 className="text-[12.5px] font-semibold text-foreground/90">{STATUS_LABELS[status]}</h2>
        <CountBadge count={tasks.length} label={`${tasks.length} tasks`} />
        <button
          onClick={() => onAddTask(status)}
          aria-label={`Add task to ${STATUS_LABELS[status]}`}
          className="ml-auto size-11 lg:size-6 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[120px] space-y-2 px-1 pb-2 overflow-y-auto scrollbar-thin rounded-md"
      >
        {tasks.flatMap((task) => {
          if (activeId === task.id) return [<BoardCard key={task.id} task={task} collapsed />]
          const index = visibleIndex++
          return [
            ...(target?.status === status && target.index === index
              ? [<div key="drop-hole" data-slotwrap aria-hidden style={{ height: holeHeight }} />]
              : []),
            <div key={task.id}>
              <BoardCard task={task} density={density} visibleFields={visibleFields} />
            </div>,
          ]
        })}
        {target?.status === status && target.index >= visibleTasks.length && (
          <div data-slotwrap aria-hidden style={{ height: holeHeight }} />
        )}
        {tasks.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground/70 text-center py-6 border border-dashed border-border rounded-md">
            Nothing here
          </p>
        )}
      </div>
    </section>
  )
}

export function Board({
  tasks,
  onAddTask,
  density = 'comfortable',
  visibleFields,
}: {
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  density?: 'comfortable' | 'compact'
  visibleFields?: Set<string>
}) {
  const ws = useWorkspace()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [target, setTarget] = useState<DragTarget | null>(null)
  const [holeHeight, setHoleHeight] = useState(0)
  const [overlayWidth, setOverlayWidth] = useState(248)
  const [dropPreview, setDropPreview] = useState<Task[] | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const pickupSnapshot = useRef<PickupSnapshot | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const targetRef = useRef<DragTarget | null>(null)
  const dragX = useMotionValue(0)
  const reducedMotion = useReducedMotion()
  const velocityX = useVelocity(dragX)
  const tiltRaw = useTransform(velocityX, [-1200, 1200], [-3, 3], { clamp: true })
  const tiltSpring = useSpring(tiltRaw, { stiffness: 300, damping: 30, mass: 0.6 })
  const tilt = useTransform(() => reducedMotion ? 0 : tiltSpring.get())
  const statuses = ws.supportsBlockedStatus ? TASK_STATUS_ORDER : TASK_STATUS_ORDER.filter((status) => status !== 'blocked')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const boardTasks = dropPreview ?? tasks
  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, Task[]>()
    statuses.forEach((s) => m.set(s, []))
    ;[...boardTasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt - b.createdAt).forEach((t) => {
      m.get(t.status)?.push(t)
    })
    return m
  }, [statuses, boardTasks])

  const activeTask = activeId ? ws.getTask(activeId) : undefined
  const setNextTarget = (next: DragTarget | null) => {
    targetRef.current = next
    setTarget(next)
  }

  const onDragStart = (event: DragStartEvent) => {
    const board = boardRef.current
    const taskId = String(event.active.id)
    const task = ws.getTask(taskId)
    if (!board || !task) return
    const pointerEvent = event.activatorEvent
    const pointer = pointerEvent instanceof TouchEvent && pointerEvent.touches[0]
      ? { x: pointerEvent.touches[0].clientX, y: pointerEvent.touches[0].clientY }
      : pointerEvent instanceof MouseEvent
        ? { x: pointerEvent.clientX, y: pointerEvent.clientY }
        : { x: event.active.rect.current.initial?.left ?? 0, y: event.active.rect.current.initial?.top ?? 0 }
    const columns = new Map<TaskStatus, DOMRect>()
    board.querySelectorAll<HTMLElement>('[data-column-status]').forEach((node) => columns.set(node.dataset.columnStatus as TaskStatus, node.getBoundingClientRect()))
    const cards = new Map<string, DOMRect>()
    board.querySelectorAll<HTMLElement>('[data-task-id]').forEach((node) => cards.set(node.dataset.taskId!, node.getBoundingClientRect()))
    const activeRect = cards.get(taskId)
    pickupSnapshot.current = { columns, cards, board: board.getBoundingClientRect(), gap: 8, scrollLeft: board.scrollLeft, pointer, keyboard: pointerEvent instanceof KeyboardEvent }
    const status = task.status
    const index = (byStatus.get(status) ?? []).findIndex((item) => item.id === taskId)
    activeIdRef.current = taskId
    setActiveId(taskId)
    setNextTarget({ status, index: Math.max(0, index) })
    setHoleHeight(activeRect?.height ?? 92)
    setOverlayWidth(activeRect?.width ?? 248)
    dragX.set(0)
  }

  const onDragMove = (event: DragMoveEvent) => {
    const shot = pickupSnapshot.current
    const taskId = String(event.active.id)
    if (!shot || activeIdRef.current !== taskId) return
    dragX.set(event.delta.x)
    const px = shot.pointer.x + event.delta.x + ((boardRef.current?.scrollLeft ?? shot.scrollLeft) - shot.scrollLeft)
    const py = shot.pointer.y + event.delta.y
    if (py < shot.board.top - 60 || py > shot.board.bottom + 60) return
    const columns = [...shot.columns.entries()]
    const containing = columns.filter(([, rect]) =>
      px >= rect.left - shot.gap && px <= rect.right + shot.gap &&
      py >= rect.top - shot.gap && py <= rect.bottom + shot.gap,
    )
    const distance = (rect: DOMRect) => {
      const dx = px - (rect.left + rect.width / 2)
      const dy = py - (rect.top + rect.height / 2)
      return dx * dx + dy * dy
    }
    const status = (containing.length > 0 ? containing : columns)
      .sort((a, b) => distance(a[1]) - distance(b[1]))[0]?.[0]
    if (!status) return
    const ids = (byStatus.get(status) ?? []).map((task) => task.id)
    let index = 0
    for (const id of ids) {
      const rect = shot.cards.get(id)
      if (rect && py > rect.top + rect.height / 2) index += 1
    }
    const activeTask = ws.getTask(taskId)
    const from = activeTask?.status
    const fromIndex = ids.indexOf(taskId)
    if (status === from && fromIndex >= 0 && index > fromIndex) index -= 1
    setNextTarget({ status, index: Math.max(0, Math.min(index, ids.length - (status === from ? 1 : 0))) })
  }

  const onDragOver = (event: DragOverEvent) => {
    if (!pickupSnapshot.current?.keyboard || !event.over) return
    const overId = String(event.over.id)
    if (overId.startsWith('col-')) {
      const status = overId.slice(4) as TaskStatus
      setNextTarget({ status, index: (byStatus.get(status) ?? []).length })
      return
    }
    if (!overId.startsWith('card-')) return
    const overTask = ws.getTask(overId.slice(5))
    if (!overTask) return
    const index = (byStatus.get(overTask.status) ?? []).findIndex((task) => task.id === overTask.id)
    setNextTarget({ status: overTask.status, index: Math.max(0, index) })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const taskId = String(e.active.id)
    const t = ws.getTask(taskId)
    const finalTarget = targetRef.current
    if (finalTarget && t) {
      const patch = getBoardDropPatch(boardTasks, taskId, finalTarget.status, finalTarget.index)
      setDropPreview(placeBoardTask(boardTasks, taskId, patch.status, patch.beforeId))
      void Promise.resolve(ws.updateTask(taskId, patch, { silent: true })).finally(() => setDropPreview(null))
    }
    setActiveId(null)
    activeIdRef.current = null
    setNextTarget(null)
    pickupSnapshot.current = null
  }

  const cancelDrag = () => { activeIdRef.current = null; setActiveId(null); setNextTarget(null); pickupSnapshot.current = null }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragMove={onDragMove} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={cancelDrag}>
      <div ref={boardRef} className="grid w-full min-w-0 grid-cols-1 items-start gap-3 overflow-x-hidden px-4 pb-3 sm:grid-cols-2 sm:px-6 xl:grid-cols-3 2xl:grid-cols-6 flex-1 min-h-0">
        {statuses.map((s) => (
          <BoardColumn key={s} status={s} tasks={byStatus.get(s) ?? []} onAddTask={onAddTask} activeId={activeId} target={target} holeHeight={holeHeight} density={density} visibleFields={visibleFields} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <motion.div style={{ width: overlayWidth, rotate: tilt }}><BoardCard task={activeTask} overlay density={density} visibleFields={visibleFields} /></motion.div> : null}
      </DragOverlay>
    </DndContext>
  )
}
