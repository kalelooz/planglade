import assert from "node:assert/strict"
import test from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

function cookie(header: string | null, name: string) {
  return header?.match(new RegExp(`(?:^|, )${name}=([^;]+)`))?.[1]
}

test("the three setup routes complete once and never replay recovery codes", async () => {
  const isolated = createIsolatedTestDatabase()
  process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
  process.env.NEXTAUTH_URL = "http://localhost:3000/"
  process.env.NEXTAUTH_SECRET = "test-nextauth-secret"
  process.env.PLANGLADE_SETUP_TOKEN = "a".repeat(64)
  const [{ GET, getSetupDiscovery }, claimRoute, completeRoute, setupService, setupSecurity] = await Promise.all([
    import("../src/app/api/auth/setup/route"),
    import("../src/app/api/auth/setup/claim/route"),
    import("../src/app/api/auth/setup/complete/route"),
    import("../src/lib/self-host-setup/service"),
    import("../src/lib/self-host-setup/security"),
  ])
  try {
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "false"
    let unavailable = await GET(new Request("http://localhost:3000/api/auth/setup", { headers: { host: "localhost:3000" } }))
    assert.equal(unavailable.status, 200)
    assert.deepEqual(await unavailable.json(), { status: "unavailable" })
    assert.equal(unavailable.headers.get("set-cookie"), null)

    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    for (const configuration of [
      { token: undefined, secret: "test-nextauth-secret" },
      { token: "malformed", secret: "test-nextauth-secret" },
      { token: "a".repeat(64), secret: undefined },
    ]) {
      if (configuration.token) process.env.PLANGLADE_SETUP_TOKEN = configuration.token
      else delete process.env.PLANGLADE_SETUP_TOKEN
      if (configuration.secret) process.env.NEXTAUTH_SECRET = configuration.secret
      else delete process.env.NEXTAUTH_SECRET
      unavailable = await GET(new Request("http://localhost:3000/api/auth/setup", { headers: { host: "localhost:3000" } }))
      assert.equal(unavailable.status, 200)
      assert.deepEqual(await unavailable.json(), { status: "unavailable" })
      assert.equal(unavailable.headers.get("set-cookie"), null)
    }

    process.env.NEXTAUTH_SECRET = "test-nextauth-secret"
    process.env.PLANGLADE_SETUP_TOKEN = "a".repeat(64)
    for (const configuredUrl of [undefined, "not-a-url"]) {
      if (configuredUrl) process.env.NEXTAUTH_URL = configuredUrl
      else delete process.env.NEXTAUTH_URL
      unavailable = await GET(new Request("http://localhost:3000/api/auth/setup", { headers: { host: "localhost:3000" } }))
      assert.equal(unavailable.status, 200)
      assert.deepEqual(await unavailable.json(), { status: "unavailable" })
      assert.equal(unavailable.headers.get("set-cookie"), null)
    }
    process.env.NEXTAUTH_URL = "http://localhost:3000/"

    const captured: string[] = []
    const originalError = console.error
    const originalLog = console.log
    const originalWarn = console.warn
    const capture = (...values: unknown[]) => captured.push(values.join(" "))
    console.error = capture
    console.log = capture
    console.warn = capture
    try {
      unavailable = await getSetupDiscovery(
        new Request("http://localhost:3000/api/auth/setup", { headers: { host: "localhost:3000" } }),
        async () => { throw new Error("C:\\private\\database.db PRISMA_MARKER STACK_MARKER") },
      )
    } finally {
      console.error = originalError
      console.log = originalLog
      console.warn = originalWarn
    }
    assert.equal(unavailable.status, 200)
    assert.deepEqual(await unavailable.json(), { status: "unavailable" })
    assert.equal(unavailable.headers.get("set-cookie"), null)

    const wrongHost = await GET(new Request("http://localhost:3000/api/auth/setup", { headers: { host: "evil.example" } }))
    assert.equal(wrongHost.status, 403)

    const discovery = await GET(new Request("http://localhost:3000/api/auth/setup", { headers: { host: "localhost:3000" } }))
    assert.equal(discovery.status, 200)
    assert.deepEqual(await discovery.json(), { status: "available" })
    const claimCsrf = cookie(discovery.headers.get("set-cookie"), "planglade-setup-csrf")
    assert.ok(claimCsrf)

    const common = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" }
    const claim = await claimRoute.POST(new Request("http://localhost:3000/api/auth/setup/claim", {
      method: "POST",
      headers: { ...common, cookie: `planglade-setup-csrf=${claimCsrf}`, "x-planglade-csrf": claimCsrf },
      body: JSON.stringify({ setupToken: "a".repeat(64) }),
    }))
    assert.equal(claim.status, 201)
    assert.deepEqual(await claim.json(), { status: "claimed" })
    const setCookies = claim.headers.get("set-cookie")
    const claimant = cookie(setCookies, "planglade-setup-claim")
    const completeCsrf = cookie(setCookies, "planglade-setup-csrf")
    assert.ok(claimant && completeCsrf)

    const body = JSON.stringify({ email: "owner@example.com", name: "Owner", password: "correct horse battery staple", workspaceName: "My Workspace" })
    const completionHeaders = { ...common, cookie: `planglade-setup-claim=${claimant}; planglade-setup-csrf=${completeCsrf}`, "x-planglade-csrf": completeCsrf }
    const attacker = "attacker-controlled-claimant"
    const attackerCsrf = setupSecurity.createCsrfToken("complete", attacker, setupSecurity.sha256Base64url(attacker))
    let attackerPreparations = 0
    const attackerResponse = await completeRoute.completeSetupRequest(
      new Request("http://localhost:3000/api/auth/setup/complete", {
        method: "POST",
        headers: { ...common, cookie: `planglade-setup-claim=${attacker}; planglade-setup-csrf=${attackerCsrf}`, "x-planglade-csrf": attackerCsrf },
        body,
      }),
      ((input, suppliedClaimant) => setupService.completeSetup(
        input,
        suppliedClaimant,
        { preflightNow: () => new Date(), transactionNow: () => new Date() },
        undefined,
        undefined,
        async (preparedInput) => {
          attackerPreparations += 1
          return setupService.prepareSetupCompletion(preparedInput)
        },
      )) as typeof setupService.completeSetup,
    )
    assert.equal(attackerResponse.status, 401)
    assert.equal(attackerPreparations, 0)
    captured.push(JSON.stringify(await attackerResponse.json()))
    assert.doesNotMatch(captured.join("\n"), /attacker-controlled|owner@example|database\.db|PRISMA_MARKER|STACK_MARKER|correct horse/i)

    const temporary = await completeRoute.completeSetupRequest(
      new Request("http://localhost:3000/api/auth/setup/complete", { method: "POST", headers: completionHeaders, body }),
      async () => ({ ok: false as const, reason: "temporary" as const }),
    )
    captured.push(JSON.stringify(await temporary.clone().json()))
    assert.equal(temporary.status, 503)
    assert.equal(temporary.headers.get("set-cookie"), null)
    assert.doesNotMatch(captured.join("\n"), /owner@example|database\.db|PRISMA_MARKER|STACK_MARKER|correct horse/i)

    let failedPreflightPreparations = 0
    const failingClient = { $transaction: async () => { throw new Error("C:\\private\\database.db PRISMA_MARKER STACK_MARKER") } }
    const preflightFailure = await completeRoute.completeSetupRequest(
      new Request("http://localhost:3000/api/auth/setup/complete", { method: "POST", headers: completionHeaders, body }),
      ((input, suppliedClaimant) => setupService.completeSetup(
        input,
        suppliedClaimant,
        { preflightNow: () => new Date(), transactionNow: () => new Date() },
        failingClient as never,
        undefined,
        async (preparedInput) => {
          failedPreflightPreparations += 1
          return setupService.prepareSetupCompletion(preparedInput)
        },
      )) as typeof setupService.completeSetup,
    )
    assert.equal(preflightFailure.status, 503)
    assert.equal(preflightFailure.headers.get("set-cookie"), null)
    assert.equal(failedPreflightPreparations, 0)
    captured.push(JSON.stringify(await preflightFailure.json()))
    assert.doesNotMatch(captured.join("\n"), /owner@example|database\.db|PRISMA_MARKER|STACK_MARKER|correct horse/i)

    const completion = await completeRoute.POST(new Request("http://localhost:3000/api/auth/setup/complete", { method: "POST", headers: completionHeaders, body }))
    assert.equal(completion.status, 201)
    const result = await completion.json()
    assert.equal(result.status, "complete")
    assert.equal(result.recoveryCodes.length, 10)
    assert.match(completion.headers.get("set-cookie") ?? "", /planglade-setup-claim=;.*Path=\/api\/auth\/setup/i)
    assert.match(completion.headers.get("set-cookie") ?? "", /planglade-setup-csrf=;.*Path=\//i)

    const retry = await completeRoute.POST(new Request("http://localhost:3000/api/auth/setup/complete", { method: "POST", headers: completionHeaders, body }))
    assert.equal(retry.status, 409)
    assert.equal((await retry.json()).error.code, "SETUP_UNAVAILABLE")
    assert.match(retry.headers.get("set-cookie") ?? "", /planglade-setup-claim=;.*Max-Age=0/i)
  } finally {
    await setupService.disconnectSetupDatabaseForTests()
    const { db } = await import("../src/lib/db")
    await db.$disconnect()
    for (const key of ["PLANGLADE_LOCAL_AUTH_ENABLED", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "PLANGLADE_SETUP_TOKEN", "DATABASE_URL"]) delete process.env[key]
    await isolated.cleanup()
  }
})
