import type { WorkItem } from "@/lib/mock-data"

export function getSubtasks(item: WorkItem, allItems: WorkItem[]) {
  return allItems.filter((candidate) => candidate.parentId === item.id)
}

export function getParentTask(item: WorkItem, allItems: WorkItem[]) {
  if (!item.parentId) return null
  return allItems.find((candidate) => candidate.id === item.parentId) ?? null
}

export function subtaskProgress(item: WorkItem, allItems: WorkItem[]) {
  const subtasks = getSubtasks(item, allItems)
  const done = subtasks.filter((subtask) => subtask.status === "Done").length
  return {
    done,
    total: subtasks.length,
    open: subtasks.length - done,
  }
}
