import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { GET as getWorkspaceMembers } from "../src/app/api/workspace/members/route"
import { resolveRequestActorUserId } from "../src/lib/api-utils"
import { getAuthConfigErrors } from "../src/lib/auth-config"
import {
  createWorkspaceInviteBatchSchema,
  createWorkspaceInviteSchema,
  createWorkspaceMemberSchema,
  sendWorkspaceInviteTestEmailSchema,
  updateWorkspaceInvitePolicySchema,
  updateWorkspaceInviteSchema,
  updateWorkspaceMemberSchema,
} from "../src/lib/contracts"

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE,
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test("generic member and invitation inputs reject OWNER", () => {
  const cases = [
    createWorkspaceMemberSchema.safeParse({
      workspaceId: "ws-1",
      email: "member@example.com",
      role: "OWNER",
    }),
    updateWorkspaceMemberSchema.safeParse({ workspaceId: "ws-1", role: "OWNER" }),
    createWorkspaceInviteSchema.safeParse({
      workspaceId: "ws-1",
      email: "invite@example.com",
      role: "OWNER",
    }),
    createWorkspaceInviteBatchSchema.safeParse({
      workspaceId: "ws-1",
      invites: [{ email: "invite@example.com", role: "OWNER" }],
    }),
    updateWorkspaceInviteSchema.safeParse({
      workspaceId: "ws-1",
      action: "resend",
      role: "OWNER",
    }),
    updateWorkspaceInvitePolicySchema.safeParse({
      workspaceId: "ws-1",
      defaultInviteRole: "OWNER",
    }),
    sendWorkspaceInviteTestEmailSchema.safeParse({
      workspaceId: "ws-1",
      role: "OWNER",
    }),
  ]

  assert.equal(cases.every((result) => !result.success), true)
})

test("generic member and invitation inputs retain lower roles", () => {
  assert.equal(
    createWorkspaceMemberSchema.safeParse({
      workspaceId: "ws-1",
      email: "admin@example.com",
      role: "ADMIN",
    }).success,
    true
  )
  assert.equal(
    createWorkspaceInviteSchema.safeParse({
      workspaceId: "ws-1",
      email: "viewer@example.com",
      role: "VIEWER",
    }).success,
    true
  )
})

test("production dev auth fails closed before reading identity headers", async () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "dev"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"
    delete process.env.FLOWBOARD_AUTH_MODE
    delete process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE

    assert.equal(
      getAuthConfigErrors().errors.includes(
        "PLANGLADE_AUTH_MODE=dev is disabled in production."
      ),
      true
    )

    await assert.rejects(
      resolveRequestActorUserId(
        new Request("http://localhost/api/workspace/members?workspaceId=ws-1", {
          headers: { "x-flowboard-user-id": "owner-1" },
        })
      ),
      /disabled in production/
    )
  } finally {
    restoreEnv()
  }
})

test("a protected API rejects a development identity header in production", async () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "dev"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

    const response = await getWorkspaceMembers(
      new NextRequest("http://localhost/api/workspace/members?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "owner-1" },
      })
    )
    const payload = (await response.json()) as { error?: string; details?: string }

    assert.equal(response.status, 500)
    assert.equal(payload.error, "Failed to load workspace members")
    assert.equal(payload.details, "Error: Development authentication is disabled in production")
  } finally {
    restoreEnv()
  }
})

test("development identity headers remain available outside production", async () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "development")
    process.env.PLANGLADE_AUTH_MODE = "dev"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

    const actor = await resolveRequestActorUserId(
      new Request("http://localhost/api/workspace/members?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "dev-user-1" },
      })
    )

    assert.equal(actor, "dev-user-1")
  } finally {
    restoreEnv()
  }
})
