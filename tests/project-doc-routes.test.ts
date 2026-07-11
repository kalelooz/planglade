import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { GET as getProjectDoc, PATCH as patchProjectDoc, DELETE as deleteProjectDoc } from "../src/app/api/project-docs/[docId]/route"
import { POST as archiveProjectDoc } from "../src/app/api/project-docs/[docId]/archive/route"
import { GET as listProjectDocs, POST as createProjectDoc } from "../src/app/api/project-docs/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalProjectFindUnique = db.project.findUnique
const originalProjectDocFindMany = db.projectDoc.findMany
const originalProjectDocFindFirst = db.projectDoc.findFirst
const originalProjectDocFindUnique = db.projectDoc.findUnique
const originalTransaction = db.$transaction

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.project as typeof db.project).findUnique = originalProjectFindUnique
    ;(db.projectDoc as typeof db.projectDoc).findMany = originalProjectDocFindMany
    ;(db.projectDoc as typeof db.projectDoc).findFirst = originalProjectDocFindFirst
    ;(db.projectDoc as typeof db.projectDoc).findUnique = originalProjectDocFindUnique
    ;(db as unknown as { $transaction: unknown }).$transaction = originalTransaction
  }
}

function mockWorkspaceAccess(role: Role) {
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "ws-1",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique

  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "actor-1",
    role,
  })) as unknown) as typeof db.workspaceMember.findUnique
}

function mockTransaction(tx: unknown) {
  ;(db as unknown as { $transaction: unknown }).$transaction = (async <T>(
    fn: (transactionClient: unknown) => Promise<T>
  ) => fn(tx)) as typeof db.$transaction
}

test("GET /project-docs rejects unauthenticated requests", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    let findManyCalled = false
    ;(db.projectDoc as typeof db.projectDoc).findMany = ((async () => {
      findManyCalled = true
      return []
    }) as unknown) as typeof db.projectDoc.findMany

    const request = new NextRequest("http://localhost/api/project-docs?workspaceId=ws-1")
    const response = await listProjectDocs(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Authentication required")
    assert.equal(findManyCalled, false)
  })
})

test("GET /project-docs lists active docs in the current workspace by default", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("VIEWER")

    let receivedWhere: unknown
    ;(db.projectDoc as typeof db.projectDoc).findMany = ((async (args: unknown) => {
      receivedWhere = (args as { where: unknown }).where
      return [{ id: "doc-1", workspaceId: "ws-1", title: "Runbook", status: "ACTIVE" }]
    }) as unknown) as typeof db.projectDoc.findMany

    const request = new NextRequest("http://localhost/api/project-docs?workspaceId=ws-1", {
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await listProjectDocs(request)
    const payload = (await response.json()) as { docs?: Array<{ id: string }> }

    assert.equal(response.status, 200)
    assert.deepEqual(receivedWhere, { workspaceId: "ws-1", status: "ACTIVE" })
    assert.equal(payload.docs?.[0]?.id, "doc-1")
  })
})

test("POST /project-docs validates input before writing", async () => {
  await runWithMocks(async () => {
    let transactionCalled = false
    mockTransaction({})
    ;(db as unknown as { $transaction: unknown }).$transaction = (async () => {
      transactionCalled = true
    }) as unknown as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/project-docs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({ workspaceId: "ws-1", title: "" }),
    })

    const response = await createProjectDoc(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 400)
    assert.equal(payload.error, "Request body validation failed")
    assert.equal(transactionCalled, false)
  })
})

test("POST /project-docs rejects a project from another workspace", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    ;(db.project as typeof db.project).findUnique = ((async () => ({
      workspaceId: "ws-2",
    })) as unknown) as typeof db.project.findUnique

    let transactionCalled = false
    mockTransaction({})
    ;(db as unknown as { $transaction: unknown }).$transaction = (async () => {
      transactionCalled = true
    }) as unknown as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/project-docs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({ workspaceId: "ws-1", projectId: "project-2", title: "Runbook" }),
    })

    const response = await createProjectDoc(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 404)
    assert.equal(payload.error, "Project not found in workspace")
    assert.equal(transactionCalled, false)
  })
})

test("GET /project-docs/:docId does not return a cross-workspace doc", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("VIEWER")
    ;(db.projectDoc as typeof db.projectDoc).findFirst = ((async () => null) as unknown) as typeof db.projectDoc.findFirst

    const request = new NextRequest("http://localhost/api/project-docs/doc-2?workspaceId=ws-1", {
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await getProjectDoc(request, {
      params: Promise.resolve({ docId: "doc-2" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 404)
    assert.equal(payload.error, "Project doc not found")
  })
})

test("PATCH /project-docs/:docId updates only allowed fields", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    ;(db.projectDoc as typeof db.projectDoc).findUnique = ((async () => ({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Old title",
    })) as unknown) as typeof db.projectDoc.findUnique
    ;(db.project as typeof db.project).findUnique = ((async () => ({
      workspaceId: "ws-1",
    })) as unknown) as typeof db.project.findUnique

    let updateData: unknown
    mockTransaction({
      projectDoc: {
        update: async (args: unknown) => {
          updateData = (args as { data: unknown }).data
          return { id: "doc-1", title: "New title", projectId: "project-1" }
        },
      },
      activityEvent: { create: async () => ({}) },
    })

    const request = new NextRequest("http://localhost/api/project-docs/doc-1?workspaceId=ws-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-2",
        projectId: "project-1",
        title: "New title",
        status: "ARCHIVED",
      }),
    })

    const response = await patchProjectDoc(request, {
      params: Promise.resolve({ docId: "doc-1" }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(updateData, {
      projectId: "project-1",
      title: "New title",
      updatedById: "actor-1",
    })
  })
})

test("POST /project-docs/:docId/archive soft archives the owned doc", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    ;(db.projectDoc as typeof db.projectDoc).findUnique = ((async () => ({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Runbook",
      status: "ACTIVE",
      archivedAt: null,
    })) as unknown) as typeof db.projectDoc.findUnique

    let updateData: { status?: string; archivedAt?: Date; updatedById?: string } | undefined
    mockTransaction({
      projectDoc: {
        update: async (args: unknown) => {
          updateData = (args as { data: typeof updateData }).data
          return { id: "doc-1", status: "ARCHIVED", archivedAt: updateData?.archivedAt }
        },
      },
      activityEvent: { create: async () => ({}) },
    })

    const request = new NextRequest("http://localhost/api/project-docs/doc-1/archive?workspaceId=ws-1", {
      method: "POST",
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await archiveProjectDoc(request, {
      params: Promise.resolve({ docId: "doc-1" }),
    })

    assert.equal(response.status, 200)
    assert.equal(updateData?.status, "ARCHIVED")
    assert.equal(updateData?.updatedById, "actor-1")
    assert.equal(updateData?.archivedAt instanceof Date, true)
  })
})

test("DELETE /project-docs/:docId hard deletes only an owned doc", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    ;(db.projectDoc as typeof db.projectDoc).findUnique = ((async () => ({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Runbook",
    })) as unknown) as typeof db.projectDoc.findUnique

    let deleteWhere: unknown
    mockTransaction({
      projectDoc: {
        delete: async (args: unknown) => {
          deleteWhere = (args as { where: unknown }).where
          return { id: "doc-1" }
        },
      },
      activityEvent: { create: async () => ({}) },
    })

    const request = new NextRequest("http://localhost/api/project-docs/doc-1?workspaceId=ws-1", {
      method: "DELETE",
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await deleteProjectDoc(request, {
      params: Promise.resolve({ docId: "doc-1" }),
    })
    const payload = (await response.json()) as { deleted?: boolean }

    assert.equal(response.status, 200)
    assert.deepEqual(deleteWhere, { id: "doc-1" })
    assert.equal(payload.deleted, true)
  })
})
