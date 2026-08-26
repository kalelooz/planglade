import { parseDateValue } from "@/lib/api-utils"
import type {
  ImportLocalWorkspaceInput,
  ImportPreviewWorkspaceSnapshotInput,
} from "@/lib/contracts"

export const SUPPORTED_EXPORT_VERSION = 1

export type WorkspaceImportWarning = {
  code: string
  message: string
  count?: number
}

type WorkspaceImportData = Pick<
  ImportLocalWorkspaceInput,
  "projects" | "workItems" | "notes" | "projectDocs" | "savedViews"
>

type WorkspaceImportSource = Pick<
  ImportPreviewWorkspaceSnapshotInput,
  "version" | "generatedAt" | "workspace" | "settings"
> & { data: WorkspaceImportData }

export type ExistingWorkspaceImportValues = {
  projects: string[]
  projectSlugs: string[]
  tasks: string[]
  notes: string[]
  projectDocs: string[]
  savedViews: string[]
}

const EMPTY_EXISTING: ExistingWorkspaceImportValues = {
  projects: [],
  projectSlugs: [],
  tasks: [],
  notes: [],
  projectDocs: [],
  savedViews: [],
}

function normalizeMatchValue(value: string) {
  return value.trim().toLowerCase()
}

function countDuplicates<T>(items: T[], existingValues: string[], getValue: (item: T) => string) {
  const normalized = new Set(existingValues.map(normalizeMatchValue))
  return items.filter((item) => normalized.has(normalizeMatchValue(getValue(item)))).length
}

function addCountWarning(
  warnings: WorkspaceImportWarning[],
  code: string,
  message: string,
  count: number
) {
  if (count > 0) warnings.push({ code, message, count })
}

function normalizeProjectStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_")
  if (normalized === "ACTIVE") return "ACTIVE" as const
  if (normalized === "IN_REVIEW") return "IN_REVIEW" as const
  if (normalized === "ON_HOLD") return "ON_HOLD" as const
  return "ARCHIVED" as const
}

function normalizeProjectMode(value?: string) {
  return value?.trim().toUpperCase().replace(/\s+/g, "_") === "SERVICE_DESK"
    ? "SERVICE_DESK" as const
    : "STANDARD" as const
}

function normalizeWorkItemStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_")
  if (normalized === "TODO" || normalized === "TO_DO") return "TODO" as const
  if (normalized === "IN_PROGRESS") return "IN_PROGRESS" as const
  if (normalized === "IN_REVIEW") return "IN_REVIEW" as const
  if (normalized === "DONE") return "DONE" as const
  return "BACKLOG" as const
}

function normalizeWorkItemPriority(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized === "LOW") return "LOW" as const
  if (normalized === "HIGH") return "HIGH" as const
  if (normalized === "URGENT") return "URGENT" as const
  return "MEDIUM" as const
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "")
}

function reserveProjectSlug(input: string, index: number, usedSlugs: Set<string>) {
  const base = slugify(input) || `project-${index + 1}`
  let slug = base
  let suffix = 2
  while (usedSlugs.has(slug)) {
    const ending = `-${suffix}`
    const prefix = base.slice(0, 50 - ending.length).replace(/-+$/g, "") || "project"
    slug = `${prefix}${ending}`
    suffix += 1
  }
  usedSlugs.add(slug)
  return slug
}

export function buildWorkspaceImportPlan(
  source: WorkspaceImportSource,
  existing: Partial<ExistingWorkspaceImportValues> = EMPTY_EXISTING
) {
  const existingValues = { ...EMPTY_EXISTING, ...existing }
  const usedProjectSlugs = new Set(existingValues.projectSlugs.map(normalizeMatchValue))
  const importedProjectIds = new Set(source.data.projects.map((project) => project.id))
  const importedNoteIds = new Set(source.data.notes.map((note) => note.id))
  const relationCounts = {
    workItemsMissingProjects: source.data.workItems.filter(
      (item) => item.project && !importedProjectIds.has(item.project)
    ).length,
    projectDocsMissingProjects: source.data.projectDocs.filter(
      (doc) => doc.project && !importedProjectIds.has(doc.project)
    ).length,
    workItemsMissingNotes: source.data.workItems.filter((item) =>
      item.noteIds?.some((noteId) => !importedNoteIds.has(noteId))
    ).length,
    archivedProjectDocs: source.data.projectDocs.filter(
      (doc) => doc.status === "ARCHIVED" || Boolean(doc.archivedAt)
    ).length,
    savedViewsMissingProjects: source.data.savedViews.filter(
      (view) => view.project && !importedProjectIds.has(view.project)
    ).length,
  }
  const duplicateCandidates = {
    projects: countDuplicates(source.data.projects, existingValues.projects, (project) => project.name),
    tasks: countDuplicates(source.data.workItems, existingValues.tasks, (item) => item.title),
    notes: countDuplicates(source.data.notes, existingValues.notes, (note) => note.title),
    projectDocs: countDuplicates(source.data.projectDocs, existingValues.projectDocs, (doc) => doc.title),
    savedViews: countDuplicates(source.data.savedViews, existingValues.savedViews, (view) => view.name),
  }
  const warnings: WorkspaceImportWarning[] = []
  if (source.version && source.version !== SUPPORTED_EXPORT_VERSION) {
    warnings.push({
      code: "unsupported_export_version",
      message: `This export version is not currently supported. Expected version ${SUPPORTED_EXPORT_VERSION}.`,
    })
  }
  addCountWarning(warnings, "work_items_missing_projects", "Some tasks reference projects that are not in this import file.", relationCounts.workItemsMissingProjects)
  addCountWarning(warnings, "project_docs_missing_projects", "Some Project Docs reference projects that are not in this import file.", relationCounts.projectDocsMissingProjects)
  addCountWarning(warnings, "work_items_missing_notes", "Some tasks reference notes that are not in this import file.", relationCounts.workItemsMissingNotes)
  addCountWarning(warnings, "archived_project_docs", "Archived Project Docs are included in this import file.", relationCounts.archivedProjectDocs)
  addCountWarning(warnings, "saved_views_missing_projects", "Some saved views reference projects that are not in this import file and will become workspace views.", relationCounts.savedViewsMissingProjects)
  addCountWarning(warnings, "duplicate_projects", "Possible duplicate projects found by simple name matching.", duplicateCandidates.projects)
  addCountWarning(warnings, "duplicate_tasks", "Possible duplicate tasks found by simple title matching.", duplicateCandidates.tasks)
  addCountWarning(warnings, "duplicate_notes", "Possible duplicate notes found by simple title matching.", duplicateCandidates.notes)
  addCountWarning(warnings, "duplicate_project_docs", "Possible duplicate Project Docs found by simple title matching.", duplicateCandidates.projectDocs)
  addCountWarning(warnings, "duplicate_saved_views", "Possible duplicate saved views found by simple name matching.", duplicateCandidates.savedViews)

  return {
    source: {
      version: source.version ?? null,
      generatedAt: source.generatedAt ?? null,
      workspaceName: source.workspace?.name ?? null,
      workspaceSlug: source.workspace?.slug ?? null,
    },
    counts: {
      projects: source.data.projects.length,
      tasks: source.data.workItems.length,
      notes: source.data.notes.length,
      projectDocs: source.data.projectDocs.length,
      savedViews: source.data.savedViews.length,
      settings: source.settings ? 1 : 0,
      archivedProjectDocs: relationCounts.archivedProjectDocs,
    },
    relationIssues: {
      tasksMissingProjects: relationCounts.workItemsMissingProjects,
      projectDocsMissingProjects: relationCounts.projectDocsMissingProjects,
      tasksMissingNotes: relationCounts.workItemsMissingNotes,
      savedViewsMissingProjects: relationCounts.savedViewsMissingProjects,
    },
    duplicateCandidates,
    warnings,
    projects: source.data.projects.map((project, index) => ({
      sourceId: project.id,
      name: project.name,
      slug: reserveProjectSlug(project.name || project.id || "project", index, usedProjectSlugs),
      status: normalizeProjectStatus(project.status),
      mode: normalizeProjectMode(project.mode),
      featureFlags: project.featureFlags,
      dueDate: parseDateValue(project.due) ?? undefined,
      color: project.accent,
    })),
    workItems: source.data.workItems.map((item) => {
      const status = normalizeWorkItemStatus(item.status)
      return {
        sourceId: item.id,
        sourceProjectId: item.project,
        title: item.title,
        description: item.description,
        checklist: item.checklist,
        noteIds: item.noteIds,
        status,
        isInbox: item.isInbox ?? status === "BACKLOG",
        priority: normalizeWorkItemPriority(item.priority),
        startDate: parseDateValue(item.start) ?? undefined,
        dueDate: parseDateValue(item.due) ?? undefined,
        assigneeId: item.assignee,
      }
    }),
    notes: source.data.notes.map((note) => ({
      sourceId: note.id,
      title: note.title,
      body: note.body ?? note.excerpt ?? "",
      visibility: "PRIVATE" as const,
      tags: note.tag ? [note.tag] : [],
    })),
    projectDocs: source.data.projectDocs.map((doc) => ({
      sourceId: doc.id,
      sourceProjectId: doc.project,
      title: doc.title,
      body: doc.body ?? "",
      status: doc.status,
      archivedAt: parseDateValue(doc.archivedAt),
    })),
    savedViews: source.data.savedViews.map((view) => ({
      sourceId: view.id,
      sourceProjectId: view.project,
      name: view.name,
      layout: view.layout,
      groupBy: view.groupBy,
      orderBy: view.orderBy,
      filters: view.filters,
      display: view.display,
      isDefault: view.isDefault,
    })),
  }
}
