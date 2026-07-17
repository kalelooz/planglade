import { demoSession, getDemoFixtures } from "@/lib/demo-data"

export function getWorkspaceBootstrap(now = new Date()) {
  const { projects, tasks, notes } = getDemoFixtures(now)

  return {
    generatedAt: now.toISOString(),
    workspace: { ...demoSession.workspace, mode: "demo" as const },
    counts: {
      projects: projects.length,
      workItems: tasks.length,
      notes: notes.length,
      activityEvents: 0,
    },
    data: {
      projects,
      workItems: tasks,
      notes,
      activity: [],
    },
  }
}
