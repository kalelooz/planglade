import assert from "node:assert/strict"
import test from "node:test"
import type { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { POST as acceptWorkspaceInvite } from "../src/app/api/workspace/invitations/accept/route"

const originalAuthMode = process.env.PLANGLADE_AUTH_MODE

const originalUserFindUnique = db.user.findUnique
const originalInviteFindUnique = db.workspaceInvite.findUnique
const originalInviteUpdate = db.workspaceInvite.update
const originalTransaction = db.$transaction

async function runWithMocks(fn: () => Promise<void>) {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.PLANGLADE_AUTH_MODE = originalAuthMode
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = originalInviteFindUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).update = originalInviteUpdate
    ;(db as typeof db).$transaction = originalTransaction
  }
}

test("POST /workspace/invitations/accept requires explicit confirmation", async () => {
  const request = new Request("http://localhost/api/workspace/invitations/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "test-test-test-test-01" }),
  }) as unknown as NextRequest

  const response = await acceptWorkspaceInvite(request)
  assert.equal(response.status, 400)
})

test("POST /workspace/invitations/accept blocks invite acceptance when email mismatches", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    })) as unknown) as typeof db.user.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-1",
      workspaceId: "ws-1",
      email: "other@example.com",
      role: "MEMBER",
      token: "test-test-test-test-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      workspace: { id: "ws-1", slug: "ws", name: "Workspace" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("transaction should not run for mismatch")
    }) as typeof db.$transaction

    const request = new Request("http://localhost/api/workspace/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-planglade-user-id": "user-1",
      },
      body: JSON.stringify({ token: "test-test-test-test-01", confirmed: true }),
    }) as unknown as NextRequest

    const response = await acceptWorkspaceInvite(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "Invite email does not match the signed-in account email")
    assert.equal(transactionCalled, false)
  })
})

test("POST /workspace/invitations/accept returns 410 and expires stale invite", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    })) as unknown) as typeof db.user.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-2",
      workspaceId: "ws-1",
      email: "user@example.com",
      role: "MEMBER",
      token: "tok-expired-1234567890",
      status: "PENDING",
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      workspace: { id: "ws-1", slug: "ws", name: "Workspace" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    let updatedToExpired = false
    ;(db.workspaceInvite as typeof db.workspaceInvite).update = ((async () => {
      updatedToExpired = true
      return {} as never
    }) as unknown) as typeof db.workspaceInvite.update

    const request = new Request("http://localhost/api/workspace/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-planglade-user-id": "user-1",
      },
      body: JSON.stringify({ token: "tok-expired-1234567890", confirmed: true }),
    }) as unknown as NextRequest

    const response = await acceptWorkspaceInvite(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 410)
    assert.equal(payload.error, "Invite has expired")
    assert.equal(updatedToExpired, true)
  })
})

test("POST /workspace/invitations/accept rejects a persisted OWNER invite", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    })) as unknown) as typeof db.user.findUnique

    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-owner",
      workspaceId: "ws-1",
      email: "user@example.com",
      role: "OWNER",
      token: "owner-test-test-token-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      workspace: { id: "ws-1", slug: "ws", name: "Workspace" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("transaction should not run for OWNER invite")
    }) as typeof db.$transaction

    const request = new Request("http://localhost/api/workspace/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-planglade-user-id": "user-1",
      },
      body: JSON.stringify({ token: "owner-test-test-token-01", confirmed: true }),
    }) as unknown as NextRequest

    const response = await acceptWorkspaceInvite(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "Ownership cannot be granted through invitations")
    assert.equal(transactionCalled, false)
  })
})

test("POST /workspace/invitations/accept preserves an existing member role", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    })) as unknown) as typeof db.user.findUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-role",
      workspaceId: "ws-1",
      email: "user@example.com",
      role: "VIEWER",
      token: "role-test-test-token-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      workspace: { id: "ws-1", slug: "ws", name: "Workspace" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    let upsertUpdate: unknown
    ;(db as typeof db).$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => fn({
      workspaceInvite: {
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => ({ id: "invite-role", status: "ACCEPTED" }),
      },
      workspaceMember: {
        upsert: async (args: unknown) => {
          upsertUpdate = (args as { update: unknown }).update
          return { role: "ADMIN", joinedAt: new Date("2026-01-01T00:00:00.000Z") }
        },
      },
      activityEvent: { create: async () => ({}) },
    })) as typeof db.$transaction

    const request = new Request("http://localhost/api/workspace/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-planglade-user-id": "user-1",
      },
      body: JSON.stringify({ token: "role-test-test-token-01", confirmed: true }),
    }) as unknown as NextRequest

    const response = await acceptWorkspaceInvite(request)
    const payload = (await response.json()) as { member?: { role?: string } }

    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("referrer-policy"), "no-referrer")
    assert.deepEqual(upsertUpdate, {})
    assert.equal(payload.member?.role, "ADMIN")
  })
})

test("POST /workspace/invitations/accept has one database claim winner", async () => {
  await runWithMocks(async () => {
    ;(db.user as typeof db.user).findUnique = ((async () => ({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
    })) as unknown) as typeof db.user.findUnique
    ;(db.workspaceInvite as typeof db.workspaceInvite).findUnique = ((async () => ({
      id: "invite-race",
      workspaceId: "ws-1",
      email: "user@example.com",
      role: "MEMBER",
      token: "race-test-test-token-01",
      status: "PENDING",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
      invitedById: "admin-1",
      acceptedById: null,
      workspace: { id: "ws-1", slug: "ws", name: "Workspace" },
    })) as unknown) as typeof db.workspaceInvite.findUnique

    let membershipWritten = false
    ;(db as typeof db).$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => fn({
      workspaceInvite: { updateMany: async () => ({ count: 0 }) },
      workspaceMember: {
        upsert: async () => {
          membershipWritten = true
          return {}
        },
      },
    })) as typeof db.$transaction

    const request = new Request("http://localhost/api/workspace/invitations/accept", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-planglade-user-id": "user-1",
      },
      body: JSON.stringify({ token: "race-test-test-token-01", confirmed: true }),
    }) as unknown as NextRequest

    const response = await acceptWorkspaceInvite(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 400)
    assert.equal(payload.error, "Invite is no longer available")
    assert.equal(membershipWritten, false)
  })
})
