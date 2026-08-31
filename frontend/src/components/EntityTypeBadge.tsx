import { CheckSquare2, FolderKanban, Inbox, StickyNote, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type EntityType = 'capture' | 'task' | 'project' | 'note' | 'person'

const ENTITY_TYPES = {
  capture: { icon: Inbox, label: 'Capture' },
  task: { icon: CheckSquare2, label: 'Task' },
  project: { icon: FolderKanban, label: 'Project' },
  note: { icon: StickyNote, label: 'Note' },
  person: { icon: UserRound, label: 'Person' },
} satisfies Record<EntityType, { icon: typeof Inbox; label: string }>

export function EntityTypeBadge({ type, className }: { type: EntityType; className?: string }) {
  const { icon: Icon, label } = ENTITY_TYPES[type]
  return (
    <Badge
      variant="outline"
      data-entity-type={type}
      aria-label={`${label} type`}
      title="System type — separate from custom labels"
      className={cn('h-5 gap-1 rounded px-1.5 py-0 text-xs font-medium text-muted-foreground', className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}
