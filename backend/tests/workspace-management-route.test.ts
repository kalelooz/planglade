import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { PATCH as updateWorkspace } from "../src/app/api/workspaces/[workspaceId]/route"
import { POST as createWorkspace } from "../src/app/api/workspaces/route"

const originalAuthMode = process.env.PLANGLADE_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalTransaction = db.$transaction

async function runWithMocks(fn: () => Promise<void>) {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    if (originalAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
    else process.env.PLANGLADE_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db as typeof db).$transaction = originalTransaction
  }
}

test("POST /workspaces creates another workspace for an existing user", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => null) as unknown) as typeof db.workspace.findUnique

    let createdWorkspaceData: Record<string, unknown> | undefined
    let createdMemberData: Record<string, unknown> | undefined
    ;(db as typeof db).$transaction = (async (callback: unknown) => {
      const tx = {
        workspace: {
          create: async (args: unknown) => {
            createdWorkspaceData = (args as { data: Record<string, unknown> }).data
            return {
              id: "ws-new",
              slug: createdWorkspaceData.slug,
              name: createdWorkspaceData.name,
              taskPriorityDisplayStyle: createdWorkspaceData.taskPriorityDisplayStyle,
            }
          },
        },
        workspaceMember: {
          create: async (args: unknown) => {
            createdMemberData = (args as { data: Record<string, unknown> }).data
            return { id: "member-new" }
          },
        },
        activityEvent: {
          create: async () => ({}),
        },
      }
      return (callback as (client: typeof tx) => Promise<unknown>)(tx)
    }) as typeof db.$transaction

    const response = await createWorkspace(new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Client Work" }),
    }))
    const payload = (await response.json()) as { workspace?: { id: string; name: string; role?: string } }

    assert.equal(response.status, 201)
    assert.equal(payload.workspace?.id, "ws-new")
    assert.equal(payload.workspace?.name, "Client Work")
    assert.equal(payload.workspace?.role, "OWNER")
    assert.equal(createdWorkspaceData?.slug, "client-work")
    assert.equal(createdMemberData?.workspaceId, "ws-new")
    assert.equal(createdMemberData?.role, "OWNER")
    assert.equal(typeof createdMemberData?.userId, "string")
  })
})

test("PATCH /workspaces/:id renames a workspace for admins", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "user-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.workspace as typeof db.workspace).findUnique = ((async (args: unknown) => {
      const where = (args as { where?: { id?: string; slug?: string } }).where
      if (where?.id === "ws-1") return { id: "ws-1", name: "Old Workspace", slug: "old-workspace", ownerId: "owner-1" }
      return null
    }) as unknown) as typeof db.workspace.findUnique

    let updateData: Record<string, unknown> | undefined
    ;(db as typeof db).$transaction = (async (callback: unknown) => {
      const tx = {
        workspace: {
          update: async (args: unknown) => {
            updateData = (args as { data: Record<string, unknown> }).data
            return { id: "ws-1", slug: "old-workspace", name: updateData.name, taskPriorityDisplayStyle: "badge" }
          },
        },
        activityEvent: {
          create: async () => ({}),
        },
      }
      return (callback as (client: typeof tx) => Promise<unknown>)(tx)
    }) as typeof db.$transaction

    const response = await updateWorkspace(new NextRequest("http://localhost/api/workspaces/ws-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed Workspace" }),
    }), { params: Promise.resolve({ workspaceId: "ws-1" }) })
    const payload = (await response.json()) as { workspace?: { name: string } }

    assert.equal(response.status, 200)
    assert.equal(payload.workspace?.name, "Renamed Workspace")
    assert.equal(updateData?.name, "Renamed Workspace")
  })
})

test("PATCH /workspaces/:id rejects members below admin", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "user-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique

    const response = await updateWorkspace(new NextRequest("http://localhost/api/workspaces/ws-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Nope" }),
    }), { params: Promise.resolve({ workspaceId: "ws-1" }) })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "This action requires ADMIN role or higher")
  })
})
