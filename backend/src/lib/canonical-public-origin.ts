import { evaluateCanonicalPublicUrl } from "@/lib/production-config.mjs"

export function getCanonicalPublicOrigin() {
  const result = evaluateCanonicalPublicUrl(process.env.NEXTAUTH_URL)
  if (!result.origin) {
    throw new Error(result.errors[0] ?? "NEXTAUTH_URL is invalid")
  }
  return result.origin
}
