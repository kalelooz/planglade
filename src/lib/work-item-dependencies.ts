import type { DependencyLink, WorkItem } from "@/lib/mock-data"

export type WorkItemRelationType = "BLOCKS" | "BLOCKED_BY" | "RELATES_TO" | "DUPLICATES" | "PARENT_OF" | "CHILD_OF"

export type WorkItemDependencyRelation = {
  id: string
  sourceId: string
  targetId: string
  relationType: WorkItemRelationType
}

function appendUnique(values: string[] | undefined, next: string) {
  return values?.includes(next) ? values : [...(values ?? []), next]
}

function appendLink(links: DependencyLink[] | undefined, next: DependencyLink) {
  return links?.some((link) => link.relationId === next.relationId && link.direction === next.direction)
    ? links
    : [...(links ?? []), next]
}

export function applyWorkItemDependencyRelations(items: WorkItem[], relations: WorkItemDependencyRelation[]) {
  const nextItems: WorkItem[] = items.map((item) => ({
    ...item,
    blockerIds: undefined,
    blockingIds: undefined,
    dependencyLinks: undefined,
  }))
  const byId = new Map(nextItems.map((item) => [item.id, item]))

  for (const relation of relations) {
    if (relation.relationType !== "BLOCKED_BY" && relation.relationType !== "BLOCKS") continue

    const blockedId = relation.relationType === "BLOCKED_BY" ? relation.sourceId : relation.targetId
    const blockerId = relation.relationType === "BLOCKED_BY" ? relation.targetId : relation.sourceId
    const blocked = byId.get(blockedId)
    const blocker = byId.get(blockerId)

    if (blocked) {
      blocked.blockerIds = appendUnique(blocked.blockerIds, blockerId)
      blocked.dependencyLinks = appendLink(blocked.dependencyLinks, {
        relationId: relation.id,
        taskId: blockerId,
        direction: "blockedBy",
      })
    }

    if (blocker) {
      blocker.blockingIds = appendUnique(blocker.blockingIds, blockedId)
      blocker.dependencyLinks = appendLink(blocker.dependencyLinks, {
        relationId: relation.id,
        taskId: blockedId,
        direction: "blocking",
      })
    }
  }

  return nextItems
}

export function isBlockedByOpenTask(item: WorkItem, allItems: WorkItem[]) {
  const blockers = new Set(item.blockerIds ?? [])
  return allItems.some((candidate) => blockers.has(candidate.id) && candidate.status !== "Done")
}

export function mergeWorkItemDependencyRelations(current: WorkItem[], relations: WorkItemDependencyRelation[]) {
  return applyWorkItemDependencyRelations(current, relations)
}
