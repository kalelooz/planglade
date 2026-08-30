import assert from "node:assert/strict"
import test from "node:test"
import type { NextRequest } from "next/server"

import { POST as previewWorkspaceInvite } from "../src/app/api/workspace/invitations/preview/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.PLANGLADE_AUTH_MODE
const originalUserFindUnique = db.user.findUnique
const originalInviteFindUnique = db.workspaceInvite.findUnique

async function runWithMocks(fn: () => Promise<void>) {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.PLANGLADE_AUTH_MODE = originalAuthMode
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = originalInviteFindUnique
  }
}

function previewRequest(token: string, userId = "user-1") {
  return new Request("http://localhost/api/workspace/invitations/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-planglade-user-id": userId,
    },
    body: JSON.stringify({ token }),
  }) as unknown as NextRequest
}

test("POST /workspace/invitations/preview returns decision details without accepting", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "invitee@example.com",
    })) as unknown) as typeof db.user.findUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-1",
      workspaceId: "ws-1",
      email: "invitee@example.com",
      role: "MEMBER",
      token: "preview-test-test-token-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      customMessage: "Join the launch workspace.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      workspace: { id: "ws-1", slug: "launch", name: "Launch" },
      invitedBy: { id: "admin-1", name: "Maya Chen", email: "maya@example.com" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    const response = await previewWorkspaceInvite(previewRequest("preview-test-test-token-01"))
    const payload = (await response.json()) as {
      review?: { email: string; role: string; alreadyAccepted: boolean; workspace: { name: string } }
    }

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("referrer-policy"), "no-referrer")
    assert.deepEqual(payload.review, {
      email: "invitee@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: "2100-01-01T00:00:00.000Z",
      customMessage: "Join the launch workspace.",
      alreadyAccepted: false,
      workspace: { id: "ws-1", slug: "launch", name: "Launch" },
      invitedBy: { id: "admin-1", name: "Maya Chen", email: "maya@example.com" },
    })
  })
})

test("POST /workspace/invitations/preview hides invite details from the wrong email", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "wrong@example.com",
    })) as unknown) as typeof db.user.findUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-1",
      workspaceId: "ws-1",
      email: "invitee@example.com",
      role: "ADMIN",
      token: "preview-test-test-token-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      customMessage: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      workspace: { id: "ws-1", slug: "launch", name: "Launch" },
      invitedBy: { id: "admin-1", name: "Maya Chen", email: "maya@example.com" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    const response = await previewWorkspaceInvite(previewRequest("preview-test-test-token-01"))
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: "Invite email does not match the signed-in account email" })
  })
})
