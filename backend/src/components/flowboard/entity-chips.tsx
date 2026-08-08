"use client"

import * as React from "react"
import { useDrawer, type DrawerType } from "@/components/flowboard/drawer-context"

// ---------------------------------------------------------------------------
// Entity Chip — two variants, now with optional drawer integration
// ---------------------------------------------------------------------------

type ChipType = "user" | "task" | "project" | "note"

/**
 * "default" — soft colored pill, used in Kanban cards & Notes linked tasks.
 * "subtle"  — whisper-style, barely-there highlight for Activity Feed & My Tasks.
 */
type ChipVariant = "default" | "subtle"

// -- Default variant: colored backgrounds ----------------------------------

const defaultStyles: Record<ChipType, string> = {
  user: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  task: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  project: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  note: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

// -- Subtle variant: whisper-style -----------------------------------------

const subtleStyles: Record<ChipType, string> = {
  /**
   * Usernames: no background, just slightly bolder text + faint dotted underline.
   * Blends into the sentence — just enough to distinguish from surrounding words.
   */
  user: "text-foreground font-medium underline decoration-foreground/20 underline-offset-2 decoration-dotted",

  /**
   * Task names: lightest possible neutral background, no color tint.
   * bg-muted = auto-adapts to light/dark. Barely rounded, zero vertical padding.
   */
  task: "bg-muted text-foreground font-normal rounded-sm px-1 py-0",

  /**
   * Project names: same whisper treatment as task names.
   */
  project: "bg-muted text-foreground font-normal rounded-sm px-1 py-0",

  /**
   * Note titles: same whisper treatment as task/project names.
   */
  note: "bg-muted text-foreground font-normal rounded-sm px-1 py-0",
}

// Map ChipType to DrawerType
const chipToDrawerType: Record<ChipType, DrawerType> = {
  user: "member",
  task: "task",
  project: "project",
  note: "note",
}

interface EntityChipProps {
  /** Which entity type — controls the color palette */
  type: ChipType
  children: React.ReactNode
  /** Override or extend styles (e.g. "text-xs" for compact contexts) */
  className?: string
  /**
   * "default" — soft colored pill (Kanban, Notes)
   * "subtle"  — whisper highlight, almost invisible (Activity Feed, My Tasks)
   */
  variant?: ChipVariant
  /**
   * Entity ID — when provided, clicking the chip opens the detail drawer.
   * For "user" type, pass the user's initials (e.g. "AM").
   * For "task" type, pass the task ID (e.g. "T4").
   * For "project" type, pass the project ID (e.g. "P1").
   * For "note" type, pass the note ID (e.g. "N1").
   */
  entityId?: string
}

export function EntityChip({ type, children, className = "", variant = "default", entityId }: EntityChipProps) {
  const { openDrawer } = useDrawer()
  const styles = variant === "subtle" ? subtleStyles[type] : defaultStyles[type]

  // Default variant uses rounded-md + padding; subtle uses its own (already in the style string)
  const baseLayout =
    variant === "subtle"
      ? "" // subtle styles already include their own spacing/rounding
      : "rounded-md px-1.5 py-0.5 font-medium"

  const handleClick = entityId
    ? (e: React.MouseEvent) => {
        e.stopPropagation()
        openDrawer(chipToDrawerType[type], entityId)
      }
    : undefined

  if (entityId) {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center ${baseLayout} ${styles} ${className} hover:brightness-110 cursor-pointer transition-all`}
      >
        {children}
      </button>
    )
  }

  return (
    <span className={`inline-flex items-center ${baseLayout} ${styles} ${className}`}>
      {children}
    </span>
  )
}
