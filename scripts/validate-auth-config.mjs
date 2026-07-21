const mode = (process.env.FLOWBOARD_AUTH_MODE ?? "dev").toLowerCase()
const isProductionLike =
  process.env.NODE_ENV === "production" || process.env.CI === "true"
const storageProvider = (
  process.env.FLOWBOARD_STORAGE_PROVIDER ??
  "local"
).toLowerCase()

function fail(message) {
  console.error(`[auth-config] ${message}`)
  process.exit(1)
}

const validModes = new Set(["dev", "firebase", "nextauth"])
if (!validModes.has(mode)) {
  fail("FLOWBOARD_AUTH_MODE must be one of: dev, firebase, nextauth.")
}

const validStorageProviders = new Set(["firebase", "local"])
if (!validStorageProviders.has(storageProvider)) {
  fail("FLOWBOARD_STORAGE_PROVIDER must be one of: firebase, local.")
}

if (!isProductionLike) {
  process.exit(0)
}

if (mode === "dev") {
  fail("FLOWBOARD_AUTH_MODE=dev is not allowed in production-like environments.")
}

if (process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE?.toLowerCase() !== mode) {
  fail("FLOWBOARD_AUTH_MODE and NEXT_PUBLIC_FLOWBOARD_AUTH_MODE must match.")
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

}

if (mode === "nextauth") {
  if (!process.env.NEXTAUTH_SECRET) fail("Missing NEXTAUTH_SECRET for nextauth mode.")
  if (!process.env.NEXTAUTH_URL) fail("Missing NEXTAUTH_URL for nextauth mode.")
}

if (storageProvider === "local" && !process.env.FLOWBOARD_STORAGE_SIGNING_SECRET && !process.env.NEXTAUTH_SECRET) {
  fail("Missing FLOWBOARD_STORAGE_SIGNING_SECRET or NEXTAUTH_SECRET for local storage provider.")
}

if (storageProvider === "firebase") {
  if (!process.env.FIREBASE_PROJECT_ID) fail("Missing FIREBASE_PROJECT_ID for firebase storage provider.")
  if (!process.env.FIREBASE_STORAGE_BUCKET) fail("Missing FIREBASE_STORAGE_BUCKET for firebase storage provider.")
}
