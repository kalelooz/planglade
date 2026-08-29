import type { Task } from '@/types'

export function indexTasksByParent(tasks: Task[]) {
  const byParent = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.parentId) continue
    const siblings = byParent.get(task.parentId)
    if (siblings) siblings.push(task)
    else byParent.set(task.parentId, [task])
  }
  return byParent
}
