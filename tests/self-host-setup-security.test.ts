import assert from "node:assert/strict"
import test from "node:test"

import {
  authorizeSetupToken,
  CLAIM_PATH,
  cookieOptions,
  createClaim,
  createCsrfToken,
  CSRF_PATH,
  normalizeRecoveryCode,
  recoveryCodes,
  sha256Base64url,
  validateCsrfToken,
  validateSetupRequest,
} from "../src/lib/self-host-setup/security"

test("setup token authorization is exact and fail-closed", () => {
  const token = "a".repeat(64)
  assert.equal(authorizeSetupToken(token, token), true)
  for (const candidate of [undefined, "", ` ${token}`, "A".repeat(63), "g".repeat(64)]) {
    assert.equal(authorizeSetupToken(candidate, token), false)
  }
  assert.equal(authorizeSetupToken(token, "bad"), false)
})

test("claims and recovery codes have the required entropy-shaped encodings", () => {
  const claim = createClaim()
  assert.match(claim.secret, /^[A-Za-z0-9_-]{43}$/)
  assert.match(claim.digest, /^[0-9a-f]{64}$/)
  const codes = recoveryCodes()
  assert.equal(codes.length, 10)
  assert.equal(new Set(codes).size, 10)
  for (const code of codes) {
    assert.match(code, /^(?:[0-9a-f]{4}-){7}[0-9a-f]{4}$/)
    assert.match(normalizeRecoveryCode(` \t${code.toUpperCase()}\r\n`) ?? "", /^[0-9a-f]{32}$/)
  }
})

test("CSRF tokens are exact, expiring, purpose-bound, and claim-bound", () => {
  const now = 1_700_000_000_000
  const claim = createCsrfToken("claim", "server-secret", "-", now)
  assert.equal(validateCsrfToken(claim, claim, "claim", "server-secret", "-", now), true)
  assert.equal(validateCsrfToken(claim, `${claim}x`, "claim", "server-secret", "-", now), false)
  assert.equal(validateCsrfToken(claim, claim, "complete", "server-secret", "-", now), false)
  assert.equal(validateCsrfToken(claim, claim, "claim", "server-secret", "-", now + 901_000), false)

  const claimant = createClaim().secret
  const binding = sha256Base64url(claimant)
  const complete = createCsrfToken("complete", claimant, binding, now)
  assert.equal(validateCsrfToken(complete, complete, "complete", claimant, binding, now), true)
  assert.equal(validateCsrfToken(complete, complete, "complete", claimant, "wrong", now), false)
})

test("cookie paths and exact origin rules remain distinct", () => {
  process.env.NEXTAUTH_URL = "http://localhost:3000/"
  assert.equal(cookieOptions(CLAIM_PATH, true).path, "/api/auth/setup")
  assert.equal(cookieOptions(CLAIM_PATH, true).httpOnly, true)
  assert.equal(cookieOptions(CSRF_PATH, false).path, "/")
  assert.equal(cookieOptions(CSRF_PATH, false).httpOnly, false)
  assert.equal(cookieOptions(CSRF_PATH, false, true).maxAge, 0)
  assert.equal(validateSetupRequest(new Request("http://localhost:3000", { headers: { host: "localhost:3000", origin: "http://localhost:3000" } }), true), true)
  assert.equal(validateSetupRequest(new Request("http://localhost:3000", { headers: { host: "localhost:3000" } }), true), false)
  process.env.NEXTAUTH_URL = "http://example.com/"
  assert.equal(validateSetupRequest(new Request("http://example.com", { headers: { host: "example.com", origin: "http://example.com" } }), true), false)
})
