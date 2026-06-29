import { randomBytes } from "node:crypto"

type InviteLike = {
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED"
  expiresAt: Date
}

export const DEFAULT_INVITE_EXPIRY_DAYS = 7

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase()
}

export function buildInviteToken() {
  return randomBytes(24).toString("hex")
}

export function buildInviteExpiry(expiresInDays = DEFAULT_INVITE_EXPIRY_DAYS) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  return expiresAt
}

export function resolveInviteStatus(invite: InviteLike, now = new Date()) {
  if (invite.status !== "PENDING") return invite.status
  return invite.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "PENDING"
}
