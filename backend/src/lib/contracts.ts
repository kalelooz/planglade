import { z } from "zod"

import { PRIORITY_DISPLAY_STYLES } from "./appearance-defaults"

export { DEFAULT_PRIORITY_DISPLAY_STYLE, normalizeAppearanceSettings, resolvePriorityDisplayStyle, type PriorityDisplayStyle } from "./appearance-defaults"

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"])
export const genericWorkspaceRoleSchema = z.enum(["ADMIN", "MEMBER", "VIEWER"])
export const projectStatusSchema = z.enum(["ACTIVE", "IN_REVIEW", "ON_HOLD", "ARCHIVED"])
export const projectModeSchema = z.enum(["STANDARD", "SERVICE_DESK"])
export const workItemStatusSchema = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
export const workItemPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
export const priorityDisplayStyleSchema = z.enum(PRIORITY_DISPLAY_STYLES)
export const noteVisibilitySchema = z.enum(["PRIVATE", "WORKSPACE"])
export const projectDocStatusSchema = z.enum(["ACTIVE", "ARCHIVED"])
export const inviteStatusSchema = z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"])

export const recoverLocalAccountSchema = z
  .object({
    email: z.string().trim().email().max(320),
    recoveryCode: z.string().trim().regex(/^[0-9a-fA-F]{4}(?:-[0-9a-fA-F]{4}){7}$/),
    newPassword: z.string(),
  })
  .strict()
  .superRefine((value, context) => {
    const passwordLength = [...value.newPassword].length
    if (passwordLength < 15 || passwordLength > 128) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Password must be between 15 and 128 characters",
      })
    }
  })

export const workspaceSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/)

export const workspaceBootstrapQuerySchema = z.object({
  workspaceSlug: workspaceSlugSchema.optional(),
})

export const workspaceQuerySchema = z.object({
  workspaceId: z.string().min(1),
})

export const workspaceExportQuerySchema = workspaceQuerySchema.extend({
  userId: z.string().min(1).optional(),
})

export const projectListQuerySchema = workspaceQuerySchema.extend({
  status: projectStatusSchema.optional(),
})

export const workItemListQuerySchema = workspaceQuerySchema.extend({
  projectId: z.string().min(1).optional(),
  status: workItemStatusSchema.optional(),
  assigneeId: z.string().min(1).optional(),
  isInbox: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
})

export const noteListQuerySchema = workspaceQuerySchema.extend({
  projectId: z.string().min(1).optional(),
  pinned: z.enum(["true", "false"]).optional(),
})

export const projectDocListQuerySchema = workspaceQuerySchema.extend({
  projectId: z.string().min(1).optional(),
  status: projectDocStatusSchema.default("ACTIVE"),
})

export const workspaceUserQuerySchema = workspaceQuerySchema.extend({
  userId: z.string().min(1),
})

export const workspaceMemberQuerySchema = workspaceQuerySchema.extend({
  memberUserId: z.string().min(1).optional(),
})

export const workspaceInviteListQuerySchema = workspaceQuerySchema.extend({
  status: inviteStatusSchema.optional(),
})

export const workspaceInviteAnalyticsQuerySchema = workspaceQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

export const attachmentListQuerySchema = workspaceQuerySchema.extend({
  workItemId: z.string().min(1).optional(),
  noteId: z.string().min(1).optional(),
})

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
] as const

export function isAllowedAttachmentMimeType(value: string) {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value)
}

const attachmentMimeTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(isAllowedAttachmentMimeType, "Unsupported attachment MIME type")

export const createAttachmentSchema = z.object({
  reservationId: z.string().uuid(),
  workspaceId: z.string().min(1),
  workItemId: z.string().min(1).optional(),
  noteId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(240),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: attachmentMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

export const createAttachmentUploadUrlSchema = z.object({
  workspaceId: z.string().min(1),
  workItemId: z.string().min(1).optional(),
  noteId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(240),
  mimeType: attachmentMimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
})

export const updateAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined, "Attachment name is required")

export const searchQuerySchema = workspaceQuerySchema.extend({
  q: z.string().trim().min(1).max(120),
  projectId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
})

export const workItemRelationTypeSchema = z.enum([
  "BLOCKS",
  "BLOCKED_BY",
  "RELATES_TO",
  "DUPLICATES",
  "PARENT_OF",
  "CHILD_OF",
])

export const workItemRelationListQuerySchema = workspaceQuerySchema.extend({
  sourceId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  relationType: workItemRelationTypeSchema.optional(),
})

export const createWorkItemRelationSchema = z.object({
  workspaceId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relationType: workItemRelationTypeSchema,
})

export const createWorkspaceMemberSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120).optional(),
  role: genericWorkspaceRoleSchema.default("MEMBER"),
})

export const createWorkspaceInviteSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email(),
  role: genericWorkspaceRoleSchema.default("MEMBER"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  customMessage: z.string().trim().min(1).max(1200).optional(),
  templateKey: z.string().trim().min(1).max(64).optional(),
  subjectTemplateOverride: z.string().trim().min(1).max(240).optional(),
  bodyTemplateOverride: z.string().trim().min(1).max(6000).optional(),
})

export const workspaceInviteTemplateSchema = z.object({
  key: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  subjectTemplate: z.string().trim().min(1).max(240),
  bodyTemplate: z.string().trim().min(1).max(6000),
})

const workspaceInviteEntrySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email(),
  role: genericWorkspaceRoleSchema.optional(),
})

export const createWorkspaceInviteBatchSchema = z.object({
  workspaceId: z.string().min(1),
  invites: z.array(workspaceInviteEntrySchema).min(1).max(50),
  customMessage: z.string().trim().min(1).max(1200).optional(),
  templateKey: z.string().trim().min(1).max(64).optional(),
  subjectTemplateOverride: z.string().trim().min(1).max(240).optional(),
  bodyTemplateOverride: z.string().trim().min(1).max(6000).optional(),
})

export const createWorkspaceInviteRequestSchema = z.union([
  createWorkspaceInviteSchema,
  createWorkspaceInviteBatchSchema,
])

export const onboardingWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
})

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    slug: workspaceSlugSchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.slug !== undefined, "Workspace update requires a name or slug")

export const updateWorkspaceInviteSchema = z.object({
  workspaceId: z.string().min(1),
  action: z.enum(["revoke", "resend"]),
  name: z.string().trim().min(1).max(120).optional(),
  role: genericWorkspaceRoleSchema.optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  customMessage: z.string().trim().min(1).max(1200).optional(),
  templateKey: z.string().trim().min(1).max(64).optional(),
})

export const sendWorkspaceInviteTestEmailSchema = z.object({
  workspaceId: z.string().min(1),
  templateKey: z.string().trim().min(1).max(64).optional(),
  role: genericWorkspaceRoleSchema.optional(),
  toEmail: z.string().trim().email().optional(),
  customMessage: z.string().trim().min(1).max(1200).optional(),
  subjectTemplateOverride: z.string().trim().min(1).max(240).optional(),
  bodyTemplateOverride: z.string().trim().min(1).max(6000).optional(),
})

const workspaceRoleForInviterSchema = z.enum(["OWNER", "ADMIN", "MEMBER"])

export const updateWorkspaceInvitePolicySchema = z.object({
  workspaceId: z.string().min(1),
  minimumInviterRole: workspaceRoleForInviterSchema.optional(),
  allowExternalDomains: z.boolean().optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  blockedDomains: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  defaultInviteRole: genericWorkspaceRoleSchema.optional(),
  inviteExpiryDays: z.number().int().min(1).max(30).optional(),
  emailSubjectTemplate: z.string().trim().min(1).max(240).optional(),
  emailBodyTemplate: z.string().trim().min(1).max(6000).optional(),
  templateCatalog: z.array(workspaceInviteTemplateSchema).max(25).optional(),
})

export const acceptWorkspaceInviteSchema = z.object({
  token: z.string().trim().min(20).max(256),
  confirmed: z.literal(true),
})

export const previewWorkspaceInviteSchema = z.object({
  token: z.string().trim().min(20).max(256),
})

export const updateWorkspaceMemberSchema = z.object({
  workspaceId: z.string().min(1),
  role: genericWorkspaceRoleSchema,
})

export const createLabelSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(64),
  color: z.string().trim().max(32).optional(),
})

export const updateLabelSchema = createLabelSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
})

const projectFieldsSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  slug: workspaceSlugSchema,
  description: z.string().trim().max(1000).optional(),
  status: projectStatusSchema,
  mode: projectModeSchema,
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  color: z.string().trim().max(32).optional(),
  icon: z.enum(["folder", "rocket", "megaphone", "code", "palette", "book-open", "calendar", "target", "briefcase", "shopping-bag", "heart-pulse", "graduation-cap", "home", "plane"]).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
})

function validateProjectDates(data: { startDate?: string | null; dueDate?: string | null }, context: z.RefinementCtx) {
  if (data.startDate && data.dueDate && data.startDate > data.dueDate) {
    context.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date must be on or after the start date' })
  }
}

export const createProjectSchema = projectFieldsSchema.extend({
  status: projectStatusSchema.default("ACTIVE"),
  mode: projectModeSchema.default("STANDARD"),
}).superRefine(validateProjectDates)

export const updateProjectSchema = projectFieldsSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
  workspaceId: z.string().min(1).optional(),
  slug: workspaceSlugSchema.optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
}).superRefine(validateProjectDates)

const entityDeletePreconditionSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
}).strict()

export const deleteProjectSchema = entityDeletePreconditionSchema

const workItemBaseSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  status: workItemStatusSchema,
  priority: workItemPrioritySchema,
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  labelIds: z.array(z.string().min(1).max(128)).max(100).optional(),
  noteIds: z.array(z.string().min(1).max(128)).max(100).optional(),
  checklist: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        text: z.string().min(1).max(500),
        done: z.boolean(),
      })
    )
    .max(100)
    .optional(),
})

export const createWorkItemSchema = workItemBaseSchema.extend({
  status: workItemStatusSchema.default("BACKLOG"),
  priority: workItemPrioritySchema.default("MEDIUM"),
  isInbox: z.boolean().default(false),
})

const workItemLaneVersionsSchema = z.object({
  BACKLOG: z.number().int().nonnegative().optional(),
  TODO: z.number().int().nonnegative().optional(),
  IN_PROGRESS: z.number().int().nonnegative().optional(),
  IN_REVIEW: z.number().int().nonnegative().optional(),
  DONE: z.number().int().nonnegative().optional(),
}).strict()

export const updateWorkItemSchema = workItemBaseSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
  expectedLaneVersions: workItemLaneVersionsSchema.optional(),
  workspaceId: z.string().min(1).optional(),
  projectId: z.string().min(1).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  beforeId: z.string().min(1).nullable().optional(),
})

export const deleteWorkItemSchema = entityDeletePreconditionSchema.extend({
  expectedLaneVersions: workItemLaneVersionsSchema.optional(),
})

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

const noteFieldsSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(20000).optional(),
  visibility: noteVisibilitySchema,
  pinned: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(32)).max(50),
})

export const createNoteSchema = noteFieldsSchema.extend({
  visibility: noteVisibilitySchema.default("PRIVATE"),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
})

export const updateNoteSchema = noteFieldsSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
  workspaceId: z.string().min(1).optional(),
  projectId: z.string().min(1).nullable().optional(),
})

export const deleteNoteSchema = entityDeletePreconditionSchema

export const createProjectDocSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(50000).optional(),
})

export const updateProjectDocSchema = createProjectDocSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
  projectId: z.string().min(1).nullable().optional(),
})

export const createSavedViewSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  layout: z.enum(["list", "board", "kanban", "calendar", "map", "timeline", "overview", "table"]),
  groupBy: z.string().trim().max(64).optional(),
  orderBy: z.string().trim().max(64).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().default(false),
})

export const updateSavedViewSchema = createSavedViewSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
})

export const updateUserSettingsSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  theme: z.enum(["system", "light", "dark"]).optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
  accent: z.string().trim().max(32).optional(),
  priorityDisplay: z.enum(["icon", "text"]).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  hideHomeCompleted: z.boolean().optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
  taskPriorityDisplayStyle: priorityDisplayStyleSchema.optional(),
})

export const IMPORT_LIMITS = {
  bodyBytes: 8 * 1024 * 1024,
  projects: 250,
  workItems: 1_000,
  notes: 500,
  projectDocs: 300,
  savedViews: 200,
  total: 1_500,
  relationshipsPerWorkItem: 100,
} as const

const localIdSchema = z.string().trim().min(1).max(128)
const localFeatureFlagsSchema = z
  .record(z.string().trim().min(1).max(64), z.boolean())
  .refine((value) => Object.keys(value).length <= 50, "At most 50 feature flags are allowed")

const localProjectSchema = z.object({
  id: localIdSchema,
  name: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(32),
  mode: z.string().trim().max(32).optional(),
  featureFlags: localFeatureFlagsSchema.optional(),
  due: z.string().trim().max(64).optional(),
  accent: z.string().trim().max(32).optional(),
})

const localWorkItemSchema = z.object({
  id: localIdSchema,
  title: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1).max(32),
  priority: z.string().trim().min(1).max(32),
  assignee: localIdSchema.optional(),
  due: z.string().trim().max(64).optional(),
  start: z.string().trim().max(64).optional(),
  project: localIdSchema.optional(),
  parentId: localIdSchema.optional(),
  description: z.string().max(5000).optional(),
  isInbox: z.boolean().optional(),
  noteIds: z.array(localIdSchema).max(IMPORT_LIMITS.relationshipsPerWorkItem).optional(),
  checklist: z
    .array(
      z.object({
        id: localIdSchema,
        text: z.string().trim().min(1).max(500),
        done: z.boolean(),
      })
    )
    .max(IMPORT_LIMITS.relationshipsPerWorkItem)
    .optional(),
})

const localNoteSchema = z.object({
  id: localIdSchema,
  title: z.string().trim().min(1).max(180),
  tag: z.string().trim().max(32).optional(),
  excerpt: z.string().max(500).optional(),
  body: z.string().max(20000).optional(),
})

const localProjectDocSchema = z.object({
  id: localIdSchema,
  project: localIdSchema.optional(),
  title: z.string().trim().min(1).max(180),
  body: z.string().max(50000).optional(),
  status: projectDocStatusSchema.default("ACTIVE"),
  archivedAt: z.string().datetime().optional(),
})

const localSavedViewSchema = z.object({
  id: localIdSchema,
  project: localIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  layout: z.enum(["list", "board", "kanban", "calendar", "map", "timeline", "overview", "table"]),
  groupBy: z.string().trim().max(64).optional(),
  orderBy: z.string().trim().max(64).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().default(false),
})

type ImportEntityArrays = {
  projects: unknown[]
  workItems: unknown[]
  notes: unknown[]
  projectDocs: unknown[]
  savedViews: unknown[]
}

function validateImportTotal(data: ImportEntityArrays, context: z.RefinementCtx) {
  const total = data.projects.length + data.workItems.length + data.notes.length + data.projectDocs.length + data.savedViews.length
  if (total > IMPORT_LIMITS.total) {
    context.addIssue({ code: "custom", message: `Import contains more than ${IMPORT_LIMITS.total} total records` })
  }
}

export const importPreviewWorkspaceSnapshotSchema = z.object({
  version: z.number().int().positive().optional(),
  manifest: z.object({
    format: z.literal("planglade-workspace"),
    version: z.number().int().positive(),
    createdAt: z.string().max(64),
    appVersion: z.string().trim().min(1).max(64),
    capabilities: z.array(z.string().trim().min(1).max(80)).max(100),
  }).optional(),
  generatedAt: z.string().max(64).optional(),
  workspace: z
    .object({
      id: localIdSchema.optional(),
      slug: z.string().trim().max(80).optional(),
      name: z.string().trim().max(120).optional(),
    })
    .optional(),
  settings: z
    .object({
      userId: localIdSchema.optional(),
      theme: z.string().max(32).nullable().optional(),
      density: z.string().max(32).nullable().optional(),
      accent: z.string().max(32).nullable().optional(),
      notifications: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  data: z.object({
    projects: z.array(localProjectSchema).max(IMPORT_LIMITS.projects).default([]),
    workItems: z.array(localWorkItemSchema).max(IMPORT_LIMITS.workItems).default([]),
    notes: z.array(localNoteSchema).max(IMPORT_LIMITS.notes).default([]),
    projectDocs: z.array(localProjectDocSchema).max(IMPORT_LIMITS.projectDocs).default([]),
    savedViews: z.array(localSavedViewSchema).max(IMPORT_LIMITS.savedViews).default([]),
  }).superRefine(validateImportTotal),
  counts: z
    .object({
      projects: z.number().int().nonnegative().optional(),
      workItems: z.number().int().nonnegative().optional(),
      notes: z.number().int().nonnegative().optional(),
      projectDocs: z.number().int().nonnegative().optional(),
      savedViews: z.number().int().nonnegative().optional(),
    })
    .optional(),
})

export const importLocalWorkspaceSchema = z.object({
  workspaceId: localIdSchema,
  mode: z.literal("append").default("append"),
  expectedSourceChecksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  snapshot: importPreviewWorkspaceSnapshotSchema,
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateLabelInput = z.infer<typeof createLabelSchema>
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
export type CreateProjectDocInput = z.infer<typeof createProjectDocSchema>
export type UpdateProjectDocInput = z.infer<typeof updateProjectDocSchema>
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>
export type CreateAttachmentUploadUrlInput = z.infer<typeof createAttachmentUploadUrlSchema>
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>
export type CreateWorkItemRelationInput = z.infer<typeof createWorkItemRelationSchema>
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>
export type ImportLocalWorkspaceInput = z.infer<typeof importLocalWorkspaceSchema>
export type ImportPreviewWorkspaceSnapshotInput = z.infer<typeof importPreviewWorkspaceSnapshotSchema>
export type CreateWorkspaceMemberInput = z.infer<typeof createWorkspaceMemberSchema>
export type UpdateWorkspaceMemberInput = z.infer<typeof updateWorkspaceMemberSchema>
export type CreateWorkspaceInviteInput = z.infer<typeof createWorkspaceInviteSchema>
export type OnboardingWorkspaceInput = z.infer<typeof onboardingWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type UpdateWorkspaceInviteInput = z.infer<typeof updateWorkspaceInviteSchema>
export type AcceptWorkspaceInviteInput = z.infer<typeof acceptWorkspaceInviteSchema>
export type PreviewWorkspaceInviteInput = z.infer<typeof previewWorkspaceInviteSchema>
export type UpdateWorkspaceInvitePolicyInput = z.infer<typeof updateWorkspaceInvitePolicySchema>
