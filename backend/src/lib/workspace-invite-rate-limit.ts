import { createHash } from "node:crypto"
import type { AuthThrottleScope } from "@prisma/client"

import { db } from "@/lib/db"

const INVITATION_SCOPE = "INVITATION" as AuthThrottleScope
const HOUR_MS = 60 * 60 * 1000

const policies = {
  testAccount: { attempts: 3, windowMs: HOUR_MS },
  recipient: { attempts: 5, windowMs: HOUR_MS },
  account: { attempts: 30, windowMs: HOUR_MS },
  workspace: { attempts: 60, windowMs: HOUR_MS },
  global: { attempts: 500, windowMs: HOUR_MS },
} as const

export type WorkspaceInviteDeliveryAction = "create" | "resend" | "test"

type RateLimitInput = {
  action: WorkspaceInviteDeliveryAction
  actorUserId: string
  workspaceId: string
  recipientEmail: string
}

type BucketName = keyof typeof policies

function hashSubject(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function getBuckets(input: RateLimitInput) {
  const buckets: Array<{ name: BucketName; subjectKey: string }> = []
  if (input.action === "test") {
    buckets.push({
      name: "testAccount",
      subjectKey: `test-account:${hashSubject(input.actorUserId)}`,
    })
  }
  buckets.push(
    {
      name: "recipient",
      subjectKey: `recipient:${hashSubject(input.recipientEmail.trim().toLowerCase())}`,
    },
    { name: "account", subjectKey: `account:${hashSubject(input.actorUserId)}` },
    { name: "workspace", subjectKey: `workspace:${hashSubject(input.workspaceId)}` },
    { name: "global", subjectKey: "global" }
  )
  return buckets
}

async function claimBucket(
  bucket: { name: BucketName; subjectKey: string },
  now: Date
) {
  const policy = policies[bucket.name]
  const key = { scope: INVITATION_SCOPE, subjectKey: bucket.subjectKey }
  const windowCutoff = new Date(now.getTime() - policy.windowMs)

  await db.authThrottle.upsert({
    where: { scope_subjectKey: key },
    create: { ...key, windowStartedAt: now, attemptCount: 0 },
    update: {},
  })
  await db.authThrottle.updateMany({
    where: { ...key, windowStartedAt: { lte: windowCutoff } },
    data: { windowStartedAt: now, attemptCount: 0, blockedUntil: null },
  })

  const claim = await db.authThrottle.updateMany({
    where: {
      ...key,
      attemptCount: { lt: policy.attempts },
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
    data: { attemptCount: { increment: 1 } },
  })
  if (claim.count === 1) return { allowed: true as const, retryAfterSeconds: 0 }

  const current = await db.authThrottle.findUnique({
    where: { scope_subjectKey: key },
    select: { windowStartedAt: true, blockedUntil: true },
  })
  const windowEndsAt = new Date(
    (current?.windowStartedAt ?? now).getTime() + policy.windowMs
  )
  const blockedUntil =
    current?.blockedUntil && current.blockedUntil > now
      ? current.blockedUntil
      : windowEndsAt
  await db.authThrottle.updateMany({
    where: key,
    data: { blockedUntil },
  })
  return {
    allowed: false as const,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
    ),
  }
}

export async function consumeWorkspaceInviteDeliveryRateLimit(
  input: RateLimitInput,
  now = new Date()
) {
  for (const bucket of getBuckets(input)) {
    const result = await claimBucket(bucket, now)
    if (!result.allowed) return result
  }
  return { allowed: true as const, retryAfterSeconds: 0 }
}
