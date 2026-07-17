import { z } from "zod"

const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000)
const dimensionSchema = z.number().finite().positive().max(100_000)
const entityIdSchema = z.string().trim().min(1).max(128)

export const MAP_SCHEMA_VERSION = 1

export const mapStatusFilterSchema = z.enum([
  "all",
  "open",
  "completed",
  "Backlog",
  "To Do",
  "In Progress",
  "In Review",
  "Done",
])

export const mapQuerySchema = z.object({
  workspaceId: entityIdSchema,
  projectId: entityIdSchema.optional(),
})

const taskPlacementSchema = z.object({
  workItemId: entityIdSchema,
  sectionId: entityIdSchema.nullable().optional(),
  x: coordinateSchema,
  y: coordinateSchema,
})

const projectPlacementSchema = z.object({
  projectId: entityIdSchema.nullable(),
  x: coordinateSchema,
  y: coordinateSchema,
})

const sectionSchema = z.object({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(999),
  x: coordinateSchema,
  y: coordinateSchema,
  width: dimensionSchema,
  height: dimensionSchema,
  color: z.string().trim().max(40).nullable().optional(),
})

export const saveMapSharedLayoutSchema = z
  .object({
    schemaVersion: z.literal(MAP_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    taskPlacements: z.array(taskPlacementSchema).max(500).optional(),
    projectPlacements: z.array(projectPlacementSchema).max(500).optional(),
    sections: z.array(sectionSchema).max(100).optional(),
  })
  .superRefine((value, context) => {
    const uniqueGroups = [
      ["taskPlacements", value.taskPlacements?.map((placement) => placement.workItemId)],
      ["projectPlacements", value.projectPlacements?.map((placement) => placement.projectId ?? "no-project")],
      ["sections", value.sections?.map((section) => section.id)],
      ["sectionOrder", value.sections?.map((section) => String(section.sortOrder))],
    ] as const

    for (const [path, ids] of uniqueGroups) {
      if (ids && new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          message: `${path} must not contain duplicates`,
          path: [path],
        })
      }
    }
  })

export const saveMapPreferencesSchema = z
  .object({
    schemaVersion: z.literal(MAP_SCHEMA_VERSION),
    viewport: z.object({
      x: coordinateSchema,
      y: coordinateSchema,
      zoom: z.number().finite().min(0.1).max(4),
    }),
    statusFilter: mapStatusFilterSchema,
    trayOpen: z.boolean(),
    collapsedProjectIds: z.array(entityIdSchema).max(500).default([]),
    collapsedSectionIds: z.array(entityIdSchema).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (new Set(value.collapsedProjectIds).size !== value.collapsedProjectIds.length) {
      context.addIssue({
        code: "custom",
        message: "collapsedProjectIds must not contain duplicates",
        path: ["collapsedProjectIds"],
      })
    }
    if (new Set(value.collapsedSectionIds).size !== value.collapsedSectionIds.length) {
      context.addIssue({
        code: "custom",
        message: "collapsedSectionIds must not contain duplicates",
        path: ["collapsedSectionIds"],
      })
    }
  })

export type MapQuery = z.infer<typeof mapQuerySchema>
export type SaveMapSharedLayoutInput = z.infer<typeof saveMapSharedLayoutSchema>
export type SaveMapPreferencesInput = z.infer<typeof saveMapPreferencesSchema>
