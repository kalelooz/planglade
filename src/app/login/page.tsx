import { Suspense } from "react"

import { LoginPage } from "@/components/lovable/login-page"

function LoginPageFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading sign-in...</div>
}

function hasFirebaseGoogleConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  )
}

function hasNextAuthGoogleConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export default function PlanGladeLoginRoute() {
  const authMode = (
    process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE ??
    process.env.FLOWBOARD_AUTH_MODE ??
    "dev"
  ).toLowerCase()
  const googleSignInAvailable =
    (authMode === "firebase" && hasFirebaseGoogleConfig()) ||
    (authMode === "nextauth" && hasNextAuthGoogleConfig())

  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage googleSignInAvailable={googleSignInAvailable} />
    </Suspense>
  )
}
