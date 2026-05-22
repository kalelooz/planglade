const mode = (process.env.FLOWBOARD_AUTH_MODE ?? "dev").toLowerCase()
const isProductionLike =
  process.env.NODE_ENV === "production" || process.env.CI === "true"

function fail(message) {
  console.error(`[auth-config] ${message}`)
  process.exit(1)
}

const validModes = new Set(["dev", "firebase", "nextauth"])
if (!validModes.has(mode)) {
  fail("FLOWBOARD_AUTH_MODE must be one of: dev, firebase, nextauth.")
}

if (!isProductionLike) {
  process.exit(0)
}

if (mode === "dev") {
  fail("FLOWBOARD_AUTH_MODE=dev is not allowed in production-like environments.")
}

if (mode === "firebase") {
  const required = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FLOWBOARD_AUTH_MODE",
  ]
  for (const key of required) {
    if (!process.env[key]) fail(`Missing required env var: ${key}`)
  }

  if (process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE?.toLowerCase() !== "firebase") {
    fail("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE must be 'firebase' when FLOWBOARD_AUTH_MODE=firebase.")
  }
}

if (mode === "nextauth") {
  if (!process.env.NEXTAUTH_SECRET) fail("Missing NEXTAUTH_SECRET for nextauth mode.")
  if (!process.env.NEXTAUTH_URL) fail("Missing NEXTAUTH_URL for nextauth mode.")
}
