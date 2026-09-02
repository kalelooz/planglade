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
  PLANGLADE_BUILD_REVISION: process.env.PLANGLADE_BUILD_REVISION,
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE,
  PLANGLADE_STORAGE_PROVIDER: process.env.PLANGLADE_STORAGE_PROVIDER,
  PLANGLADE_EMAIL_PROVIDER: process.env.PLANGLADE_EMAIL_PROVIDER,
  PLANGLADE_LOCAL_AUTH_ENABLED: process.env.PLANGLADE_LOCAL_AUTH_ENABLED,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GITHUB_ID: process.env.GITHUB_ID,
  GITHUB_SECRET: process.env.GITHUB_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

const TEST_REVISION = "0123456789abcdef0123456789abcdef01234567"

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function setContractEnv(nodeEnv: "development" | "production", authMode = "dev") {
  Reflect.set(process.env, "NODE_ENV", nodeEnv)
  process.env.PLANGLADE_BUILD_REVISION = TEST_REVISION
  process.env.PLANGLADE_AUTH_MODE = authMode
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = authMode
  process.env.PLANGLADE_STORAGE_PROVIDER = "local"
  delete process.env.PLANGLADE_EMAIL_PROVIDER
  delete process.env.PLANGLADE_LOCAL_AUTH_ENABLED
  delete process.env.NEXTAUTH_SECRET
  delete process.env.NEXTAUTH_URL
  delete process.env.GITHUB_ID
  delete process.env.GITHUB_SECRET
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
}

function assertPublicHealthPayload(payload: unknown, status: "ok" | "degraded" | "error", revision = TEST_REVISION) {
  assert.deepEqual(payload, {
    status,
    service: "planglade-api",
    revision,
  })
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
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    assertPublicHealthPayload(payload, "ok")
  })
})

test("health returns JSON 503 when required configuration is unavailable", async () => {
  await withRestoredState(async () => {
    setContractEnv("production")
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = await response.json()

    assert.equal(response.status, 503)
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/)
    assertPublicHealthPayload(payload, "degraded")
  })
})

test("health accepts explicit local credentials without exposing provider topology", async () => {
  await withRestoredState(async () => {
    setContractEnv("production", "nextauth")
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-32-bytes-minimum-value"
    process.env.NEXTAUTH_URL = "https://planglade.test"
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = await response.json()

    assert.equal(response.status, 200)
    assertPublicHealthPayload(payload, "ok")
  })
})

test("health degrades safely for invalid local authentication configuration", async () => {
  await withRestoredState(async () => {
    setContractEnv("production", "nextauth")
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-32-bytes-minimum-value"
    process.env.NEXTAUTH_URL = "https://planglade.test"
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "invalid"
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const originalConsoleError = console.error
    const logged: unknown[][] = []
    console.error = (...args: unknown[]) => logged.push(args)
    try {
      const response = await getHealth()
      const body = await response.text()
      const payload = JSON.parse(body)

      assert.equal(response.status, 503)
      assertPublicHealthPayload(payload, "degraded")
      assert.doesNotMatch(body, /PLANGLADE_LOCAL_AUTH_ENABLED=invalid|secret=|stack/i)
      assert.match(JSON.stringify(logged), /Invalid PLANGLADE_LOCAL_AUTH_ENABLED/)
    } finally {
      console.error = originalConsoleError
    }
  })
})

test("health uses the shared production policy for email readiness", async () => {
  await withRestoredState(async () => {
    setContractEnv("production", "nextauth")
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-32-bytes-minimum-value"
    process.env.NEXTAUTH_URL = "https://planglade.test"
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    process.env.PLANGLADE_EMAIL_PROVIDER = "console"
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()
    const payload = await response.json()

    assert.equal(response.status, 503)
    assertPublicHealthPayload(payload, "degraded")
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
      assertPublicHealthPayload(JSON.parse(body), "degraded")
      assert.doesNotMatch(body, /secret=|internal\/path|database-url|stack/i)
      assert.equal(logged.length, 2)
      assert.match(JSON.stringify(logged), /Health database check failed.*Error/)
      assert.doesNotMatch(JSON.stringify(logged), /secret=|internal\/path|database-url|stack/i)
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
      assertPublicHealthPayload(JSON.parse(body), "error")
      assert.doesNotMatch(body, /secret=|internal\/path|database-url|stack/i)
      assert.equal(logged.length, 1)
      assert.match(JSON.stringify(logged), /Health check failed.*Error/)
      assert.doesNotMatch(JSON.stringify(logged), /secret=|internal\/path|database-url|stack/i)
    } finally {
      process.env = realEnv
      console.error = originalConsoleError
    }
  })
})

test("health exposes only an exact immutable revision", async () => {
  await withRestoredState(async () => {
    setContractEnv("development")
    process.env.PLANGLADE_BUILD_REVISION = "mutable-latest"
    db.$queryRawUnsafe = (async () => [{ ready: 1 }]) as typeof db.$queryRawUnsafe

    const response = await getHealth()

    assert.equal(response.status, 200)
    assertPublicHealthPayload(await response.json(), "ok", "unknown")
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
