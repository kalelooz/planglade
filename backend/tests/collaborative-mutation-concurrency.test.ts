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

function postRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function emptyDeleteRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "DELETE" })
}

function assertSafeUpdateDeleteRace(responses: Response[]) {
  const statuses = responses.map((response) => response.status)
  assert.equal(statuses.filter((status) => status === 200).length, 1)
  assert.ok(statuses.some((status) => status === 409 || status === 404), `unexpected statuses: ${statuses.join(",")}`)
}

test("two clients cannot silently overwrite task, project, note, or lane updates", async () => {
  const isolated = createIsolatedTestDatabase()
  const previousAuthMode = process.env.PLANGLADE_AUTH_MODE
  const previousPublicAuthMode = process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

  const { db } = await import("../src/lib/db")
  const { DELETE: deleteProject, PATCH: updateProject } = await import("../src/app/api/projects/[projectId]/route")
  const { DELETE: deleteNote, PATCH: updateNote } = await import("../src/app/api/notes/[noteId]/route")
  const { DELETE: deleteWorkItem, PATCH: updateWorkItem } = await import("../src/app/api/work-items/[workItemId]/route")
  const { POST: createWorkItem } = await import("../src/app/api/work-items/route")

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
    const deleteProjectCandidate = await db.project.create({
      data: {
        id: "project-delete",
        workspaceId: "workspace-1",
        name: "Project delete candidate",
        slug: "project-delete-candidate",
        createdById: user.id,
      },
    })
    const deleteNoteCandidate = await db.note.create({
      data: {
        id: "note-delete",
        workspaceId: "workspace-1",
        title: "Note delete candidate",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    const linkedNote = await db.note.create({
      data: {
        id: "note-linked-delete",
        workspaceId: "workspace-1",
        title: "Linked note delete candidate",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    await db.workItem.createMany({
      data: [
        {
          id: "task-linked-note-a",
          workspaceId: "workspace-1",
          title: "First linked task",
          noteIds: [linkedNote.id, note.id],
          createdById: user.id,
        },
        {
          id: "task-linked-note-b",
          workspaceId: "workspace-1",
          title: "Second linked task",
          noteIds: [linkedNote.id],
          createdById: user.id,
        },
      ],
    })
    const racingNote = await db.note.create({
      data: {
        id: "note-link-race",
        workspaceId: "workspace-1",
        title: "Racing note reference",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    const racingTask = await db.workItem.create({
      data: {
        id: "task-note-link-race",
        workspaceId: "workspace-1",
        title: "Racing note task",
        noteIds: [],
        createdById: user.id,
      },
    })
    const racingCreateNote = await db.note.create({
      data: {
        id: "note-create-link-race",
        workspaceId: "workspace-1",
        title: "Racing create reference",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    const bulkLinkedNote = await db.note.create({
      data: {
        id: "note-bulk-linked-delete",
        workspaceId: "workspace-1",
        title: "Bulk-linked note",
        createdById: user.id,
        updatedById: user.id,
        visibility: "WORKSPACE",
      },
    })
    await db.workItem.createMany({
      data: Array.from({ length: 501 }, (_, index) => ({
        id: `task-bulk-linked-${String(index).padStart(3, "0")}`,
        workspaceId: "workspace-1",
        title: `Bulk-linked task ${index}`,
        noteIds: [bulkLinkedNote.id],
        createdById: user.id,
      })),
    })
    const deleteTaskCandidate = await db.workItem.create({
      data: {
        id: "task-delete",
        workspaceId: "workspace-1",
        title: "Task delete candidate",
        status: "BACKLOG",
        position: 1024,
        createdById: user.id,
      },
    })
    const staleLaneTask = await db.workItem.create({
      data: {
        id: "task-stale-lane",
        workspaceId: "workspace-1",
        title: "Task moved elsewhere",
        status: "BACKLOG",
        position: 2048,
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

    const missingDeletePreconditions = await Promise.all([
      deleteProject(emptyDeleteRequest("/api/projects/project-delete?workspaceId=workspace-1"), { params: Promise.resolve({ projectId: deleteProjectCandidate.id }) }),
      deleteNote(emptyDeleteRequest("/api/notes/note-delete?workspaceId=workspace-1"), { params: Promise.resolve({ noteId: deleteNoteCandidate.id }) }),
      deleteWorkItem(emptyDeleteRequest("/api/work-items/task-delete?workspaceId=workspace-1"), { params: Promise.resolve({ workItemId: deleteTaskCandidate.id }) }),
    ])
    assert.deepEqual(missingDeletePreconditions.map((response) => response.status), [428, 428, 428])

    await db.workItem.update({
      where: { id: staleLaneTask.id },
      data: {
        status: "DONE",
        updatedAt: new Date(staleLaneTask.updatedAt.getTime() + 1_000),
      },
    })
    const staleCrossLaneResponses = await Promise.all([
      updateWorkItem(patchRequest("/api/work-items/task-stale-lane?workspaceId=workspace-1", {
        status: "IN_PROGRESS",
        expectedUpdatedAt: staleLaneTask.updatedAt.toISOString(),
        expectedLaneVersions: { BACKLOG: 0, IN_PROGRESS: 0 },
      }), { params: Promise.resolve({ workItemId: staleLaneTask.id }) }),
      deleteWorkItem(deleteRequest("/api/work-items/task-stale-lane?workspaceId=workspace-1", {
        expectedUpdatedAt: staleLaneTask.updatedAt.toISOString(),
        expectedLaneVersions: { BACKLOG: 0 },
      }), { params: Promise.resolve({ workItemId: staleLaneTask.id }) }),
    ])
    assert.deepEqual(staleCrossLaneResponses.map((response) => response.status), [409, 409])
    for (const response of staleCrossLaneResponses) {
      const conflict = await response.json()
      assert.equal(conflict.current.id, staleLaneTask.id)
      assert.equal(conflict.current.status, "DONE")
    }

    const linkedDeleteResponse = await deleteNote(deleteRequest(
      "/api/notes/note-linked-delete?workspaceId=workspace-1",
      { expectedUpdatedAt: linkedNote.updatedAt.toISOString() },
    ), { params: Promise.resolve({ noteId: linkedNote.id }) })
    assert.equal(linkedDeleteResponse.status, 200)
    const linkedTasks = await db.workItem.findMany({
      where: { id: { in: ["task-linked-note-a", "task-linked-note-b"] } },
      orderBy: { id: "asc" },
      select: { noteIds: true },
    })
    assert.deepEqual(linkedTasks.map((item) => item.noteIds), [[note.id], []])

    const bulkDeleteResponse = await deleteNote(deleteRequest(
      "/api/notes/note-bulk-linked-delete?workspaceId=workspace-1",
      { expectedUpdatedAt: bulkLinkedNote.updatedAt.toISOString() },
    ), { params: Promise.resolve({ noteId: bulkLinkedNote.id }) })
    assert.equal(bulkDeleteResponse.status, 200)
    const bulkLinkedTasks = await db.workItem.findMany({
      where: { id: { startsWith: "task-bulk-linked-" } },
      select: { noteIds: true },
    })
    assert.equal(bulkLinkedTasks.length, 501)
    assert.equal(bulkLinkedTasks.every((item) => Array.isArray(item.noteIds) && item.noteIds.length === 0), true)

    const noteReferenceRace = await Promise.all([
      updateWorkItem(patchRequest("/api/work-items/task-note-link-race?workspaceId=workspace-1", {
        noteIds: [racingNote.id],
        expectedUpdatedAt: racingTask.updatedAt.toISOString(),
      }), { params: Promise.resolve({ workItemId: racingTask.id }) }),
      deleteNote(deleteRequest("/api/notes/note-link-race?workspaceId=workspace-1", {
        expectedUpdatedAt: racingNote.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: racingNote.id }) }),
    ])
    assert.equal(noteReferenceRace[1].status, 200)
    assert.ok(
      [200, 400, 409].includes(noteReferenceRace[0].status),
      `unexpected note-link response: ${noteReferenceRace[0].status}`,
    )
    assert.equal(await db.note.findUnique({ where: { id: racingNote.id } }), null)
    const reloadedRacingTask = await db.workItem.findUniqueOrThrow({ where: { id: racingTask.id } })
    assert.equal(Array.isArray(reloadedRacingTask.noteIds) && reloadedRacingTask.noteIds.includes(racingNote.id), false)

    const noteCreateReferenceRace = await Promise.all([
      createWorkItem(postRequest("/api/work-items", {
        workspaceId: "workspace-1",
        title: "Task racing note creation",
        noteIds: [racingCreateNote.id],
      })),
      deleteNote(deleteRequest("/api/notes/note-create-link-race?workspaceId=workspace-1", {
        expectedUpdatedAt: racingCreateNote.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: racingCreateNote.id }) }),
    ])
    assert.equal(noteCreateReferenceRace[1].status, 200)
    assert.ok(
      [201, 400].includes(noteCreateReferenceRace[0].status),
      `unexpected note-create response: ${noteCreateReferenceRace[0].status}`,
    )
    const createdRacingTask = await db.workItem.findFirst({ where: { title: "Task racing note creation" } })
    assert.equal(
      Array.isArray(createdRacingTask?.noteIds) && createdRacingTask.noteIds.includes(racingCreateNote.id),
      false,
    )

    const projectDeleteRace = await Promise.all([
      updateProject(patchRequest("/api/projects/project-delete?workspaceId=workspace-1", {
        name: "Project updated before delete",
        expectedUpdatedAt: deleteProjectCandidate.updatedAt.toISOString(),
      }), { params: Promise.resolve({ projectId: deleteProjectCandidate.id }) }),
      deleteProject(deleteRequest("/api/projects/project-delete?workspaceId=workspace-1", {
        expectedUpdatedAt: deleteProjectCandidate.updatedAt.toISOString(),
      }), { params: Promise.resolve({ projectId: deleteProjectCandidate.id }) }),
    ])
    assertSafeUpdateDeleteRace(projectDeleteRace)
    const remainingProject = await db.project.findUnique({ where: { id: deleteProjectCandidate.id } })
    if (remainingProject) assert.equal(remainingProject.name, "Project updated before delete")

    const noteDeleteRace = await Promise.all([
      updateNote(patchRequest("/api/notes/note-delete?workspaceId=workspace-1", {
        title: "Note updated before delete",
        expectedUpdatedAt: deleteNoteCandidate.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: deleteNoteCandidate.id }) }),
      deleteNote(deleteRequest("/api/notes/note-delete?workspaceId=workspace-1", {
        expectedUpdatedAt: deleteNoteCandidate.updatedAt.toISOString(),
      }), { params: Promise.resolve({ noteId: deleteNoteCandidate.id }) }),
    ])
    assertSafeUpdateDeleteRace(noteDeleteRace)
    const remainingNote = await db.note.findUnique({ where: { id: deleteNoteCandidate.id } })
    if (remainingNote) assert.equal(remainingNote.title, "Note updated before delete")

    const taskDeleteRace = await Promise.all([
      updateWorkItem(patchRequest("/api/work-items/task-delete?workspaceId=workspace-1", {
        title: "Task updated before delete",
        expectedUpdatedAt: deleteTaskCandidate.updatedAt.toISOString(),
      }), { params: Promise.resolve({ workItemId: deleteTaskCandidate.id }) }),
      deleteWorkItem(deleteRequest("/api/work-items/task-delete?workspaceId=workspace-1", {
        expectedUpdatedAt: deleteTaskCandidate.updatedAt.toISOString(),
        expectedLaneVersions: { BACKLOG: 0 },
      }), { params: Promise.resolve({ workItemId: deleteTaskCandidate.id }) }),
    ])
    assertSafeUpdateDeleteRace(taskDeleteRace)
    const remainingTask = await db.workItem.findUnique({ where: { id: deleteTaskCandidate.id } })
    if (remainingTask) assert.equal(remainingTask.title, "Task updated before delete")

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
