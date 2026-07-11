import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let getHealth: typeof import("../src/app/api/health/route").GET
let getNotes: typeof import("../src/app/api/notes/route").GET
let getProjects: typeof import("../src/app/api/projects/route").GET
let getSearch: typeof import("../src/app/api/search/route").GET
let getWorkItems: typeof import("../src/app/api/work-items/route").GET
let requireWorkspaceRole: typeof import("../src/lib/api-utils").requireWorkspaceRole
let db: typeof import("../src/lib/db").db
let originalWorkspaceFindUnique: typeof db.workspace.findUnique
let originalWorkspaceMemberFindUnique: typeof db.workspaceMember.findUnique
let originalQueryRawUnsafe: typeof db.$queryRawUnsafe

before(async () => {
  ;({ GET: getHealth } = await import("../src/app/api/health/route"))
  ;({ GET: getNotes } = await import("../src/app/api/notes/route"))
  ;({ GET: getProjects } = await import("../src/app/api/projects/route"))
  ;({ GET: getSearch } = await import("../src/app/api/search/route"))
  ;({ GET: getWorkItems } = await import("../src/app/api/work-items/route"))
  ;({ requireWorkspaceRole } = await import("../src/lib/api-utils"))
  ;({ db } = await import("../src/lib/db"))
  originalWorkspaceFindUnique = db.workspace.findUnique
  originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
  originalQueryRawUnsafe = db.$queryRawUnsafe
})

after(async () => {
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE,
  PLANGLADE_STORAGE_PROVIDER: process.env.PLANGLADE_STORAGE_PROVIDER,
  FLOWBOARD_STORAGE_PROVIDER: process.env.FLOWBOARD_STORAGE_PROVIDER,
  PLANGLADE_LOCAL_AUTH_ENABLED: process.env.PLANGLADE_LOCAL_AUTH_ENABLED,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GITHUB_ID: process.env.GITHUB_ID,
  GITHUB_SECRET: process.env.GITHUB_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function setContractEnv(nodeEnv: "development" | "production", authMode = "dev") {
  Reflect.set(process.env, "NODE_ENV", nodeEnv)
  process.env.PLANGLADE_AUTH_MODE = authMode
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = authMode
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  delete process.env.FLOWBOARD_AUTH_MODE
  delete process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE
  delete process.env.FLOWBOARD_STORAGE_PROVIDER
  delete process.env.PLANGLADE_LOCAL_AUTH_ENABLED
  delete process.env.NEXTAUTH_SECRET
  delete process.env.NEXTAUTH_URL
  delete process.env.GITHUB_ID
  delete process.env.GITHUB_SECRET
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
}

async function withRestoredState(fn: () => Promise<void>) {
  restoreEnv()
  try {
    await fn()
  } finally {
    restoreEnv()
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique =
      originalWorkspaceMemberFindUnique
    db.$queryRawUnsafe = originalQueryRawUnsafe
  }
}

test("health returns JSON success when required configuration is ready", async () => {
  await withRestoredState(async () => {
    setContractEnv("development")
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = (await response.json()) as { status?: string }

    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    assert.equal(payload.status, "ok")
  })
})

test("health returns JSON 503 when required configuration is unavailable", async () => {
  await withRestoredState(async () => {
    setContractEnv("production")
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = (await response.json()) as { status?: string }

    assert.equal(response.status, 503)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    assert.equal(payload.status, "degraded")
  })
})

test("health treats explicit local credentials as an available NextAuth provider", async () => {
  await withRestoredState(async () => {
    setContractEnv("production", "nextauth")
    process.env.NEXTAUTH_SECRET = "test-secret"
    process.env.NEXTAUTH_URL = "https://planglade.test"
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = (await response.json()) as {
      status?: string
      checks?: { auth?: { ready?: boolean; providers?: Record<string, boolean> } }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.status, "ok")
    assert.deepEqual(payload.checks?.auth?.providers, {
      localCredentials: true,
      google: false,
      github: false,
      anyConfigured: true,
    })
  })
})

test("health returns safe JSON 503 when the database is unavailable", async () => {
  await withRestoredState(async () => {
    setContractEnv("development")
    db.$queryRawUnsafe = (async () => {
      throw new Error("secret=/internal/path/database-url")
    }) as typeof db.$queryRawUnsafe

    const originalConsoleError = console.error
    const logged: unknown[][] = []
    console.error = (...args: unknown[]) => logged.push(args)
    try {
      const response = await getHealth()
      const body = await response.text()

      assert.equal(response.status, 503)
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
      assert.doesNotMatch(body, /secret=|internal\/path|database-url|stack/i)
      assert.equal(logged.length, 1)
    } finally {
      console.error = originalConsoleError
    }
  })
})

test("health unexpected failures return safe JSON without internal details", async () => {
  await withRestoredState(async () => {
    setContractEnv("production")
    const realEnv = process.env
    const secretMessage = "secret=/internal/path/database-url"
    const originalConsoleError = console.error
    const logged: unknown[][] = []
    console.error = (...args: unknown[]) => logged.push(args)
    process.env = new Proxy(realEnv, {
      get(target, property, receiver) {
        if (property === "PLANGLADE_AUTH_MODE") throw new Error(secretMessage)
        return Reflect.get(target, property, receiver)
      },
    })

    try {
      const response = await getHealth()
      const body = await response.text()

      assert.equal(response.status, 500)
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
      assert.doesNotMatch(body, /secret=|internal\/path|database-url|stack/i)
      assert.equal(logged.length, 1)
    } finally {
      process.env = realEnv
      console.error = originalConsoleError
    }
  })
})

test("representative protected reads return JSON 401 before database access", async () => {
  await withRestoredState(async () => {
    setContractEnv("development")
    let databaseCalls = 0
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => {
      databaseCalls += 1
      throw new Error("database should not be reached")
    }) as unknown) as typeof db.workspace.findUnique

    const requests = [
      getWorkItems(new NextRequest("http://localhost/api/work-items?workspaceId=probe")),
      getProjects(new NextRequest("http://localhost/api/projects?workspaceId=probe")),
      getNotes(new NextRequest("http://localhost/api/notes?workspaceId=probe")),
      getSearch(new NextRequest("http://localhost/api/search?workspaceId=probe&q=test")),
    ]

    for (const response of await Promise.all(requests)) {
      assert.equal(response.status, 401)
      assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
      assert.deepEqual(await response.json(), { error: "Authentication required" })
    }
    assert.equal(databaseCalls, 0)
  })
})

test("authenticated workspace and role failures remain distinguishable", async () => {
  await withRestoredState(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "ws-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async ({ where }) =>
      where.workspaceId_userId.userId === "member-1"
        ? { userId: "member-1", role: "VIEWER" }
        : null) as unknown) as typeof db.workspaceMember.findUnique

    const missingMembership = await requireWorkspaceRole("ws-1", "outsider-1", "VIEWER")
    const insufficientRole = await requireWorkspaceRole("ws-1", "member-1", "MEMBER")

    assert.equal(missingMembership.ok, false)
    assert.equal(missingMembership.response.status, 403)
    assert.deepEqual(await missingMembership.response.json(), {
      error: "You do not have access to this workspace",
    })
    assert.equal(insufficientRole.ok, false)
    assert.equal(insufficientRole.response.status, 403)
    assert.deepEqual(await insufficientRole.response.json(), {
      error: "This action requires MEMBER role or higher",
      details: { role: "VIEWER" },
    })
  })
})

test("unexpected route errors are logged and return safe production JSON", async () => {
  await withRestoredState(async () => {
    setContractEnv("production", "invalid")
    const originalConsoleError = console.error
    const logged: unknown[][] = []
    console.error = (...args: unknown[]) => logged.push(args)

    try {
      const response = await getProjects(
        new NextRequest("http://localhost/api/projects?workspaceId=probe")
      )
      const body = await response.text()

      assert.equal(response.status, 500)
      assert.deepEqual(JSON.parse(body), { error: "Failed to load projects" })
      assert.doesNotMatch(body, /secret=|internal\/path|database-url|stack/i)
      assert.equal(logged.length, 1)
    } finally {
      console.error = originalConsoleError
    }
  })
})
