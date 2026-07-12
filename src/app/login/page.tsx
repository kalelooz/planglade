import { Suspense } from "react"

import { LoginPage } from "@/components/lovable/login-page"
import { readPlanGladeEnv, readPublicPlanGladeEnv } from "@/lib/env-config"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"

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

export default function PlanGladeLoginRoute() {
  const authMode = (
    readPublicPlanGladeEnv("AUTH_MODE") ??
    readPlanGladeEnv("AUTH_MODE") ??
    "dev"
  ).toLowerCase()
  const providerCapabilities = getProviderCapabilities()
  const googleSignInAvailable =
    (authMode === "firebase" && hasFirebaseGoogleConfig()) ||
    (authMode === "nextauth" && providerCapabilities.google)

  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage
        googleSignInAvailable={googleSignInAvailable}
        localCredentialsAvailable={authMode === "nextauth" && providerCapabilities.localCredentials}
      />
    </Suspense>
  )
}
