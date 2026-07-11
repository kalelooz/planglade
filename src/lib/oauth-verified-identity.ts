import { normalizeEmail } from "@/lib/local-auth-email"

const GITHUB_EMAILS_URL = "https://api.github.com/user/emails?per_page=100"
const GITHUB_EMAIL_TIMEOUT_MS = 5_000

type OAuthUser = {
  email?: string | null
  name?: string | null
  image?: string | null
}

type OAuthAccount = {
  provider?: string
  access_token?: string | null
} | null

type OAuthIdentityInput = {
  user: OAuthUser
  account: OAuthAccount
  profile?: unknown
}

type OAuthVerificationOptions = {
  fetch?: typeof fetch
}

export type VerifiedOAuthIdentity = {
  email: string
  name: string | null
  image: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function resolvedIdentity(email: string, user: OAuthUser): VerifiedOAuthIdentity {
  return { email: email.trim(), name: user.name ?? null, image: user.image ?? null }
}

async function resolveVerifiedGitHubIdentity(
  user: OAuthUser,
  account: OAuthAccount,
  fetchImpl: typeof fetch
): Promise<VerifiedOAuthIdentity | null> {
  const accessToken = account?.access_token
  const normalizedUserEmail = normalizeEmail(user.email)
  if (!accessToken || !normalizedUserEmail) return null

  try {
    const response = await fetchImpl(GITHUB_EMAILS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(GITHUB_EMAIL_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const payload: unknown = await response.json()
    if (!Array.isArray(payload) || !payload.every(isRecord)) return null
    const emails = payload.map((entry) => ({
      email: typeof entry.email === "string" ? entry.email : null,
      verified: entry.verified,
    }))
    if (emails.some((entry) => !normalizeEmail(entry.email) || typeof entry.verified !== "boolean")) return null

    const matchingEmails = emails.filter((entry) => normalizeEmail(entry.email) === normalizedUserEmail)
    if (matchingEmails.length !== 1 || matchingEmails[0].verified !== true) return null
    return resolvedIdentity(matchingEmails[0].email!, user)
  } catch {
    return null
  }
}

export async function resolveVerifiedOAuthIdentity(
  { user, account, profile }: OAuthIdentityInput,
  { fetch: fetchImpl = fetch }: OAuthVerificationOptions = {}
): Promise<VerifiedOAuthIdentity | null> {
  if (account?.provider === "google") {
    if (!isRecord(profile) || profile.email_verified !== true || typeof profile.email !== "string") return null
    const normalizedProfileEmail = normalizeEmail(profile.email)
    const normalizedUserEmail = normalizeEmail(user.email)
    if (!normalizedProfileEmail || normalizedProfileEmail !== normalizedUserEmail) return null
    return resolvedIdentity(profile.email, user)
  }

  if (account?.provider === "github") {
    return resolveVerifiedGitHubIdentity(user, account, fetchImpl)
  }

  return null
}
