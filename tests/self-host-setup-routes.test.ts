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
  const [{ GET }, claimRoute, completeRoute, { disconnectSetupDatabaseForTests }] = await Promise.all([
    import("../src/app/api/auth/setup/route"),
    import("../src/app/api/auth/setup/claim/route"),
    import("../src/app/api/auth/setup/complete/route"),
    import("../src/lib/self-host-setup/service"),
  ])
  try {
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
  } finally {
    await disconnectSetupDatabaseForTests()
    for (const key of ["PLANGLADE_LOCAL_AUTH_ENABLED", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "PLANGLADE_SETUP_TOKEN", "DATABASE_URL"]) delete process.env[key]
    await isolated.cleanup()
  }
})
