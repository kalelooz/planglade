import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const DEV_EMAIL = "alex.morgan@planglade.dev"

function patchRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("two clients cannot silently overwrite task, project, note, or lane updates", async () => {
  const isolated = createIsolatedTestDatabase()
  const previousAuthMode = process.env.PLANGLADE_AUTH_MODE
  const previousPublicAuthMode = process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

  const { db } = await import("../src/lib/db")
  const { PATCH: updateProject } = await import("../src/app/api/projects/[projectId]/route")
  const { PATCH: updateNote } = await import("../src/app/api/notes/[noteId]/route")
  const { PATCH: updateWorkItem } = await import("../src/app/api/work-items/[workItemId]/route")

  try {
    const user = await db.user.create({
      data: { id: "user-1", email: DEV_EMAIL, normalizedEmail: DEV_EMAIL, name: "Alex Morgan" },
    })
    await db.workspace.create({
      data: {
        id: "workspace-1",
        slug: "workspace-1",
        name: "Workspace",
        ownerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    })
    const project = await db.project.create({
      data: {
        id: "project-1",
        workspaceId: "workspace-1",
        name: "Original project",
        slug: "original-project",
        createdById: user.id,
      },
    })
    const note = await db.note.create({
      data: {
        id: "note-1",
        workspaceId: "workspace-1",
        title: "Original note",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    const firstTask = await db.workItem.create({
      data: {
        id: "task-1",
        workspaceId: "workspace-1",
        title: "Original task",
        status: "TODO",
        position: 1024,
        createdById: user.id,
      },
    })
    const secondTask = await db.workItem.create({
      data: {
        id: "task-2",
        workspaceId: "workspace-1",
        title: "Second task",
        status: "TODO",
        position: 2048,
        createdById: user.id,
      },
    })
    const thirdTask = await db.workItem.create({
      data: {
        id: "task-3",
        workspaceId: "workspace-1",
        title: "Third task",
        status: "TODO",
        position: 3072,
        createdById: user.id,
      },
    })

    const missingProjectPrecondition = await updateProject(
      patchRequest("/api/projects/project-1?workspaceId=workspace-1", { name: "Unconditional project" }),
      { params: Promise.resolve({ projectId: project.id }) },
    )
    assert.equal(missingProjectPrecondition.status, 428)
    assert.equal((await missingProjectPrecondition.json()).current.id, project.id)
    const missingNotePrecondition = await updateNote(
      patchRequest("/api/notes/note-1?workspaceId=workspace-1", { title: "Unconditional note" }),
      { params: Promise.resolve({ noteId: note.id }) },
    )
    assert.equal(missingNotePrecondition.status, 428)
    assert.equal((await missingNotePrecondition.json()).current.id, note.id)

    const projectResponses = await Promise.all([
      updateProject(patchRequest("/api/projects/project-1?workspaceId=workspace-1", {
        name: "Project from client A",
        expectedUpdatedAt: project.updatedAt.toISOString(),
      }), { params: Promise.resolve({ projectId: project.id }) }),
      updateProject(patchRequest("/api/projects/project-1?workspaceId=workspace-1", {
        name: "Project from client B",
        expectedUpdatedAt: project.updatedAt.toISOString(),
      }), { params: Promise.resolve({ projectId: project.id }) }),
    ])
    assert.deepEqual(projectResponses.map((response) => response.status).sort(), [200, 409])
    const projectConflict = projectResponses.find((response) => response.status === 409)
    assert.equal((await projectConflict!.json()).current.id, project.id)
    assert.match((await db.project.findUniqueOrThrow({ where: { id: project.id } })).name, /^Project from client [AB]$/)

    const noteResponses = await Promise.all([
      updateNote(patchRequest("/api/notes/note-1?workspaceId=workspace-1", {
        title: "Note from client A",
        expectedUpdatedAt: note.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: note.id }) }),
      updateNote(patchRequest("/api/notes/note-1?workspaceId=workspace-1", {
        title: "Note from client B",
        expectedUpdatedAt: note.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: note.id }) }),
    ])
    assert.deepEqual(noteResponses.map((response) => response.status).sort(), [200, 409])
    const noteConflict = noteResponses.find((response) => response.status === 409)
    assert.equal((await noteConflict!.json()).current.id, note.id)
    assert.match((await db.note.findUniqueOrThrow({ where: { id: note.id } })).title, /^Note from client [AB]$/)

    const taskResponses = await Promise.all([
      updateWorkItem(patchRequest("/api/work-items/task-1?workspaceId=workspace-1", {
        title: "Task from client A",
        expectedUpdatedAt: firstTask.updatedAt.toISOString(),
      }), { params: Promise.resolve({ workItemId: firstTask.id }) }),
      updateWorkItem(patchRequest("/api/work-items/task-1?workspaceId=workspace-1", {
        title: "Task from client B",
        expectedUpdatedAt: firstTask.updatedAt.toISOString(),
      }), { params: Promise.resolve({ workItemId: firstTask.id }) }),
    ])
    assert.deepEqual(taskResponses.map((response) => response.status).sort(), [200, 409])
    const taskConflict = taskResponses.find((response) => response.status === 409)
    assert.equal((await taskConflict!.json()).current.id, firstTask.id)
    assert.match((await db.workItem.findUniqueOrThrow({ where: { id: firstTask.id } })).title, /^Task from client [AB]$/)

    const currentFirst = await db.workItem.findUniqueOrThrow({ where: { id: firstTask.id } })
    const currentThird = await db.workItem.findUniqueOrThrow({ where: { id: thirdTask.id } })
    const laneResponses = await Promise.all([
      updateWorkItem(patchRequest("/api/work-items/task-1?workspaceId=workspace-1", {
        beforeId: thirdTask.id,
        expectedUpdatedAt: currentFirst.updatedAt.toISOString(),
        expectedLaneVersions: { TODO: 0 },
      }), { params: Promise.resolve({ workItemId: firstTask.id }) }),
      updateWorkItem(patchRequest("/api/work-items/task-3?workspaceId=workspace-1", {
        beforeId: firstTask.id,
        expectedUpdatedAt: currentThird.updatedAt.toISOString(),
        expectedLaneVersions: { TODO: 0 },
      }), { params: Promise.resolve({ workItemId: thirdTask.id }) }),
    ])
    const lanePayloads = await Promise.all(laneResponses.map((response) => response.clone().json()))
    assert.deepEqual(
      laneResponses.map((response) => response.status).sort(),
      [200, 409],
      JSON.stringify(lanePayloads),
    )
    assert.equal((await db.workItemLaneVersion.findUniqueOrThrow({
      where: { workspaceId_status: { workspaceId: "workspace-1", status: "TODO" } },
    })).version, 1)
    const reloadedOrder = (await db.workItem.findMany({
      where: { workspaceId: "workspace-1", status: "TODO", isInbox: false },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })).map((item) => item.id)
    assert.ok(
      JSON.stringify(reloadedOrder) === JSON.stringify(["task-2", "task-1", "task-3"])
      || JSON.stringify(reloadedOrder) === JSON.stringify(["task-3", "task-1", "task-2"]),
      `unexpected persisted order: ${reloadedOrder.join(",")}`,
    )
  } finally {
    await db.$disconnect()
    if (previousAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
    else process.env.PLANGLADE_AUTH_MODE = previousAuthMode
    if (previousPublicAuthMode === undefined) delete process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
    else process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = previousPublicAuthMode
    await isolated.cleanup()
  }
})
