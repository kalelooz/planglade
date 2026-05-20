import { z } from "zod"

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"])
export const projectStatusSchema = z.enum(["ACTIVE", "IN_REVIEW", "ON_HOLD", "ARCHIVED"])
export const workItemStatusSchema = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
export const workItemPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
export const noteVisibilitySchema = z.enum(["PRIVATE", "WORKSPACE"])

export const workspaceSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/)

export const workspaceBootstrapQuerySchema = z.object({
  workspaceSlug: workspaceSlugSchema.optional(),
})

export const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  slug: workspaceSlugSchema,
  description: z.string().trim().max(1000).optional(),
  status: projectStatusSchema.default("ACTIVE"),
  color: z.string().trim().max(32).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
  slug: workspaceSlugSchema.optional(),
})

export const createWorkItemSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  status: workItemStatusSchema.default("BACKLOG"),
  priority: workItemPrioritySchema.default("MEDIUM"),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  labelIds: z.array(z.string().min(1)).optional(),
})

export const updateWorkItemSchema = createWorkItemSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
  completedAt: z.string().datetime().nullable().optional(),
})

export const createNoteSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(20000).optional(),
  visibility: noteVisibilitySchema.default("PRIVATE"),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(32)).default([]),
})

export const updateNoteSchema = createNoteSchema.partial().extend({
  workspaceId: z.string().min(1).optional(),
})

export const createSavedViewSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  layout: z.enum(["list", "kanban", "calendar", "timeline", "table"]),
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
  notifications: z.record(z.string(), z.boolean()).optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>
export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>
