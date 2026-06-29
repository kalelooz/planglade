function readPlanGladeEnv(name) {
  return process.env[`PLANGLADE_${name}`] ?? process.env[`FLOWBOARD_${name}`]
}

function readPublicPlanGladeEnv(name) {
  return process.env[`NEXT_PUBLIC_PLANGLADE_${name}`] ?? process.env[`NEXT_PUBLIC_FLOWBOARD_${name}`]
}

const mode = (readPlanGladeEnv("AUTH_MODE") ?? "dev").toLowerCase()
const isProductionLike =
  process.env.NODE_ENV === "production" || process.env.CI === "true"
const storageProvider = (
  readPlanGladeEnv("STORAGE_PROVIDER") ??
  (isProductionLike ? "firebase" : "local")
).toLowerCase()
const emailProvider = (
  readPlanGladeEnv("EMAIL_PROVIDER") ??
  (isProductionLike ? "disabled" : "console")
).toLowerCase()

function fail(message) {
  console.error(`[auth-config] ${message}`)
  process.exit(1)
}

const validModes = new Set(["dev", "firebase", "nextauth"])
if (!validModes.has(mode)) {
  fail("PLANGLADE_AUTH_MODE must be one of: dev, firebase, nextauth.")
}

const validStorageProviders = new Set(["firebase", "local"])
if (!validStorageProviders.has(storageProvider)) {
  fail("PLANGLADE_STORAGE_PROVIDER must be one of: firebase, local.")
}

const validEmailProviders = new Set(["resend", "console", "disabled"])
if (!validEmailProviders.has(emailProvider)) {
  fail("PLANGLADE_EMAIL_PROVIDER must be one of: resend, console, disabled.")
}

if (emailProvider === "resend") {
  if (!process.env.RESEND_API_KEY) fail("Missing RESEND_API_KEY for resend email provider.")
  if (!readPlanGladeEnv("EMAIL_FROM")) {
    fail("Missing PLANGLADE_EMAIL_FROM for resend email provider.")
  }
}

if (!isProductionLike) {
  process.exit(0)
}

if (mode === "dev") {
  fail("PLANGLADE_AUTH_MODE=dev is not allowed in production-like environments.")
}

if (mode === "firebase") {
  const required = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ]
  for (const key of required) {
    if (!process.env[key]) fail(`Missing required env var: ${key}`)
  }

  if (!readPublicPlanGladeEnv("AUTH_MODE")) {
    fail("Missing required env var: NEXT_PUBLIC_PLANGLADE_AUTH_MODE")
  }

  if (readPublicPlanGladeEnv("AUTH_MODE")?.toLowerCase() !== "firebase") {
    fail("NEXT_PUBLIC_PLANGLADE_AUTH_MODE must be 'firebase' when PLANGLADE_AUTH_MODE=firebase.")
  }
}

if (mode === "nextauth") {
  if (!process.env.NEXTAUTH_SECRET) fail("Missing NEXTAUTH_SECRET for nextauth mode.")
  if (!process.env.NEXTAUTH_URL) fail("Missing NEXTAUTH_URL for nextauth mode.")
}

if (storageProvider === "local") {
  fail("PLANGLADE_STORAGE_PROVIDER=local is not allowed in production-like environments.")
}

if (storageProvider === "firebase") {
  if (!process.env.FIREBASE_PROJECT_ID) fail("Missing FIREBASE_PROJECT_ID for firebase storage provider.")
  if (!process.env.FIREBASE_STORAGE_BUCKET) fail("Missing FIREBASE_STORAGE_BUCKET for firebase storage provider.")
}
