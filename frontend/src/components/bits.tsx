import React from 'react'
import { Check, Flag, CircleSlash, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Priority, TaskStatus, Project, Label as LabelType } from '@/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@/types'
import { dueTone, relativeLabel } from '@/lib/dates'
import { useWorkspaceCapabilities, useWorkspaceData } from '@/store/workspace'

// eslint-disable-next-line react-refresh/only-export-components
export const priorityStyles: Record<Priority, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-sky-600 dark:text-sky-400',
  none: 'text-muted-foreground',
}

type PageWidth = 'standard' | 'wide' | 'canvas' | 'reading'

const pageWidthClasses: Record<PageWidth, string> = {
  standard: 'mx-auto max-w-[1200px] px-3 sm:px-5 lg:px-6 xl:px-8',
  wide: 'mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6 xl:px-8',
  canvas: 'px-3 sm:px-5 lg:px-6 xl:px-8',
  reading: 'mx-auto max-w-[900px] px-3 sm:px-5 lg:px-6',
}

export function PageContainer({ width = 'standard', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { width?: PageWidth }) {
  return <div className={cn('w-full', pageWidthClasses[width], className)} {...props} />
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { state } = useWorkspaceData()
  const asText = state.settings.priorityDisplay === 'text'
  if (priority === 'none') {
    return asText ? <span className={cn('text-xs text-muted-foreground', className)}>—</span> : null
  }
  if (asText) {
    return (
      <span className={cn('text-xs font-medium', priorityStyles[priority], className)}>
        {PRIORITY_LABELS[priority]}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1', priorityStyles[priority], className)} title={`${PRIORITY_LABELS[priority]} priority`}>
      <Flag className={cn('h-3.5 w-3.5', priority === 'high' && 'fill-current')} aria-label={`${PRIORITY_LABELS[priority]} priority`} />
      <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>
    </span>
  )
}

const statusStyles: Record<TaskStatus, string> = {
  backlog: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  planned: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  blocked: 'bg-red-500/10 text-red-700 dark:text-red-400',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn('pg-chip-text inline-flex items-center rounded-full border border-current/15 px-1.5 py-1 whitespace-nowrap', statusStyles[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function DueBadge({ date, done, className }: { date: string | null; done?: boolean; className?: string }) {
  if (!date) return null
  const tone = dueTone(date, !!done)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs whitespace-nowrap min-w-0',
        tone === 'overdue' && 'text-red-600 dark:text-red-400 font-medium',
        tone === 'today' && 'text-amber-700 dark:text-amber-300 font-medium',
        tone === 'soon' && 'text-foreground/80',
        (tone === 'future' || tone === 'none') && 'text-muted-foreground',
        className,
      )}
    >
      <CalendarDays className="h-3 w-3 opacity-70 shrink-0" aria-hidden />
      <span className="truncate min-w-0">{relativeLabel(date)}</span>
      {tone === 'overdue' && <span className="sr-only">(overdue)</span>}
    </span>
  )
}

export function ProjectChip({ project, className, onClick }: { project: Project | undefined | null; className?: string; onClick?: () => void }) {
  if (!project) return null
  const inner = (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" aria-hidden />
      <span className="truncate">{project.name}</span>
    </span>
  )
  if (onClick) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={cn('text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0 max-w-full', className)}
      >
        {inner}
      </button>
    )
  }
  return <span className={cn('text-xs text-muted-foreground min-w-0', className)}>{inner}</span>
}

export function LabelChip({ label, className }: { label: LabelType; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[12.5px] font-medium', className)}
      style={{ borderColor: `hsl(${label.color} / 0.4)`, color: `hsl(${label.color})`, backgroundColor: `hsl(${label.color} / 0.08)` }}
    >
      {label.name}
    </span>
  )
}

export function TaskCheckbox({
  checked,
  onToggle,
  blocked,
  size = 'md',
}: {
  checked: boolean
  onToggle: () => void
  blocked?: boolean
  size?: 'sm' | 'md'
}) {
  const { canMutateTasks, taskMutationPending } = useWorkspaceCapabilities()
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={taskMutationPending ? 'Saving task completion' : checked ? 'Mark as not done' : 'Mark as done'}
      aria-busy={taskMutationPending}
      title={taskMutationPending ? 'Saving task completion…' : undefined}
        disabled={!canMutateTasks || taskMutationPending}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'shrink-0 rounded-full inline-flex items-center justify-center bg-transparent transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96]',
        size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4',
        (!canMutateTasks || taskMutationPending) && 'cursor-default opacity-70 active:scale-100',
      )}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[color,background-color,border-color,box-shadow] duration-150',
          size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4',
          checked
            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
            : 'border-muted-foreground/40 bg-transparent group-hover:border-foreground/70',
          blocked && !checked && 'border-red-400/60',
        )}
      >
        {checked && <Check className={size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5'} strokeWidth={3} />}
      </span>
    </button>
  )
}

export function BlockedIndicator({ className }: { className?: string }) {
  return (
    <span className={cn('pg-chip-text inline-flex items-center gap-1 text-red-600 dark:text-red-400', className)} title="Blocked by another task">
      <CircleSlash className="h-3 w-3" />
      <span>Blocked</span>
    </span>
  )
}

export function BlockingIndicator({ className }: { className?: string }) {
  return (
    <span className={cn('pg-chip-text inline-flex items-center gap-1 text-orange-700 dark:text-orange-300', className)} title="Blocking another task">
      <CircleSlash className="h-3 w-3 rotate-45" />
      <span>Blocking</span>
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-3 text-muted-foreground/50">{icon}</div>}
      <p className="pg-item-title">{title}</p>
      {hint && <p className="pg-body-muted mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function CountBadge({ count, label, className }: { count: number; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-foreground bg-foreground px-1 text-[12.5px] font-semibold leading-none tabular-nums text-background',
        className,
      )}
      aria-label={label ?? `${count} items`}
    >
      {count}
    </span>
  )
}

export function SectionHeader({
  id,
  title,
  count,
  action,
  collapsible,
  collapsed,
  onToggle,
}: {
  id?: string
  title: string
  count?: number
  action?: React.ReactNode
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <>
      <h2 id={id} className="pg-section-title">{title}</h2>
      {count !== undefined && <CountBadge count={count} />}
    </>
  )
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      {collapsible ? (
        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex items-center gap-2 group rounded -ml-1 px-1 py-0.5 hover:bg-accent/60 transition-colors"
        >
          {inner}
          <span className={cn('text-muted-foreground transition-transform duration-150 text-[12.5px]', collapsed ? '-rotate-90' : 'rotate-0')} aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2">{inner}</div>
      )}
      {action}
    </div>
  )
}
