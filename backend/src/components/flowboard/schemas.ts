import { z } from "zod"

// ── Create / Edit Task Schema ─────────────────────────────────────────────

export const taskFormSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .or(z.literal("")),
  priority: z.enum(["High", "Medium", "Low"], {
    message: "Priority is required",
  }),
  assignee: z.string().min(1, "Assignee is required"),
  dueDate: z
    .string()
    .min(1, "Due date is required")
    .refine(
      (val) => {
        const d = new Date(val)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return !isNaN(d.getTime()) && d >= today
      },
      { message: "Due date must be today or in the future" }
    ),
  tags: z.array(z.string()),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

// ── Create Project Schema ─────────────────────────────────────────────────

export const projectFormSchema = z
  .object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters")
      .max(50, "Name must be 50 characters or less"),
    description: z
      .string()
      .max(200, "Description must be 200 characters or less")
      .optional()
      .or(z.literal("")),
    color: z.string().min(1, "Color is required"),
    startDate: z.string().optional().or(z.literal("")),
    endDate: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true
      return new Date(data.endDate) > new Date(data.startDate)
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  )

export type ProjectFormValues = z.infer<typeof projectFormSchema>

// ── Create Note Schema ────────────────────────────────────────────────────

export const noteFormSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters"),
  tags: z
    .array(z.string())
    .min(1, "At least one tag is required"),
  body: z.string().optional().or(z.literal("")),
})

export type NoteFormValues = z.infer<typeof noteFormSchema>

// ── Settings General Tab Schema ────────────────────────────────────────────

export const settingsGeneralSchema = z.object({
  appName: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(30, "App name must be 30 characters or less")
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      "No special characters allowed (only letters, numbers, spaces, hyphens, underscores)"
    ),
})

export type SettingsGeneralValues = z.infer<typeof settingsGeneralSchema>
