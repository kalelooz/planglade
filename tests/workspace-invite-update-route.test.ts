import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { PATCH as patchWorkspaceInvite } from "../src/app/api/workspace/invitations/[inviteId]/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalInviteFindFirst = db.workspaceInvite.findFirst
const originalInvitePolicyFindUnique = db.workspaceInvitePolicy.findUnique
const originalInvitePolicyCreate = db.workspaceInvitePolicy.create
const originalTransaction = db.$transaction

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findFirst = originalInviteFindFirst
    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique =
      originalInvitePolicyFindUnique
    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).create =
      originalInvitePolicyCreate
    ;(db as typeof db).$transaction = originalTransaction
  }
}

test("PATCH /workspace/invitations/:inviteId revokes invite", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "admin-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findFirst = ((async () => ({
      id: "invite-1",
      workspaceId: "ws-1",
      email: "new@flowboard.dev",
      role: "MEMBER",
      status: "PENDING",
      token: "tok-12345678901234567890",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as unknown) as typeof db.workspaceInvite.findFirst

    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique = ((async () => ({
      id: "policy-1",
      workspaceId: "ws-1",
      allowExternalDomains: true,
      allowedDomains: [],
      blockedDomains: [],
      minimumInviterRole: "ADMIN",
      defaultInviteRole: "MEMBER",
      inviteExpiryDays: 7,
      emailSubjectTemplate: "subject",
      emailBodyTemplate: "body",
      updatedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as unknown) as typeof db.workspaceInvitePolicy.findUnique

    ;(db as typeof db).$transaction = (async (callback: unknown) => {
      const tx = {
        workspaceInvite: {
          update: async () => ({
            id: "invite-1",
            workspaceId: "ws-1",
            email: "new@flowboard.dev",
            role: "MEMBER",
            status: "REVOKED",
            token: "tok-12345678901234567890",
            expiresAt: new Date("2100-01-01T00:00:00.000Z"),
            invitedById: "admin-1",
            acceptedById: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-02-01T00:00:00.000Z"),
          }),
        },
        activityEvent: {
          create: async () => ({}),
        },
      }
      return (callback as (client: typeof tx) => Promise<unknown>)(tx)
    }) as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/workspace/invitations/invite-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "admin-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        action: "revoke",
      }),
    })

    const response = await patchWorkspaceInvite(request, {
      params: Promise.resolve({ inviteId: "invite-1" }),
    })
    const payload = (await response.json()) as {
      invite?: { status?: string }
      error?: string
    }

    assert.equal(response.status, 200)
    assert.equal(payload.invite?.status, "REVOKED")
    assert.equal(payload.error, undefined)
  })
})

test("PATCH /workspace/invitations/:inviteId blocks resend for accepted invite", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "admin-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findFirst = ((async () => ({
      id: "invite-2",
      workspaceId: "ws-1",
      email: "accepted@flowboard.dev",
      role: "MEMBER",
      status: "ACCEPTED",
      token: "tok-accepted-123456789012",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: "user-2",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    })) as unknown) as typeof db.workspaceInvite.findFirst

    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique = ((async () => ({
      id: "policy-1",
      workspaceId: "ws-1",
      allowExternalDomains: true,
      allowedDomains: [],
      blockedDomains: [],
      minimumInviterRole: "ADMIN",
      defaultInviteRole: "MEMBER",
      inviteExpiryDays: 7,
      emailSubjectTemplate: "subject",
      emailBodyTemplate: "body",
      updatedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as unknown) as typeof db.workspaceInvitePolicy.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("transaction should not run for accepted invite resend")
    }) as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/workspace/invitations/invite-2", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "admin-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        action: "resend",
      }),
    })

    const response = await patchWorkspaceInvite(request, {
      params: Promise.resolve({ inviteId: "invite-2" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 400)
    assert.equal(payload.error, "Accepted invite cannot be resent")
    assert.equal(transactionCalled, false)
  })
})

test("PATCH /workspace/invitations/:inviteId denies request without actor", async () => {
  await runWithMocks(async () => {
    let inviteLookupCalled = false

    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findFirst = ((async () => {
      inviteLookupCalled = true
      return null as never
    }) as unknown) as typeof db.workspaceInvite.findFirst

    const request = new NextRequest("http://localhost/api/workspace/invitations/invite-3", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        action: "revoke",
      }),
    })

    const response = await patchWorkspaceInvite(request, {
      params: Promise.resolve({ inviteId: "invite-3" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Authentication required")
    assert.equal(inviteLookupCalled, false)
  })
})

test("PATCH /workspace/invitations/:inviteId denies actor outside workspace", async () => {
  await runWithMocks(async () => {
    let inviteLookupCalled = false

    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => null) as unknown) as typeof db.workspaceMember.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findFirst = ((async () => {
      inviteLookupCalled = true
      return null as never
    }) as unknown) as typeof db.workspaceInvite.findFirst

    const request = new NextRequest("http://localhost/api/workspace/invitations/invite-4", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "outsider-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        action: "resend",
      }),
    })

    const response = await patchWorkspaceInvite(request, {
      params: Promise.resolve({ inviteId: "invite-4" }),
    })
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
    assert.equal(inviteLookupCalled, false)
  })
})
