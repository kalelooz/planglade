import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { GET as listNotes } from "../src/app/api/notes/route"
import { GET as listProjects, POST as createProject } from "../src/app/api/projects/route"
import { GET as getAuthSession } from "../src/app/api/auth/session/route"
import { GET as listWorkItems, POST as createWorkItem } from "../src/app/api/work-items/route"
import { PATCH as updateWorkItem } from "../src/app/api/work-items/[workItemId]/route"
import { db } from "../src/lib/db"

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE,
}

const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalWorkItemFindMany = db.workItem.findMany
const originalProjectFindMany = db.project.findMany
const originalNoteFindMany = db.note.findMany
const originalTransaction = db.$transaction

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function runWithMocks(fn: () => Promise<void>) {
  restoreEnv()
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "dev"

  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-b",
    ownerId: "owner-b",
  })) as unknown) as typeof db.workspace.findUnique

  try {
    await fn()
  } finally {
    restoreEnv()
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.workItem as typeof db.workItem).findMany = originalWorkItemFindMany
    ;(db.project as typeof db.project).findMany = originalProjectFindMany
    ;(db.note as typeof db.note).findMany = originalNoteFindMany
    ;(db as unknown as { $transaction: unknown }).$transaction = originalTransaction
  }
}

function denyWorkspaceMembership() {
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async (args: unknown) => {
    const where = (args as { where?: { workspaceId_userId?: { workspaceId?: string; userId?: string } } }).where
    assert.equal(where?.workspaceId_userId?.workspaceId, "workspace-b")
    assert.equal(where?.workspaceId_userId?.userId, "user-a")
    return null
  }) as unknown) as typeof db.workspaceMember.findUnique
}

function blockTransaction() {
  ;(db as unknown as { $transaction: unknown }).$transaction = (async () => {
    throw new Error("AUTH-LOCK-1: denied requests must not write")
  }) as unknown as typeof db.$transaction
}

test("AUTH-LOCK-1: unauthenticated work-item reads are denied before loading data", async () => {
  await runWithMocks(async () => {
    let findManyCalled = false
    ;(db.workItem as typeof db.workItem).findMany = ((async () => {
      findManyCalled = true
      return []
    }) as unknown) as typeof db.workItem.findMany

    const request = new NextRequest("http://localhost/api/work-items?workspaceId=workspace-b")
    const response = await listWorkItems(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
    assert.equal(findManyCalled, false)
  })
})

test("AUTH-LOCK-1: unauthenticated project mutations are denied before writing", async () => {
  await runWithMocks(async () => {
    blockTransaction()

    const request = new NextRequest("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace-b",
        name: "Workspace B launch",
        slug: "workspace-b-launch",
      }),
    })

    const response = await createProject(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
  })
})

test("AUTH-LOCK-1: workspace A user cannot read workspace B work items, projects, or notes", async () => {
  await runWithMocks(async () => {
    denyWorkspaceMembership()

    let workItemsLoaded = false
    let projectsLoaded = false
    let notesLoaded = false
    ;(db.workItem as typeof db.workItem).findMany = ((async () => {
      workItemsLoaded = true
      return []
    }) as unknown) as typeof db.workItem.findMany
    ;(db.project as typeof db.project).findMany = ((async () => {
      projectsLoaded = true
      return []
    }) as unknown) as typeof db.project.findMany
    ;(db.note as typeof db.note).findMany = ((async () => {
      notesLoaded = true
      return []
    }) as unknown) as typeof db.note.findMany

    const headers = { "x-flowboard-user-id": "user-a" }
    const [workItemsResponse, projectsResponse, notesResponse] = await Promise.all([
      listWorkItems(new NextRequest("http://localhost/api/work-items?workspaceId=workspace-b", { headers })),
      listProjects(new NextRequest("http://localhost/api/projects?workspaceId=workspace-b", { headers })),
      listNotes(new NextRequest("http://localhost/api/notes?workspaceId=workspace-b", { headers })),
    ])

    assert.equal(workItemsResponse.status, 403)
    assert.equal(projectsResponse.status, 403)
    assert.equal(notesResponse.status, 403)
    assert.equal(workItemsLoaded, false)
    assert.equal(projectsLoaded, false)
    assert.equal(notesLoaded, false)
  })
})

test("AUTH-LOCK-1: workspace A user cannot create a task in workspace B", async () => {
  await runWithMocks(async () => {
    denyWorkspaceMembership()
    blockTransaction()

    const request = new NextRequest("http://localhost/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "user-a",
      },
      body: JSON.stringify({
        workspaceId: "workspace-b",
        title: "Cross-workspace task",
      }),
    })

    const response = await createWorkItem(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
  })
})

test("AUTH-LOCK-1: workspace A user cannot update a workspace B task", async () => {
  await runWithMocks(async () => {
    denyWorkspaceMembership()
    blockTransaction()

    const request = new NextRequest("http://localhost/api/work-items/task-b?workspaceId=workspace-b", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "user-a",
      },
      body: JSON.stringify({ title: "Cross-workspace update" }),
    })

    const response = await updateWorkItem(request, {
      params: Promise.resolve({ workItemId: "task-b" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
  })
})

test("AUTH-LOCK-1: production blocks dev auth mode", async () => {
  await runWithMocks(async () => {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.FLOWBOARD_AUTH_MODE = "dev"
    process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "dev"

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 500)
    assert.equal(payload.error, "Authentication is not available.")
  })
})
