import { Suspense } from "react"

import { LoginPage } from "@/components/lovable/login-page"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { readPlanGladeEnv, readPublicPlanGladeEnv } from "@/lib/env-config"

export const dynamic = "force-dynamic"

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
    readPublicPlanGladeEnv("AUTH_MODE") ??
    readPlanGladeEnv("AUTH_MODE") ??
    "dev"
  ).toLowerCase()
  const googleSignInAvailable =
    (authMode === "firebase" && hasFirebaseGoogleConfig()) ||
    (authMode === "nextauth" && hasNextAuthGoogleConfig())
  const localCredentialsAvailable =
    authMode === "nextauth" && getProviderCapabilities().localCredentials

  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage
        googleSignInAvailable={googleSignInAvailable}
        localCredentialsAvailable={localCredentialsAvailable}
      />
    </Suspense>
  )
}
