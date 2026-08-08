import assert from "node:assert/strict"
import test from "node:test"

import {
  parseSetupClaimRequest,
  parseSetupCompletionRequest,
} from "../src/lib/self-host-setup/contract"

function jsonRequest(body: string, contentType = "application/json") {
  return new Request("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  })
}

test("claim parsing accepts only a strict JSON object within 1024 bytes", async () => {
  const valid = await parseSetupClaimRequest(jsonRequest(JSON.stringify({ setupToken: "a".repeat(64) })))
  assert.deepEqual(valid, { ok: true, data: { setupToken: "a".repeat(64) } })

  const unknown = await parseSetupClaimRequest(
    jsonRequest(JSON.stringify({ setupToken: "a".repeat(64), extra: true }))
  )
  assert.equal(unknown.ok, false)
  if (!unknown.ok) assert.equal(unknown.error.code, "INVALID_REQUEST")

  const oversized = await parseSetupClaimRequest(jsonRequest(JSON.stringify({ setupToken: "a".repeat(1100) })))
  assert.equal(oversized.ok, false)
  if (!oversized.ok) {
    assert.equal(oversized.error.status, 413)
    assert.equal(oversized.error.code, "PAYLOAD_TOO_LARGE")
  }
})

test("claim parsing keeps token candidates exact for uniform authorization failure", async () => {
  for (const body of [{}, { setupToken: 42 }, { setupToken: " short " }, { setupToken: "g".repeat(64) }]) {
    const parsed = await parseSetupClaimRequest(jsonRequest(JSON.stringify(body)))
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.data.setupToken, (body as { setupToken?: unknown }).setupToken)
  }
})

test("setup parsers reject wrong media type and malformed JSON safely", async () => {
  const media = await parseSetupClaimRequest(jsonRequest("{}", "text/plain"))
  assert.equal(media.ok, false)
  if (!media.ok) assert.equal(media.error.status, 415)

  const malformed = await parseSetupClaimRequest(jsonRequest("{"))
  assert.equal(malformed.ok, false)
  if (!malformed.ok) assert.equal(malformed.error.code, "INVALID_REQUEST")
})

test("completion parsing applies exact normalization and bounds", async () => {
  const parsed = await parseSetupCompletionRequest(
    jsonRequest(JSON.stringify({
      email: " Owner@Example.COM ",
      name: " Owner ",
      password: " correct horse battery staple ",
      workspaceName: " My Workspace ",
    }))
  )
  assert.deepEqual(parsed, {
    ok: true,
    data: {
      email: "owner@example.com",
      name: "Owner",
      password: " correct horse battery staple ",
      workspaceName: "My Workspace",
    },
  })

  for (const body of [
    { email: "bad", name: "Owner", password: "x".repeat(15), workspaceName: "Workspace" },
    { email: "owner@example.com", name: "", password: "x".repeat(15), workspaceName: "Workspace" },
    { email: "owner@example.com", name: "Owner", password: "x".repeat(14), workspaceName: "Workspace" },
    { email: "owner@example.com", name: "Owner", password: "x".repeat(129), workspaceName: "Workspace" },
    { email: "owner@example.com", name: "Owner", password: "x".repeat(15), workspaceName: "x" },
    { email: "owner@example.com", name: "Owner", password: "x".repeat(15), workspaceName: "Workspace", role: "OWNER" },
  ]) {
    const invalid = await parseSetupCompletionRequest(jsonRequest(JSON.stringify(body)))
    assert.equal(invalid.ok, false)
    if (!invalid.ok) assert.equal(invalid.error.code, "INVALID_REQUEST")
  }
})
