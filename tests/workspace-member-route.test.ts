import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { DELETE as deleteWorkspaceMember, PATCH as patchWorkspaceMember } from "../src/app/api/workspace/members/[memberUserId]/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalMemberUpdate = db.workspaceMember.update
const originalMemberDelete = db.workspaceMember.delete

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).update = originalMemberUpdate
    ;(db.workspaceMember as typeof db.workspaceMember).delete = originalMemberDelete
  }
}

test("PATCH /workspace/members/:memberUserId blocks owner role downgrade", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async (args: unknown) => {
      const typed = args as { where: { workspaceId_userId: { userId: string } } }
      if (typed.where.workspaceId_userId.userId === "admin-1") {
        return { userId: "admin-1", role: "ADMIN" } as never
      }
      return { userId: "owner-1", role: "OWNER" } as never
    }) as unknown) as typeof db.workspaceMember.findUnique

    let updateCalled = false
    ;(db.workspaceMember as typeof db.workspaceMember).update = ((async () => {
      updateCalled = true
      return {} as never
    }) as unknown) as typeof db.workspaceMember.update

    const request = new NextRequest("http://localhost/api/workspace/members/owner-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "admin-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        role: "ADMIN",
      }),
    })

    const response = await patchWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "owner-1" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "Workspace owner role cannot be downgraded")
    assert.equal(updateCalled, false)
  })
})

test("DELETE /workspace/members/:memberUserId blocks owner removal", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "admin-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique

    let deleteCalled = false
    ;(db.workspaceMember as typeof db.workspaceMember).delete = ((async () => {
      deleteCalled = true
      return {} as never
    }) as unknown) as typeof db.workspaceMember.delete

    const request = new NextRequest("http://localhost/api/workspace/members/owner-1?workspaceId=ws-1", {
      method: "DELETE",
      headers: {
        "x-flowboard-user-id": "admin-1",
      },
    })

    const response = await deleteWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "owner-1" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "Workspace owner cannot be removed")
    assert.equal(deleteCalled, false)
  })
})

test("DELETE /workspace/members/:memberUserId blocks self removal", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "admin-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique

    let deleteCalled = false
    ;(db.workspaceMember as typeof db.workspaceMember).delete = ((async () => {
      deleteCalled = true
      return {} as never
    }) as unknown) as typeof db.workspaceMember.delete

    const request = new NextRequest("http://localhost/api/workspace/members/admin-1?workspaceId=ws-1", {
      method: "DELETE",
      headers: {
        "x-flowboard-user-id": "admin-1",
      },
    })

    const response = await deleteWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "admin-1" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "Use a different admin/owner account to remove yourself")
    assert.equal(deleteCalled, false)
  })
})

test("DELETE /workspace/members/:memberUserId removes standard member", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async (args: unknown) => {
      const typed = args as { select?: { ownerId?: boolean } }
      if (typed.select?.ownerId) {
        return { ownerId: "owner-1" } as never
      }
      return { id: "ws-1", ownerId: "owner-1" } as never
    }) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async (args: unknown) => {
      const typed = args as { where: { workspaceId_userId: { userId: string } } }
      if (typed.where.workspaceId_userId.userId === "admin-1") {
        return { userId: "admin-1", role: "ADMIN" } as never
      }
      return { userId: "member-1", role: "MEMBER" } as never
    }) as unknown) as typeof db.workspaceMember.findUnique

    let deleteCalled = false
    ;(db.workspaceMember as typeof db.workspaceMember).delete = ((async () => {
      deleteCalled = true
      return {} as never
    }) as unknown) as typeof db.workspaceMember.delete

    const request = new NextRequest("http://localhost/api/workspace/members/member-1?workspaceId=ws-1", {
      method: "DELETE",
      headers: {
        "x-flowboard-user-id": "admin-1",
      },
    })

    const response = await deleteWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "member-1" }),
    })
    const payload = (await response.json()) as { deleted?: boolean }

    assert.equal(response.status, 200)
    assert.equal(payload.deleted, true)
    assert.equal(deleteCalled, true)
  })
})

test("DELETE /workspace/members/:memberUserId denies request without actor", async () => {
  await runWithMocks(async () => {
    let membershipLookupCalled = false

    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => {
      membershipLookupCalled = true
      return null as never
    }) as unknown) as typeof db.workspaceMember.findUnique

    const request = new NextRequest("http://localhost/api/workspace/members/member-1?workspaceId=ws-1", {
      method: "DELETE",
    })

    const response = await deleteWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "member-1" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
    assert.equal(membershipLookupCalled, false)
  })
})

test("DELETE /workspace/members/:memberUserId denies actor outside workspace", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => null) as unknown) as typeof db.workspaceMember.findUnique

    const request = new NextRequest("http://localhost/api/workspace/members/member-1?workspaceId=ws-1", {
      method: "DELETE",
      headers: {
        "x-flowboard-user-id": "outsider-1",
      },
    })

    const response = await deleteWorkspaceMember(request, {
      params: Promise.resolve({ memberUserId: "member-1" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
  })
})
