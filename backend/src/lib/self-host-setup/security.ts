import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const CLAIM_COOKIE = "planglade-setup-claim"
export const CSRF_COOKIE = "planglade-setup-csrf"
export const CLAIM_PATH = "/api/auth/setup"
export const CSRF_PATH = "/"
export const CLAIM_SECONDS = 15 * 60

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function sha256Base64url(value: string) {
  return createHash("sha256").update(value).digest("base64url")
}

export function fixedDigestEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest()
  const b = createHash("sha256").update(right).digest()
  return timingSafeEqual(a, b)
}

export function authorizeSetupToken(submitted: unknown, configured: string | undefined) {
  const validSubmitted = typeof submitted === "string" && /^[0-9a-fA-F]{64}$/.test(submitted)
  const validConfigured = typeof configured === "string" && /^[0-9a-fA-F]{64}$/.test(configured)
  return fixedDigestEqual(validSubmitted ? submitted : "", validConfigured ? configured! : "") && validSubmitted && validConfigured
}

export function createClaim() {
  const secret = randomBytes(32).toString("base64url")
  return { secret, digest: sha256Hex(secret) }
}

export function canonicalOrigin(configured = process.env.NEXTAUTH_URL) {
  try {
    if (!configured) return null
    const url = new URL(configured)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null
    return url
  } catch {
    return null
  }
}

export function validateSetupRequest(request: Request, requireOrigin: boolean) {
  const canonical = canonicalOrigin()
  if (!canonical || request.headers.get("host") !== canonical.host) return false
  return !requireOrigin || request.headers.get("origin") === canonical.origin
}

function csrfSignature(payload: string, key: string) {
  return createHmac("sha256", key).update("planglade:setup-csrf:v1\0").update(payload).digest("base64url")
}

export function createCsrfToken(purpose: "claim" | "complete", key: string, binding = "-", now = Date.now()) {
  const parts = ["v1", purpose, String(Math.floor(now / 1000) + CLAIM_SECONDS), randomBytes(32).toString("base64url"), binding]
  const payload = parts.join(".")
  return `${payload}.${csrfSignature(payload, key)}`
}

export function validateCsrfToken(
  token: string | undefined,
  header: string | null,
  purpose: "claim" | "complete",
  key: string,
  binding = "-",
  now = Date.now(),
) {
  if (!token || token !== header) return false
  const parts = token.split(".")
  if (parts.length !== 6 || parts[0] !== "v1" || parts[1] !== purpose || parts[4] !== binding || !/^[A-Za-z0-9_-]{43}$/.test(parts[3])) return false
  if (!/^\d+$/.test(parts[2]) || Number(parts[2]) < Math.floor(now / 1000)) return false
  const payload = parts.slice(0, 5).join(".")
  return fixedDigestEqual(parts[5], csrfSignature(payload, key))
}

export function cookieOptions(path: string, httpOnly: boolean, clear = false) {
  const secure = canonicalOrigin()?.protocol === "https:"
  return {
    path,
    httpOnly,
    sameSite: "strict" as const,
    secure,
    maxAge: clear ? 0 : CLAIM_SECONDS,
    ...(clear ? { expires: new Date(0) } : {}),
  }
}

export function readCookie(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length)
}

export function recoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(16).toString("hex").match(/.{4}/g)!.join("-"))
}

export function normalizeRecoveryCode(code: string) {
  const normalized = code.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "").replace(/-/g, "").toLowerCase()
  return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null
}
