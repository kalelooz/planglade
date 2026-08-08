type BoardTask<TStatus extends string = string> = { id: string; status: TStatus; position?: number; createdAt?: number | string }

const createdOrder = (task: BoardTask, fallback: number) => typeof task.createdAt === 'number' ? task.createdAt : task.createdAt ? Date.parse(task.createdAt) : fallback

export function getBoardDropPatch<TStatus extends string>(tasks: BoardTask<TStatus>[], taskId: string, targetStatus: TStatus, targetIndex: number): { status: TStatus; beforeId: string | null } {
  const targets = tasks
    .filter((task) => task.id !== taskId && task.status === targetStatus)
    .map((task, index) => ({ task, index }))
    .sort((a, b) => (a.task.position ?? 0) - (b.task.position ?? 0) || createdOrder(a.task, a.index) - createdOrder(b.task, b.index))
    .map(({ task }) => task)
  const before = targets[Math.max(0, Math.min(targetIndex, targets.length))]
  return { status: before?.status ?? targetStatus, beforeId: before?.id ?? null }
}

export function placeBoardTask<T extends BoardTask>(tasks: T[], taskId: string, status: T['status'], beforeId: string | null): T[] {
  const moved = tasks.find((task) => task.id === taskId)
  if (!moved) return tasks
  const without = tasks.filter((task) => task.id !== taskId)
  const updated = { ...moved, status } as T
  const targets = without
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === status)
    .sort((a, b) => (a.task.position ?? 0) - (b.task.position ?? 0) || createdOrder(a.task, a.index) - createdOrder(b.task, b.index))
    .map(({ task }) => task)
  const beforeIndex = beforeId ? targets.findIndex((task) => task.id === beforeId) : -1
  targets.splice(beforeIndex >= 0 ? beforeIndex : targets.length, 0, updated)
  const positions = new Map(targets.map((task, index) => [task.id, (index + 1) * 1024]))
  return tasks.map((task) => task.id === taskId
    ? { ...updated, position: positions.get(taskId) }
    : positions.has(task.id) ? { ...task, position: positions.get(task.id) } : task)
}
