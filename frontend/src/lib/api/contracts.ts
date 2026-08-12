import { z } from 'zod'

const nullableDate = z.string().nullable()

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }).passthrough(),
  workspace: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    taskPriorityDisplayStyle: z.string().optional(),
  }).passthrough(),
  workspaces: z.array(z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    role: z.string(),
    taskPriorityDisplayStyle: z.string().optional(),
  }).passthrough()).optional(),
  members: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }).passthrough()).optional(),
  authMode: z.string().optional(),
}).passthrough()

export const workspaceResponseSchema = z.object({
  workspace: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    role: z.string().optional(),
    taskPriorityDisplayStyle: z.string().optional(),
  }).passthrough(),
}).passthrough()

export const userSettingsResponseSchema = z.object({
  settings: z.object({
    theme: z.enum(['system', 'light', 'dark']).nullable(),
    priorityDisplay: z.enum(['icon', 'text']).nullish(),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]).nullish(),
    hideHomeCompleted: z.boolean().nullish(),
  }).passthrough().nullable(),
  workspace: z.object({ taskPriorityDisplayStyle: z.string() }).passthrough(),
}).passthrough()

export const backendProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: z.enum(['ACTIVE', 'IN_REVIEW', 'ON_HOLD', 'ARCHIVED']),
  mode: z.enum(['STANDARD', 'SERVICE_DESK']),
  featureFlags: z.unknown().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullish(),
  startDate: nullableDate,
  dueDate: nullableDate,
  archivedAt: nullableDate,
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

const backendLabelSchema = z.object({
  label: z.object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    color: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).passthrough(),
}).passthrough()

export const backendNoteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  visibility: z.enum(['PRIVATE', 'WORKSPACE']),
  pinned: z.boolean(),
  tags: z.unknown().nullable(),
  createdById: z.string(),
  updatedById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

const relationEndpointSchema = z.object({
  id: z.string(),
  title: z.string(),
  projectId: z.string().nullable(),
}).passthrough()

export const backendWorkItemRelationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationType: z.enum(['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES', 'PARENT_OF', 'CHILD_OF']),
  createdAt: z.string(),
  source: relationEndpointSchema,
  target: relationEndpointSchema,
}).passthrough()

export const backendWorkItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  checklist: z.unknown().nullable(),
  noteIds: z.unknown().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
  isInbox: z.boolean().default(false),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  startDate: nullableDate,
  dueDate: nullableDate,
  completedAt: nullableDate,
  sortOrder: z.number(),
  position: z.number(),
  createdById: z.string(),
  assigneeId: z.string().nullable(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  labels: z.array(backendLabelSchema),
}).passthrough()

export const projectListSchema = z.object({
  projects: z.array(backendProjectSchema),
}).passthrough()

export const projectResponseSchema = z.object({
  project: backendProjectSchema,
}).passthrough()

export const workItemListSchema = z.object({
  workItems: z.array(backendWorkItemSchema),
}).passthrough()

export const workItemResponseSchema = z.object({
  workItem: backendWorkItemSchema,
}).passthrough()

export const workItemHistorySchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    summary: z.string(),
    actor: z.object({ id: z.string(), name: z.string().nullable(), email: z.string() }).nullable(),
    createdAt: z.string(),
  }).passthrough()),
}).passthrough()

export const noteListSchema = z.object({
  notes: z.array(backendNoteSchema),
}).passthrough()

export const noteResponseSchema = z.object({
  note: backendNoteSchema,
}).passthrough()

export const noteDeleteResponseSchema = z.object({
  deleted: z.literal(true),
}).passthrough()

export const workItemRelationListSchema = z.object({
  relations: z.array(backendWorkItemRelationSchema),
}).passthrough()

export const workItemRelationResponseSchema = z.object({
  relation: backendWorkItemRelationSchema,
}).passthrough()

export const workItemRelationDeleteSchema = z.object({
  deleted: z.literal(true),
}).passthrough()

export const backendSavedViewSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  createdById: z.string(),
  name: z.string(),
  layout: z.string(),
  groupBy: z.string().nullable(),
  orderBy: z.string().nullable(),
  filters: z.unknown().nullable(),
  display: z.unknown().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

export const savedViewListSchema = z.object({ savedViews: z.array(backendSavedViewSchema) }).passthrough()
export const savedViewResponseSchema = z.object({ savedView: backendSavedViewSchema }).passthrough()
export const savedViewDeleteSchema = z.object({ deleted: z.literal(true) }).passthrough()

// The export is an archival payload, so retain fields the frontend does not render.
export const workspaceExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  generatedAt: z.string(),
  workspace: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    taskPriorityDisplayStyle: z.string(),
  }).passthrough(),
  projects: z.array(z.unknown()),
  tasks: z.array(z.unknown()),
  inboxItems: z.array(z.unknown()),
  notes: z.array(z.unknown()),
  labels: z.array(z.unknown()),
  taskLabels: z.array(z.unknown()),
  legacyDocs: z.array(z.unknown()),
  savedViews: z.array(z.unknown()).default([]),
  data: z.object({}).passthrough(),
  counts: z.object({
    projects: z.number(),
    tasks: z.number(),
    inboxItems: z.number(),
    workItems: z.number(),
    notes: z.number(),
    labels: z.number(),
    taskLabels: z.number(),
    legacyDocs: z.number(),
    projectDocs: z.number(),
    savedViews: z.number().default(0),
  }).passthrough(),
}).passthrough()

export const workspaceImportSnapshotSchema = z.object({
  version: z.number().int().positive().optional(),
  generatedAt: z.string().optional(),
  workspace: z.object({ id: z.string().optional(), slug: z.string().optional(), name: z.string().optional() }).passthrough().optional(),
  settings: z.unknown().optional(),
  data: z.object({
    projects: z.array(z.unknown()).default([]),
    workItems: z.array(z.unknown()).default([]),
    notes: z.array(z.unknown()).default([]),
    projectDocs: z.array(z.unknown()).default([]),
    savedViews: z.array(z.unknown()).default([]),
  }).passthrough(),
}).passthrough()

export const workspaceImportPreviewSchema = z.object({
  workspaceId: z.string(),
  counts: z.object({
    projects: z.number(), tasks: z.number(), notes: z.number(), projectDocs: z.number(), savedViews: z.number(),
    settings: z.number(), archivedProjectDocs: z.number(),
  }).passthrough(),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), count: z.number().optional() }).passthrough()),
  writes: z.literal(false),
}).passthrough()

export const workspaceImportResultSchema = z.object({
  workspaceId: z.string(),
  mode: z.literal('append'),
  imported: z.object({ projects: z.number(), workItems: z.number(), notes: z.number(), projectDocs: z.number(), savedViews: z.number() }).passthrough(),
  skipped: z.object({ workItems: z.number(), notes: z.number(), projectDocs: z.number(), savedViews: z.number() }).passthrough(),
}).passthrough()

export type Session = z.infer<typeof sessionSchema>
export type BackendWorkspace = z.infer<typeof workspaceResponseSchema>['workspace']
export type BackendProject = z.infer<typeof backendProjectSchema>
export type BackendWorkItem = z.infer<typeof backendWorkItemSchema>
export type BackendNote = z.infer<typeof backendNoteSchema>
export type BackendWorkItemRelation = z.infer<typeof backendWorkItemRelationSchema>
export type BackendSavedView = z.infer<typeof backendSavedViewSchema>
