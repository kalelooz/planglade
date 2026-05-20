import type { Project, Status, WorkItem } from "@/lib/mock-data"

export type ApiWorkItem = {
  id: string
  title: string
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  assigneeId: string | null
  projectId: string | null
  startDate: string | null
  dueDate: string | null
  description: string | null
  labels: Array<{ label: { name: string } }>
  noteIds?: unknown
  checklist?: unknown
  createdAt?: string
  updatedAt?: string
}

export type ApiProject = {
  id: string
  name: string
  status: "ACTIVE" | "IN_REVIEW" | "ON_HOLD" | "ARCHIVED"
  dueDate: string | null
  color: string | null
  createdById: string
}

export type ApiNote = {
  id: string
  title: string
  body: string | null
  updatedAt: string
}

function dateOnly(value: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

export function toUiWorkStatus(status: ApiWorkItem["status"]): Status {
  if (status === "BACKLOG") return "Backlog"
  if (status === "TODO") return "To Do"
  if (status === "IN_PROGRESS") return "In Progress"
  if (status === "IN_REVIEW") return "In Review"
  return "Done"
}

export function toApiWorkStatus(status: Status): ApiWorkItem["status"] {
  if (status === "Backlog") return "BACKLOG"
  if (status === "To Do") return "TODO"
  if (status === "In Progress") return "IN_PROGRESS"
  if (status === "In Review") return "IN_REVIEW"
  return "DONE"
}

export function toApiWorkPriority(priority: WorkItem["priority"]): ApiWorkItem["priority"] {
  if (priority === "High") return "HIGH"
  if (priority === "Low") return "LOW"
  return "MEDIUM"
}

export function toApiProjectStatus(status: Project["status"]): ApiProject["status"] {
  if (status === "Active") return "ACTIVE"
  if (status === "In Review") return "IN_REVIEW"
  if (status === "On Hold") return "ON_HOLD"
  return "ARCHIVED"
}

export function toIsoDateTime(value: string | null | undefined) {
  if (!value) return undefined
  const normalized = value.includes("T") ? value : `${value}T00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function toUiPriority(priority: ApiWorkItem["priority"]): WorkItem["priority"] {
  if (priority === "LOW") return "Low"
  if (priority === "HIGH" || priority === "URGENT") return "High"
  return "Medium"
}

export function toUiWorkItem(item: ApiWorkItem, _currentUserId: string | null): WorkItem {
  const assignee = item.assigneeId ?? "unassigned"
  const noteIds = Array.isArray(item.noteIds) ? item.noteIds.filter((value): value is string => typeof value === "string") : undefined
  const checklist = Array.isArray(item.checklist)
    ? item.checklist
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null
          const itemObj = entry as { id?: unknown; text?: unknown; done?: unknown }
          if (typeof itemObj.id !== "string" || typeof itemObj.text !== "string") return null
          return { id: itemObj.id, text: itemObj.text, done: Boolean(itemObj.done) }
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : undefined

  return {
    id: item.id,
    title: item.title,
    status: toUiWorkStatus(item.status),
    priority: toUiPriority(item.priority),
    assignee,
    label: item.labels[0]?.label.name ?? "Task",
    start: dateOnly(item.startDate),
    due: dateOnly(item.dueDate),
    project: item.projectId ?? "core",
    description: item.description ?? undefined,
    noteIds,
    checklist,
  }
}

export function toUiProject(item: ApiProject, currentUserId: string | null): Project {
  const status =
    item.status === "ACTIVE"
      ? "Active"
      : item.status === "IN_REVIEW"
        ? "In Review"
        : item.status === "ON_HOLD"
          ? "On Hold"
          : "Archived"

  return {
    id: item.id,
    name: item.name,
    status,
    due: dateOnly(item.dueDate),
    owner: item.createdById ?? currentUserId ?? "unassigned",
    progress: 0,
    accent: item.color ?? "oklch(0.52 0.09 195)",
  }
}

export function toUiNotePreview(note: ApiNote) {
  const excerpt = (note.body ?? "").trim()
  return {
    id: note.id,
    title: note.title,
    tag: "Note",
    updated: new Date(note.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    excerpt: excerpt.length > 80 ? `${excerpt.slice(0, 80)}...` : excerpt,
  }
}
