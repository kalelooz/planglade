import assert from "node:assert/strict"
import test from "node:test"

import { db } from "../src/lib/db"
import { GET as getAuthSession } from "../src/app/api/auth/session/route"

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  FLOWBOARD_WORKSPACE_SLUG: process.env.FLOWBOARD_WORKSPACE_SLUG,
  FLOWBOARD_WORKSPACE_NAME: process.env.FLOWBOARD_WORKSPACE_NAME,
}

const originalUserUpsert = db.user.upsert
const originalWorkspaceUpsert = db.workspace.upsert
const originalWorkspaceMemberUpsert = db.workspaceMember.upsert
const originalWorkspaceMemberFindMany = db.workspaceMember.findMany

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function setEnv(key: keyof typeof originalEnv, value: string) {
  Reflect.set(process.env, key, value)
}

async function runWithMocks(fn: () => Promise<void>) {
  restoreEnv()
  try {
    await fn()
  } finally {
    restoreEnv()
    ;(db.user as typeof db.user).upsert = originalUserUpsert
    ;(db.workspace as typeof db.workspace).upsert = originalWorkspaceUpsert
    ;(db.workspaceMember as typeof db.workspaceMember).upsert = originalWorkspaceMemberUpsert
    ;(db.workspaceMember as typeof db.workspaceMember).findMany = originalWorkspaceMemberFindMany
  }
}

test("GET /auth/session rejects invalid auth mode", async () => {
  await runWithMocks(async () => {
    setEnv("FLOWBOARD_AUTH_MODE", "passwordless")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "passwordless")

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 500)
    assert.equal(payload.error, "Invalid PLANGLADE_AUTH_MODE. Use one of: dev, firebase, nextauth.")
  })
})

test("GET /auth/session blocks dev auth mode in production", async () => {
  await runWithMocks(async () => {
    setEnv("NODE_ENV", "production")
    setEnv("FLOWBOARD_AUTH_MODE", "dev")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "dev")

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string; errors?: string[] }

    assert.equal(response.status, 500)
    assert.equal(payload.error, "Authentication is not available.")
    assert.equal(payload.errors, undefined)
  })
})

test("GET /auth/session reports nextauth provider misconfiguration", async () => {
  await runWithMocks(async () => {
    setEnv("FLOWBOARD_AUTH_MODE", "nextauth")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "nextauth")
    setEnv("NEXTAUTH_SECRET", "test-secret")
    setEnv("NEXTAUTH_URL", "http://localhost:3000")

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 500)
    assert.equal(
      payload.error,
      "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider (Google or GitHub)."
    )
  })
})

test("GET /auth/session hides nextauth provider setup details in production", async () => {
  await runWithMocks(async () => {
    setEnv("NODE_ENV", "production")
    setEnv("FLOWBOARD_AUTH_MODE", "nextauth")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "nextauth")
    setEnv("NEXTAUTH_SECRET", "test-secret")
    setEnv("NEXTAUTH_URL", "https://planglade.example")

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Cloud login is not available yet.")
  })
})

test("GET /auth/session requires Firebase token in firebase mode", async () => {
  await runWithMocks(async () => {
    setEnv("FLOWBOARD_AUTH_MODE", "firebase")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "firebase")
    setEnv("FIREBASE_PROJECT_ID", "flowboard-test")
    setEnv("FIREBASE_STORAGE_BUCKET", "flowboard-test.appspot.com")
    setEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "api-key")
    setEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "flowboard-test.firebaseapp.com")
    setEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "flowboard-test")
    setEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app-id")

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "No Firebase ID token provided")
  })
})

test("GET /auth/session creates dev scaffold session", async () => {
  await runWithMocks(async () => {
    setEnv("FLOWBOARD_AUTH_MODE", "dev")
    setEnv("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE", "dev")
    setEnv("FLOWBOARD_WORKSPACE_SLUG", "test-workspace")
    setEnv("FLOWBOARD_WORKSPACE_NAME", "Test Workspace")

    ;(db.user as typeof db.user).upsert = ((async () => ({
      id: "user-1",
      email: "alex.morgan@flowboard.dev",
      name: "Alex Morgan",
    })) as unknown) as typeof db.user.upsert

    ;(db.workspace as typeof db.workspace).upsert = ((async () => ({
      id: "ws-1",
      slug: "test-workspace",
      name: "Test Workspace",
    })) as unknown) as typeof db.workspace.upsert

    ;(db.workspaceMember as typeof db.workspaceMember).upsert = ((async () => ({
      id: "member-1",
    })) as unknown) as typeof db.workspaceMember.upsert

    ;(db.workspaceMember as typeof db.workspaceMember).findMany = ((async () => [
      {
        role: "OWNER",
        user: {
          id: "user-1",
          name: "Alex Morgan",
          email: "alex.morgan@flowboard.dev",
        },
      },
    ]) as unknown) as typeof db.workspaceMember.findMany

    const response = await getAuthSession(new Request("http://localhost/api/auth/session"))
    const payload = (await response.json()) as {
      user?: { id: string }
      workspace?: { id: string; slug: string }
      members?: Array<{ id: string; role: string }>
      authMode?: string
    }

    assert.equal(response.status, 200)
    assert.equal(payload.user?.id, "user-1")
    assert.equal(payload.workspace?.slug, "test-workspace")
    assert.equal(payload.members?.[0]?.role, "OWNER")
    assert.equal(payload.authMode, "dev-session-scaffold")
  })
})
