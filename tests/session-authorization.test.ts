import assert from "node:assert/strict"
import test from "node:test"
import type { NextRequest } from "next/server"

import { requireWorkspaceRole } from "../src/lib/api-utils"
import { db } from "../src/lib/db"
import { DEV_USER_IDENTITY } from "../src/lib/permissions/session"
import { POST as importLocalWorkspace } from "../src/app/api/workspace/import-local/route"
import { GET as getSettings, PUT as updateSettings } from "../src/app/api/settings/route"
import { POST as createWorkItem } from "../src/app/api/work-items/route"

const TEST_PREFIX = "auth-session-test"
const TEST_EMAIL_DOMAIN = "auth-session-test.flowboard.dev"

const AUTH_ENV_KEYS = [
  "FLOWBOARD_AUTH_MODE",
  "NEXT_PUBLIC_FLOWBOARD_AUTH_MODE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const

const originalEnv = Object.fromEntries(AUTH_ENV_KEYS.map((key) => [key, process.env[key]]))
const originalNodeEnv = process.env.NODE_ENV

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  })
}

function restoreAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  setNodeEnv(originalNodeEnv)
}

function useDevAuth() {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "dev"
}

function useFirebaseAuthWithoutToken() {
  process.env.FLOWBOARD_AUTH_MODE = "firebase"
  process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "firebase"
  process.env.FIREBASE_PROJECT_ID = "test-project"
  process.env.FIREBASE_STORAGE_BUCKET = "test-bucket"
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key"
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "test.firebaseapp.com"
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project"
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "test-app"
}

async function cleanup() {
  await db.workspace.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
  await db.user.deleteMany({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } })
}

async function createWorkspace(options?: { addDevMember?: boolean }) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const owner = await db.user.create({
    data: {
      email: `owner-${suffix}@${TEST_EMAIL_DOMAIN}`,
      name: "Test Owner",
    },
  })
  const workspace = await db.workspace.create({
    data: {
      slug: `${TEST_PREFIX}-${suffix}`,
      name: "Authorization Test Workspace",
      ownerId: owner.id,
    },
  })
  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: "OWNER",
    },
  })

  if (options?.addDevMember) {
    const devUser = await db.user.upsert({
      where: { email: DEV_USER_IDENTITY.email },
      update: { name: DEV_USER_IDENTITY.name },
      create: DEV_USER_IDENTITY,
    })
    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: devUser.id,
        role: "MEMBER",
      },
    })
  }

  return { owner, workspace }
}

test.beforeEach(async () => {
  restoreAuthEnv()
  useDevAuth()
  await cleanup()
})

test.afterEach(async () => {
  await cleanup()
  restoreAuthEnv()
})

test("unauthenticated server-session authorization is denied outside dev mode", async () => {
  useFirebaseAuthWithoutToken()
  const { workspace } = await createWorkspace()

  const access = await requireWorkspaceRole(new Request("http://test.local/api/projects"), workspace.id, "MEMBER")

  assert.equal(access.ok, false)
  assert.equal(access.response.status, 401)
})

test("valid server session can access its own workspace", async () => {
  const { workspace } = await createWorkspace({ addDevMember: true })
  const devUser = await db.user.findUniqueOrThrow({
    where: { email: DEV_USER_IDENTITY.email },
    select: { id: true },
  })

  const access = await requireWorkspaceRole(new Request("http://test.local/api/projects"), workspace.id, "MEMBER")

  assert.equal(access.ok, true)
  if (access.ok) {
    assert.equal(access.actor.userId, devUser.id)
    assert.equal(access.actor.role, "MEMBER")
  }
})

test("production runtime does not use the dev session scaffold", async () => {
  setNodeEnv("production")
  useDevAuth()
  const { workspace } = await createWorkspace({ addDevMember: true })

  const access = await requireWorkspaceRole(new Request("http://test.local/api/projects"), workspace.id, "MEMBER")

  assert.equal(access.ok, false)
  assert.equal(access.response.status, 500)
  const payload = (await access.response.json()) as { error?: string }
  assert.equal(payload.error, "FLOWBOARD_AUTH_MODE=dev is disabled in production.")
})

test("spoofed x-flowboard-user-id does not grant workspace access", async () => {
  const { owner, workspace } = await createWorkspace()

  const access = await requireWorkspaceRole(
    new Request("http://test.local/api/projects", {
      headers: { "x-flowboard-user-id": owner.id },
    }),
    workspace.id,
    "MEMBER"
  )

  assert.equal(access.ok, false)
  assert.equal(access.response.status, 403)
})

test("cross-workspace access is denied for the session user", async () => {
  await createWorkspace({ addDevMember: true })
  const { workspace: otherWorkspace } = await createWorkspace()

  const access = await requireWorkspaceRole(new Request("http://test.local/api/projects"), otherWorkspace.id, "MEMBER")

  assert.equal(access.ok, false)
  assert.equal(access.response.status, 403)
})

test("spoofed settings query userId does not grant access", async () => {
  const { owner, workspace } = await createWorkspace()

  const response = await getSettings({
    nextUrl: new URL(`http://test.local/api/settings?workspaceId=${workspace.id}&userId=${owner.id}`),
    headers: new Headers({ "x-flowboard-user-id": owner.id }),
  } as NextRequest)

  assert.equal(response.status, 403)
})

test("spoofed settings body userId does not grant access", async () => {
  const { owner, workspace } = await createWorkspace()

  const response = await updateSettings(
    new Request("http://test.local/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": owner.id,
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
        userId: owner.id,
        theme: "dark",
      }),
    }) as NextRequest
  )

  assert.equal(response.status, 403)
})

test("spoofed import actorUserId does not grant owner fallback access", async () => {
  const { owner, workspace } = await createWorkspace()

  const response = await importLocalWorkspace(
    new Request("http://test.local/api/workspace/import-local", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": owner.id,
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
        actorUserId: owner.id,
        mode: "append",
        projects: [],
        workItems: [],
        notes: [],
      }),
    }) as NextRequest
  )

  assert.equal(response.status, 403)
})

test("work item capture endpoint rejects unauthenticated requests", async () => {
  useFirebaseAuthWithoutToken()
  const { workspace } = await createWorkspace()

  const response = await createWorkItem(
    new Request("http://test.local/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspace.id,
        title: "Unauthenticated capture",
        status: "BACKLOG",
        priority: "MEDIUM",
      }),
    }) as NextRequest
  )

  assert.equal(response.status, 401)
})

test("work item capture endpoint creates a backlog item for the session workspace", async () => {
  const { workspace } = await createWorkspace({ addDevMember: true })
  const devUser = await db.user.findUniqueOrThrow({
    where: { email: DEV_USER_IDENTITY.email },
    select: { id: true },
  })

  const response = await createWorkItem(
    new Request("http://test.local/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspace.id,
        title: "Server-backed capture",
        status: "BACKLOG",
        priority: "MEDIUM",
      }),
    }) as NextRequest
  )

  assert.equal(response.status, 201)
  const payload = (await response.json()) as { workItem: { id: string } }
  const created = await db.workItem.findUniqueOrThrow({ where: { id: payload.workItem.id } })
  assert.equal(created.workspaceId, workspace.id)
  assert.equal(created.createdById, devUser.id)
  assert.equal(created.title, "Server-backed capture")
  assert.equal(created.status, "BACKLOG")
})

test("spoofed work item capture userId does not grant workspace access", async () => {
  const { owner, workspace } = await createWorkspace()

  const response = await createWorkItem(
    new Request("http://test.local/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": owner.id,
      },
      body: JSON.stringify({
        workspaceId: workspace.id,
        title: "Spoofed capture",
        status: "BACKLOG",
        priority: "MEDIUM",
      }),
    }) as NextRequest
  )

  assert.equal(response.status, 403)
})
