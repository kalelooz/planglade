import { createHash } from "node:crypto"
import type { AuthThrottleScope } from "@prisma/client"

import { db } from "@/lib/db"

const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_BLOCK_MS = 10 * 60 * 1000
const LOGIN_ACCOUNT_ATTEMPTS = 5
const LOGIN_GLOBAL_ATTEMPTS = 100
const GLOBAL_SUBJECT = "installation"

type LoginThrottlePolicy = {
  scope: AuthThrottleScope
  subjectKey: string
  attempts: number
}

export function hashLoginAccountSubject(normalizedEmail: string | null) {
  return createHash("sha256")
    .update(normalizedEmail ?? "invalid-account", "utf8")
    .digest("hex")
}

async function claimBucket(policy: LoginThrottlePolicy, now: Date) {
  const key = { scope: policy.scope, subjectKey: policy.subjectKey }
  const windowCutoff = new Date(now.getTime() - LOGIN_WINDOW_MS)

  await db.authThrottle.upsert({
    where: { scope_subjectKey: key },
    create: {
      ...key,
      windowStartedAt: now,
      attemptCount: 0,
    },
    update: {},
  })
  await db.authThrottle.updateMany({
    where: {
      ...key,
      windowStartedAt: { lte: windowCutoff },
    },
    data: {
      windowStartedAt: now,
      attemptCount: 0,
      blockedUntil: null,
    },
  })

  const claim = await db.authThrottle.updateMany({
    where: {
      ...key,
      attemptCount: { lt: policy.attempts },
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
    data: { attemptCount: { increment: 1 } },
  })
  if (claim.count === 1) return true

  await db.authThrottle.updateMany({
    where: key,
    data: { blockedUntil: new Date(now.getTime() + LOGIN_BLOCK_MS) },
  })
  return false
}

export async function claimLoginVerification(normalizedEmail: string | null, now = new Date()) {
  const accountAllowed = await claimBucket({
    scope: "LOGIN_ACCOUNT",
    subjectKey: hashLoginAccountSubject(normalizedEmail),
    attempts: LOGIN_ACCOUNT_ATTEMPTS,
  }, now)
  if (!accountAllowed) return false

  return claimBucket({
    scope: "LOGIN_GLOBAL",
    subjectKey: GLOBAL_SUBJECT,
    attempts: LOGIN_GLOBAL_ATTEMPTS,
  }, now)
}

export async function clearLoginAccountThrottle(normalizedEmail: string) {
  await db.authThrottle.deleteMany({
    where: {
      scope: "LOGIN_ACCOUNT",
      subjectKey: hashLoginAccountSubject(normalizedEmail),
    },
  })
}
