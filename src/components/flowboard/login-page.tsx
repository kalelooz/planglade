"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Layers, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/flowboard/auth-context"

// ---------------------------------------------------------------------------
// Google "G" SVG logo
// ---------------------------------------------------------------------------

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

export function LoginPage() {
  const { signInWithGoogle, loading, authMode } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [signingIn, setSigningIn] = React.useState(false)
  const [signInError, setSignInError] = React.useState<string | null>(null)
  const nextPath = searchParams.get("next") || "/"

  const toFriendlySignInError = (error: unknown) => {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null

    if (!code) {
      return "Google sign-in failed. Please check Firebase Authentication settings."
    }

    if (code === "auth/unauthorized-domain") {
      return "Google sign-in blocked: this domain is not authorized in Firebase Auth."
    }
    if (code === "auth/operation-not-allowed") {
      return "Google sign-in is disabled in Firebase Auth provider settings."
    }
    if (code === "auth/popup-blocked") {
      return "Popup blocked by browser. Allow popups and try again."
    }
    if (code === "auth/popup-closed-by-user") {
      return "Sign-in popup was closed before completing login."
    }

    return `Google sign-in failed (${code}).`
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setSignInError(null)
    try {
      await signInWithGoogle(nextPath)
      if (authMode !== "nextauth") {
        router.replace(nextPath)
      }
    } catch (error) {
      setSignInError(toFriendlySignInError(error))
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-lg">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Layers className="size-8 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">PlanGlade</h1>
              <p className="text-sm text-muted-foreground mt-1">
                A calm clearing for your projects.
              </p>
            </div>
          </div>

          {/* Sign-in heading */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {authMode === "nextauth"
                  ? "Sign in with your provider to continue"
                  : "Sign in to your account to continue"}
              </p>
            </div>

          {/* Google Sign-in Button */}
          <Button
            variant="outline"
            className="w-full h-12 gap-3 text-sm font-medium relative"
            onClick={handleGoogleSignIn}
            disabled={signingIn || loading}
          >
            {signingIn ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <GoogleLogo className="size-5" />
            )}
            {signingIn ? "Signing in..." : "Continue with Google"}
          </Button>
          {signInError && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {signInError}
            </p>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email placeholder (disabled — for future Firebase Auth) */}
          <Button
            variant="secondary"
            className="w-full h-12 gap-2 text-sm"
            disabled
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Sign in with email (coming soon)
          </Button>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
            By signing in, you agree to our{" "}
            <span className="underline cursor-pointer">Terms of Service</span>{" "}
            and{" "}
            <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>

        {/* Bottom tagline */}
        <p className="text-xs text-muted-foreground/60 text-center mt-6">
          Sign in with your Google account to continue to PlanGlade
        </p>
      </motion.div>
    </div>
  )
}
