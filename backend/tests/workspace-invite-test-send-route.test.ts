import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { POST as sendTestInviteEmail } from "../src/app/api/workspace/invitations/test-send/route"

const originalEnvironment = {
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  PLANGLADE_EMAIL_PROVIDER: process.env.PLANGLADE_EMAIL_PROVIDER,
  PLANGLADE_EMAIL_FROM: process.env.PLANGLADE_EMAIL_FROM,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
}
const originalFetch = globalThis.fetch
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalUserFindUnique = db.user.findUnique
const originalPolicyFindUnique = db.workspaceInvitePolicy.findUnique

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

async function runWithMocks(fn: () => Promise<void>) {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"
  process.env.PLANGLADE_EMAIL_PROVIDER = "console"
  process.env.NEXTAUTH_URL = "http://localhost:8080/"
  try {
    await fn()
  } finally {
    restoreEnvironment()
    globalThis.fetch = originalFetch
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique =
      originalPolicyFindUnique
  }
}

function mockTestSendContext(input: {
  workspaceId: string
  actorUserId: string
  actorEmail?: string
  actorRole?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
  minimumInviterRole?: "OWNER" | "ADMIN" | "MEMBER"
  blockedDomains?: string[]
  workspaceName?: string
}) {
  const actorEmail = input.actorEmail ?? "admin@planglade.dev"
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: input.workspaceId,
    name: input.workspaceName ?? "PlanGlade",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: input.actorUserId,
    role: input.actorRole ?? "ADMIN",
  })) as unknown) as typeof db.workspaceMember.findUnique
  ;(db.user as typeof db.user).findUnique = ((async () => ({
    id: input.actorUserId,
    email: actorEmail,
    name: "Admin User",
  })) as unknown) as typeof db.user.findUnique
  ;(db.workspaceInvitePolicy as typeof db.workspaceInvitePolicy).findUnique = ((async () => ({
    id: `policy-${input.workspaceId}`,
    workspaceId: input.workspaceId,
    allowExternalDomains: true,
    allowedDomains: [],
    blockedDomains: input.blockedDomains ?? [],
    minimumInviterRole: input.minimumInviterRole ?? "ADMIN",
    defaultInviteRole: "MEMBER",
    inviteExpiryDays: 7,
    emailSubjectTemplate: "Invite to {{workspaceName}}",
    emailBodyTemplate: "Hi {{inviteeEmail}}",
    templateCatalog: [],
    updatedById: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  })) as unknown) as typeof db.workspaceInvitePolicy.findUnique
}

function makeRequest(input: {
  workspaceId: string
  actorUserId: string
  body?: Record<string, unknown>
  idempotencyKey?: string
}) {
  return new NextRequest("http://localhost/api/workspace/invitations/test-send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
      "x-planglade-user-id": input.actorUserId,
    },
    body: JSON.stringify({ workspaceId: input.workspaceId, ...input.body }),
  })
}

test("POST /workspace/invitations/test-send sends only to the signed-in user", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({ workspaceId: "ws-self", actorUserId: "admin-self" })
    const response = await sendTestInviteEmail(makeRequest({
      workspaceId: "ws-self",
      actorUserId: "admin-self",
    }))
    const payload = (await response.json()) as { ok?: boolean; toEmail?: string }
    assert.equal(response.status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.toEmail, "admin@planglade.dev")
  })
})

test("POST /workspace/invitations/test-send rejects an arbitrary recipient", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({ workspaceId: "ws-arbitrary", actorUserId: "admin-arbitrary" })
    const response = await sendTestInviteEmail(makeRequest({
      workspaceId: "ws-arbitrary",
      actorUserId: "admin-arbitrary",
      body: { toEmail: "unrelated@example.com" },
    }))
    const payload = (await response.json()) as { error?: string }
    assert.equal(response.status, 400)
    assert.match(payload.error ?? "", /signed-in user/i)
  })
})

test("POST /workspace/invitations/test-send enforces the workspace minimum inviter role", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({
      workspaceId: "ws-owner-only",
      actorUserId: "admin-owner-only",
      minimumInviterRole: "OWNER",
    })
    const response = await sendTestInviteEmail(makeRequest({
      workspaceId: "ws-owner-only",
      actorUserId: "admin-owner-only",
    }))
    const payload = (await response.json()) as { error?: string }
    assert.equal(response.status, 403)
    assert.match(payload.error ?? "", /OWNER role or higher/i)
  })
})

test("POST /workspace/invitations/test-send enforces the recipient domain policy", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({
      workspaceId: "ws-blocked-domain",
      actorUserId: "admin-blocked-domain",
      blockedDomains: ["planglade.dev"],
    })
    const response = await sendTestInviteEmail(makeRequest({
      workspaceId: "ws-blocked-domain",
      actorUserId: "admin-blocked-domain",
    }))
    const payload = (await response.json()) as { error?: string }
    assert.equal(response.status, 400)
    assert.match(payload.error ?? "", /blocked by workspace policy/i)
  })
})

test("POST /workspace/invitations/test-send keeps caller content preview-only", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({
      workspaceId: "ws-preview-only",
      actorUserId: "admin-preview-only",
      workspaceName: "Northstar",
    })
    process.env.PLANGLADE_EMAIL_PROVIDER = "resend"
    process.env.PLANGLADE_EMAIL_FROM = "PlanGlade <invites@planglade.dev>"
    process.env.RESEND_API_KEY = "re_test_key_long_enough"
    let deliveredBody: Record<string, unknown> | undefined
    globalThis.fetch = async (_input, init) => {
      deliveredBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ id: "email-preview-only" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    const response = await sendTestInviteEmail(makeRequest({
      workspaceId: "ws-preview-only",
      actorUserId: "admin-preview-only",
      body: {
        customMessage: "Caller-controlled content",
        subjectTemplateOverride: "CUSTOM {{workspaceName}}",
        bodyTemplateOverride: "CUSTOM BODY {{customMessage}}",
      },
    }))
    const payload = (await response.json()) as { preview?: { subject?: string; body?: string } }
    assert.equal(response.status, 200)
    assert.equal(payload.preview?.subject, "CUSTOM Northstar")
    assert.equal(payload.preview?.body, "CUSTOM BODY Caller-controlled content")
    assert.deepEqual(deliveredBody?.to, ["admin@planglade.dev"])
    assert.equal(deliveredBody?.subject, "PlanGlade invitation test for Northstar")
    assert.equal(
      deliveredBody?.text,
      "This is a PlanGlade invitation delivery test for Northstar.\n\nNo invitation was created, and no action is required."
    )
  })
})

test("POST /workspace/invitations/test-send reuses the provider key for a logical retry", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({ workspaceId: "ws-idempotent", actorUserId: "admin-idempotent" })
    process.env.PLANGLADE_EMAIL_PROVIDER = "resend"
    process.env.PLANGLADE_EMAIL_FROM = "PlanGlade <invites@planglade.dev>"
    process.env.RESEND_API_KEY = "re_test_key_long_enough"
    const providerKeys: string[] = []
    globalThis.fetch = async (_input, init) => {
      providerKeys.push(new Headers(init?.headers).get("idempotency-key") ?? "")
      return new Response(JSON.stringify({ id: "email-idempotent" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    const input = {
      workspaceId: "ws-idempotent",
      actorUserId: "admin-idempotent",
      idempotencyKey: "retry-invite-test-0001",
    }
    assert.equal((await sendTestInviteEmail(makeRequest(input))).status, 200)
    assert.equal((await sendTestInviteEmail(makeRequest(input))).status, 200)
    assert.equal(providerKeys.length, 2)
    assert.equal(providerKeys[0], providerKeys[1])
    assert.match(providerKeys[0] ?? "", /^workspace-invite-test:/)
  })
})

test("POST /workspace/invitations/test-send returns 429 after the durable test quota", async () => {
  await runWithMocks(async () => {
    mockTestSendContext({
      workspaceId: "ws-test-quota",
      actorUserId: "admin-test-quota",
      actorEmail: "admin-test-quota@planglade.dev",
    })
    const responses: Array<Awaited<ReturnType<typeof sendTestInviteEmail>>> = []
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      responses.push(await sendTestInviteEmail(makeRequest({
        workspaceId: "ws-test-quota",
        actorUserId: "admin-test-quota",
        idempotencyKey: `test-quota-attempt-${attempt}`,
      })))
    }
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 429])
    assert.ok(Number(responses[3]?.headers.get("retry-after")) > 0)
    const payload = (await responses[3]?.json()) as { code?: string }
    assert.equal(payload.code, "INVITATION_RATE_LIMITED")
  })
})
