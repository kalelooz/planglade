import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { AuthThrottleScope, Prisma, PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"

const RUNTIME_DEVELOPMENT_SECRET = randomBytes(32).toString("hex")
const CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let nextCleanupAt = 0

export type ThrottlePolicy = {
  limit: number
  windowMs: number
  blockMs: number
}

export const LOGIN_ACCOUNT_POLICY = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} satisfies ThrottlePolicy

export const LOGIN_GLOBAL_POLICY = {
  limit: 120,
  windowMs: 60 * 1000,
  blockMs: 30 * 1000,
} satisfies ThrottlePolicy

export const SETUP_POLICY = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} satisfies ThrottlePolicy

export const WORKSPACE_OPERATION_POLICIES = {
  "invite-create": { limit: 50, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  "invite-test-send": { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  "import-preview": { limit: 20, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 },
  import: { limit: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  export: { limit: 10, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  "attachment-finalize": { limit: 30, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 },
  "attachment-upload-url": { limit: 30, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 },
  "attachment-download-url": { limit: 60, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 },
  "attachment-upload-binary": { limit: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 },
} satisfies Record<string, ThrottlePolicy>

export type WorkspaceThrottleOperation = keyof typeof WORKSPACE_OPERATION_POLICIES
export type ThrottleResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

function throttleSecret() {
  const configured = process.env.PLANGLADE_THROTTLE_SECRET ?? process.env.NEXTAUTH_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("Persistent abuse controls require NEXTAUTH_SECRET or PLANGLADE_THROTTLE_SECRET")
  }
  return RUNTIME_DEVELOPMENT_SECRET
}

export function deriveThrottleSubjectKey(
  scope: AuthThrottleScope,
  parts: readonly string[],
  secret = throttleSecret(),
) {
  const hmac = createHmac("sha256", secret).update(`planglade:auth-throttle:v1\0${scope}\0`)
  for (const part of parts) {
    hmac.update(`${Buffer.byteLength(part, "utf8")}:`).update(part).update("\0")
  }
  return hmac.digest("hex")
}

type ThrottleRow = {
  blockedUntil: Date | string | null
}

export async function consumeThrottle(
  input: {
    scope: AuthThrottleScope
    subject: readonly string[]
    policy: ThrottlePolicy
    cost?: number
    now?: Date
  },
  client: PrismaClient = db,
): Promise<ThrottleResult> {
  const cost = input.cost ?? 1
  if (!Number.isInteger(cost) || cost < 1 || cost > input.policy.limit) {
    throw new Error("Invalid throttle cost")
  }

  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const windowStartIso = new Date(now.getTime() - input.policy.windowMs).toISOString()
  const blockUntilIso = new Date(now.getTime() + input.policy.blockMs).toISOString()
  const subjectKey = deriveThrottleSubjectKey(input.scope, input.subject)

  if (now.getTime() >= nextCleanupAt) {
    await client.authThrottle.deleteMany({
      where: {
        windowStartedAt: { lt: new Date(now.getTime() - CLEANUP_RETENTION_MS) },
        OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
      },
    })
    nextCleanupAt = now.getTime() + CLEANUP_INTERVAL_MS
  }

  const rows = await client.$queryRaw<ThrottleRow[]>(Prisma.sql`
    INSERT INTO "AuthThrottle" (
      "id", "scope", "subjectKey", "windowStartedAt", "attemptCount", "blockedUntil", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${input.scope}, ${subjectKey}, ${nowIso}, ${cost}, NULL, ${nowIso}, ${nowIso}
    )
    ON CONFLICT("scope", "subjectKey") DO UPDATE SET
      "windowStartedAt" = CASE
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          AND julianday("AuthThrottle"."blockedUntil") > julianday(${nowIso})
          THEN "AuthThrottle"."windowStartedAt"
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          OR julianday("AuthThrottle"."windowStartedAt") <= julianday(${windowStartIso})
          THEN ${nowIso}
        ELSE "AuthThrottle"."windowStartedAt"
      END,
      "attemptCount" = CASE
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          AND julianday("AuthThrottle"."blockedUntil") > julianday(${nowIso})
          THEN "AuthThrottle"."attemptCount"
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          OR julianday("AuthThrottle"."windowStartedAt") <= julianday(${windowStartIso})
          THEN ${cost}
        WHEN "AuthThrottle"."attemptCount" + ${cost} <= ${input.policy.limit}
          THEN "AuthThrottle"."attemptCount" + ${cost}
        ELSE "AuthThrottle"."attemptCount"
      END,
      "blockedUntil" = CASE
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          AND julianday("AuthThrottle"."blockedUntil") > julianday(${nowIso})
          THEN "AuthThrottle"."blockedUntil"
        WHEN "AuthThrottle"."blockedUntil" IS NOT NULL
          OR julianday("AuthThrottle"."windowStartedAt") <= julianday(${windowStartIso})
          THEN NULL
        WHEN "AuthThrottle"."attemptCount" + ${cost} > ${input.policy.limit}
          THEN ${blockUntilIso}
        ELSE NULL
      END,
      "updatedAt" = ${nowIso}
    RETURNING "blockedUntil"
  `)

  const blockedUntil = rows[0]?.blockedUntil ? new Date(rows[0].blockedUntil) : null
  if (!blockedUntil || blockedUntil.getTime() <= now.getTime()) return { allowed: true }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)),
  }
}

export async function consumeLoginThrottle(account: string, client?: PrismaClient, now?: Date) {
  const global = await consumeThrottle(
    { scope: "LOGIN_GLOBAL", subject: ["credentials"], policy: LOGIN_GLOBAL_POLICY, now },
    client,
  )
  if (!global.allowed) return global
  return consumeThrottle(
    { scope: "LOGIN_ACCOUNT", subject: [account], policy: LOGIN_ACCOUNT_POLICY, now },
    client,
  )
}

export function consumeSetupThrottle(
  operation: "claim" | "complete",
  claimant?: string,
  client?: PrismaClient,
  now?: Date,
) {
  if (operation === "complete" && !claimant) throw new Error("Setup claimant is required")
  return consumeThrottle(
    {
      scope: "SETUP",
      subject: operation === "claim" ? [operation] : [operation, claimant!],
      policy: SETUP_POLICY,
      now,
    },
    client,
  )
}

export function consumeWorkspaceThrottle(
  operation: WorkspaceThrottleOperation,
  actorUserId: string,
  workspaceId: string,
  cost = 1,
  client?: PrismaClient,
  now?: Date,
) {
  return consumeThrottle(
    {
      scope: "WORKSPACE_OPERATION",
      subject: [operation, actorUserId, workspaceId],
      policy: WORKSPACE_OPERATION_POLICIES[operation],
      cost,
      now,
    },
    client,
  )
}

export function consumeSignedUploadThrottle(
  storageKey: string,
  client?: PrismaClient,
  now?: Date,
) {
  const workspaceId = storageKey.split("/", 1)[0] ?? ""
  return consumeThrottle(
    {
      scope: "WORKSPACE_OPERATION",
      subject: ["attachment-upload-binary", workspaceId, storageKey],
      policy: WORKSPACE_OPERATION_POLICIES["attachment-upload-binary"],
      now,
    },
    client,
  )
}

export function tooManyRequests(result: Extract<ThrottleResult, { allowed: false }>) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  )
}
