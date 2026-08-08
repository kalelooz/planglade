import { activity, notes, projects, workItems } from "@/lib/mock-data"

export interface BootstrapWorkspaceSummary {
  id: string
  slug: string
  name: string
  mode: "starter"
}

export interface WorkspaceBootstrapPayload {
  generatedAt: string
  workspace: BootstrapWorkspaceSummary
  counts: {
    projects: number
    workItems: number
    notes: number
    activityEvents: number
  }
  data: {
    projects: typeof projects
    workItems: typeof workItems
    notes: typeof notes
    activity: typeof activity
  }
}

const DEFAULT_WORKSPACE: BootstrapWorkspaceSummary = {
  id: "ws-local-seed",
  slug: "planglade",
  name: "PlanGlade Workspace",
  mode: "starter",
}

export function getWorkspaceBootstrap(workspaceSlug?: string): WorkspaceBootstrapPayload {
  const workspace =
    workspaceSlug && workspaceSlug.trim().length > 0
      ? { ...DEFAULT_WORKSPACE, slug: workspaceSlug.trim() }
      : DEFAULT_WORKSPACE

  return {
    generatedAt: new Date().toISOString(),
    workspace,
    counts: {
      projects: projects.length,
      workItems: workItems.length,
      notes: notes.length,
      activityEvents: activity.reduce((count, day) => count + day.items.length, 0),
    },
    data: {
      projects,
      workItems,
      notes,
      activity,
    },
  }
}
