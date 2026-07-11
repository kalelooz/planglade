import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { POST as sendTestInviteEmail } from "../src/app/api/workspace/invitations/test-send/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalUserFindUnique = db.user.findUnique
const originalPolicyFindUnique = db.workspaceInvitePolicy.findUnique

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  process.env.FLOWBOARD_EMAIL_PROVIDER = "console"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique =
      originalPolicyFindUnique
  }
}

test("POST /workspace/invitations/test-send sends a test invite email", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      name: "PlanGlade",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "admin-1",
      role: "ADMIN",
    })) as unknown) as typeof db.workspaceMember.findUnique

    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "admin-1",
      email: "admin@flowboard.dev",
      name: "Admin User",
    })) as unknown) as typeof db.user.findUnique

    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique = ((async () => ({
      id: "policy-1",
      workspaceId: "ws-1",
      allowExternalDomains: true,
      allowedDomains: [],
      blockedDomains: [],
      minimumInviterRole: "ADMIN",
      defaultInviteRole: "MEMBER",
      inviteExpiryDays: 7,
      emailSubjectTemplate: "Invite to {{workspaceName}}",
      emailBodyTemplate: "Hi {{inviteeEmail}}",
      templateCatalog: [],
      updatedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })) as unknown) as typeof db.workspaceInvitePolicy.findUnique

    const request = new NextRequest("http://localhost/api/workspace/invitations/test-send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "admin-1",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        templateKey: "default",
      }),
    })

    const response = await sendTestInviteEmail(request)
    const payload = (await response.json()) as { ok?: boolean; toEmail?: string; error?: string }

    assert.equal(response.status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.toEmail, "admin@flowboard.dev")
    assert.equal(payload.error, undefined)
  })
})

test("POST /workspace/invitations/test-send denies request without actor", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      name: "PlanGlade",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    const request = new NextRequest("http://localhost/api/workspace/invitations/test-send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "ws-1",
        templateKey: "default",
      }),
    })

    const response = await sendTestInviteEmail(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Authentication required")
  })
})
