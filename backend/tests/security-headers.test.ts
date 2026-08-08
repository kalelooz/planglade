import assert from "node:assert/strict"
import test from "node:test"

import nextConfig, * as configModule from "../next.config"

type CspOptions = {
  nodeEnv: string | undefined
  umamiSrc: string | undefined
  umamiWebsiteId: string | undefined
}

const buildContentSecurityPolicy = (
  configModule as typeof configModule & {
    buildContentSecurityPolicy?: (options: CspOptions) => string
  }
).buildContentSecurityPolicy

function directive(policy: string, name: string) {
  return policy
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name} `))
}

test("production CSP contains the required narrow directives", () => {
  assert.equal(typeof buildContentSecurityPolicy, "function")

  const policy = buildContentSecurityPolicy!({
    nodeEnv: "production",
    umamiSrc: undefined,
    umamiWebsiteId: undefined,
  })

  for (const expected of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ]) {
    assert.match(policy, new RegExp(`(?:^|; )${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:;|$)`))
  }

  assert.doesNotMatch(policy, /(?:^|\s)\*(?:\s|;|$)/)
  assert.doesNotMatch(policy, /'unsafe-eval'|blob:|firebase|googleapis|gstatic/i)
})

test("development CSP permits eval without upgrading local HTTP", () => {
  assert.equal(typeof buildContentSecurityPolicy, "function")

  const policy = buildContentSecurityPolicy!({
    nodeEnv: "development",
    umamiSrc: undefined,
    umamiWebsiteId: undefined,
  })

  assert.match(directive(policy, "script-src") ?? "", /'unsafe-eval'/)
  assert.doesNotMatch(policy, /upgrade-insecure-requests/)
})

test("Umami adds only a configured HTTPS origin", () => {
  assert.equal(typeof buildContentSecurityPolicy, "function")

  const policy = buildContentSecurityPolicy!({
    nodeEnv: "production",
    umamiSrc: "https://analytics.example.com/stats/script.js?site=plan",
    umamiWebsiteId: "site-id",
  })

  assert.equal(
    directive(policy, "script-src"),
    "script-src 'self' 'unsafe-inline' https://analytics.example.com",
  )
  assert.equal(
    directive(policy, "connect-src"),
    "connect-src 'self' https://analytics.example.com",
  )
  assert.doesNotMatch(policy, /script\.js|\?site=/)
})

test("Umami fails closed for incomplete, malformed, or non-HTTPS production configuration", () => {
  assert.equal(typeof buildContentSecurityPolicy, "function")

  for (const options of [
    { umamiSrc: "https://analytics.example.com/script.js", umamiWebsiteId: undefined },
    { umamiSrc: "not a URL", umamiWebsiteId: "site-id" },
    { umamiSrc: "http://analytics.example.com/script.js", umamiWebsiteId: "site-id" },
  ]) {
    const policy = buildContentSecurityPolicy!({ nodeEnv: "production", ...options })
    assert.equal(directive(policy, "script-src"), "script-src 'self' 'unsafe-inline'")
    assert.equal(directive(policy, "connect-src"), "connect-src 'self'")
  }
})

test("application headers keep existing protections and disable framework disclosure", async () => {
  assert.equal(nextConfig.poweredByHeader, false)
  assert.ok(nextConfig.headers)

  const entries = await nextConfig.headers()
  const globalEntry = entries.find((entry) => entry.source === "/:path*")
  assert.ok(globalEntry)

  const headers = new Map(globalEntry.headers.map(({ key, value }) => [key, value]))
  const policy = headers.get("Content-Security-Policy")

  assert.ok(policy)
  assert.equal(headers.get("X-Frame-Options"), "DENY")
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff")
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
  assert.equal(headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()")
  assert.match(policy, /frame-ancestors 'none'/)
  assert.match(policy, /object-src 'none'/)
})
