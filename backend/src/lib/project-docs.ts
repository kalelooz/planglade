import { db } from "@/lib/db"

export async function projectBelongsToWorkspace(projectId: string, workspaceId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  })

  return project?.workspaceId === workspaceId
}
