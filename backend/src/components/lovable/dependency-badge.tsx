import { GitBranch } from "lucide-react"

import { Chip } from "@/components/lovable/page"
import type { WorkItem } from "@/lib/mock-data"
import { isBlockedByOpenTask } from "@/lib/work-item-dependencies"

export function DependencyBadge({ item, allItems }: { item: WorkItem; allItems?: WorkItem[] }) {
  const blockerCount = item.blockerIds?.length ?? 0
  const blockingCount = item.blockingIds?.length ?? 0
  if (blockerCount === 0 && blockingCount === 0) return null

  const isOpenBlocked = allItems ? isBlockedByOpenTask(item, allItems) : blockerCount > 0
  const label = isOpenBlocked ? "Blocked" : blockingCount > 0 ? `Blocking ${blockingCount}` : `Blocked by ${blockerCount}`

  return (
    <span title={isOpenBlocked ? "This task is waiting on another open task." : "This task has dependency links."}>
      <Chip tone={isOpenBlocked ? "warning" : "neutral"}>
        <GitBranch className="h-3 w-3" />
        {label}
      </Chip>
    </span>
  )
}
