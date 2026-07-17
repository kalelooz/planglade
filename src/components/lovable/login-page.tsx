"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn as nextAuthSignIn } from "next-auth/react"
import { ArrowLeft, ArrowRight, CheckSquare, Database, Inbox, ListTodo, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/lovable/auth-context"
import { buildSessionAuthHeaders } from "@/lib/server-session-client"

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

function safeInternalPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/app"
  try {
    const base = new URL("https://planglade.invalid")
    const target = new URL(value, base)
    return target.origin === base.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/app"
  } catch {
    return "/app"
  }
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

export function LoginPage({
  googleSignInAvailable,
  localCredentialsAvailable,
}: {
  googleSignInAvailable: boolean
  localCredentialsAvailable: boolean
}) {
  const { user, signInWithGoogle, loading, authMode } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [signingIn, setSigningIn] = React.useState(false)
  const [credentialsSigningIn, setCredentialsSigningIn] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [signInError, setSignInError] = React.useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = React.useState<string | null>(null)
  const [inviteAccepting, setInviteAccepting] = React.useState(false)
  const [setupAvailable, setSetupAvailable] = React.useState(false)
  const nextPath = safeInternalPath(searchParams.get("next"))
  const inviteToken = searchParams.get("inviteToken")
  const autoAccept = searchParams.get("autoAccept") === "1"
  const usesDevSession = authMode === "dev"
  const callbackPath =
    authMode === "nextauth" && inviteToken
      ? `/login?inviteToken=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(nextPath)}&autoAccept=1`
      : nextPath

  React.useEffect(() => {
    const clearPassword = () => setPassword("")
    window.addEventListener("pagehide", clearPassword)
    return () => window.removeEventListener("pagehide", clearPassword)
  }, [])

  React.useEffect(() => {
    if (process.env.PLANGLADE_BUILD_DEMO_READ_ONLY === "true") return

    let cancelled = false

    void fetch("/api/auth/setup", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as { status?: unknown }
      })
      .then((payload) => {
        if (!cancelled) {
          setSetupAvailable(
            payload !== null &&
            typeof payload === "object" &&
            Object.keys(payload).length === 1 &&
            payload.status === "available"
          )
        }
      })
      .catch(() => {
        if (!cancelled) setSetupAvailable(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

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
    if (!googleSignInAvailable) {
      if (usesDevSession) {
        router.replace(nextPath)
      }
      return
    }

    setSigningIn(true)
    setSignInError(null)
    try {
      await signInWithGoogle(callbackPath)
      if (authMode !== "nextauth") {
        if (!inviteToken) {
          router.replace(nextPath)
        }
      }
    } catch (error) {
      setSignInError(toFriendlySignInError(error))
    } finally {
      setSigningIn(false)
    }
  }

  const handleCredentialSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCredentialsSigningIn(true)
    setSignInError(null)
    try {
      const result = await nextAuthSignIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackPath,
      })
      if (!result?.ok || result.error) {
        setSignInError("Email or password is incorrect.")
        return
      }
      const target = new URL(result.url ?? callbackPath, window.location.origin)
      window.location.assign(
        target.origin === window.location.origin
          ? `${target.pathname}${target.search}${target.hash}`
          : callbackPath,
      )
    } catch {
      setSignInError("Email or password is incorrect.")
    } finally {
      setPassword("")
      setCredentialsSigningIn(false)
    }
  }

  React.useEffect(() => {
    if (!inviteToken) return
    if (authMode === "nextauth" && !autoAccept) return
    if (authMode !== "nextauth" && !user) return

    let cancelled = false

    const acceptInvite = async () => {
      setInviteAccepting(true)
      setInviteNotice(null)
      try {
        const headers = await buildSessionAuthHeaders()
        const response = await fetch("/api/workspace/invitations/accept", {
          method: "POST",
          headers: {
            ...headers,
            "content-type": "application/json",
          },
          body: JSON.stringify({ token: inviteToken }),
        })

        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          if (response.status === 403 && payload.error?.toLowerCase().includes("authentication")) {
            return
          }
          setInviteNotice(payload.error ?? "Invite could not be accepted.")
          return
        }

        if (!cancelled) {
          setInviteNotice("Invite accepted. Redirecting...")
          router.replace(nextPath)
        }
      } catch {
        if (!cancelled) setInviteNotice("Invite could not be accepted right now.")
      } finally {
        if (!cancelled) setInviteAccepting(false)
      }
    }

    void acceptInvite()
    return () => {
      cancelled = true
    }
  }, [authMode, autoAccept, inviteToken, nextPath, router, user])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-100 text-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(161,161,170,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(161,161,170,0.12)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(24,24,27,0.12)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="flex min-w-0 flex-col p-6 sm:p-10 lg:min-h-[650px] lg:p-12">
            <Link
              href="/landing"
              className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4"
              aria-label="PlanGlade landing page"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                <CheckSquare className="size-4" aria-hidden="true" />
              </span>
              PlanGlade
            </Link>

            <div className="my-auto w-full max-w-sm py-10 sm:py-14 lg:py-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Sign in
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                  Welcome back
                </h1>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Capture work, organize projects, and keep notes close.
                </p>
              </div>

              <div className="mt-8">
                {localCredentialsAvailable && (
                  <form className="grid gap-3" onSubmit={handleCredentialSignIn} noValidate>
                    <label className="text-sm font-medium text-zinc-900" htmlFor="login-email">Email</label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      maxLength={320}
                      required
                    />
                    <label className="text-sm font-medium text-zinc-900" htmlFor="login-password">Password</label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="submit"
                      className="mt-1 h-11 w-full bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
                      disabled={credentialsSigningIn || signingIn || loading}
                    >
                      {credentialsSigningIn ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                      {credentialsSigningIn ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                )}

                {localCredentialsAvailable && googleSignInAvailable && (
                  <div className="my-5 flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-zinc-200" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">or</span>
                    <span className="h-px flex-1 bg-zinc-200" />
                  </div>
                )}

                {googleSignInAvailable ? (
                  <Button
                    variant="outline"
                    className="relative h-11 w-full gap-3 border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    onClick={handleGoogleSignIn}
                    disabled={signingIn || credentialsSigningIn || loading}
                  >
                    {signingIn ? (
                      <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <GoogleLogo className="size-5" />
                    )}
                    {signingIn ? "Signing in..." : "Continue with Google"}
                  </Button>
                ) : !localCredentialsAvailable && usesDevSession ? (
                  <Button
                    className="h-11 w-full gap-2 bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    Continue to workspace
                    <ArrowRight className="size-4" />
                  </Button>
                ) : !localCredentialsAvailable ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Sign-in is not configured for this environment.
                  </div>
                ) : null}
                {signInError && (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {signInError}
                  </p>
                )}
                {inviteToken && (
                  <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {inviteAccepting
                      ? "Accepting invite..."
                      : inviteNotice ??
                        (googleSignInAvailable || localCredentialsAvailable
                          ? "Sign in to accept your workspace invite."
                          : "This invite needs a configured sign-in provider.")}
                  </p>
                )}

                <p className="mt-5 text-xs leading-5 text-zinc-500">
                  {localCredentialsAvailable && googleSignInAvailable
                    ? "Use your local owner credentials or Google account. Your projects stay scoped to your workspace."
                    : localCredentialsAvailable
                      ? "Use your local owner credentials. Password recovery uses a saved code or a host-issued one-time link—not email."
                      : googleSignInAvailable
                        ? "Use your Google account to continue. Your projects stay scoped to your workspace."
                    : usesDevSession
                      ? "Local development uses the existing dev workspace session. No email or password login is enabled here."
                      : "Ask the workspace owner to configure Google sign-in before continuing."}
                </p>
                {localCredentialsAvailable && (
                  <Link
                    href="/recover"
                    className="mt-3 inline-flex text-xs font-medium text-zinc-600 underline underline-offset-4 outline-none hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                  >
                    Use a recovery code
                  </Link>
                )}
                {setupAvailable && (
                  <Link
                    href="/setup"
                    className="mt-3 inline-flex text-xs font-medium text-zinc-600 underline underline-offset-4 outline-none hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
                  >
                    Set up this self-hosted installation
                  </Link>
                )}
              </div>
            </div>

            <Link
              href="/landing"
              className="inline-flex w-fit items-center gap-2 rounded-md text-xs font-medium text-zinc-500 outline-none transition hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to PlanGlade
            </Link>
          </section>

          <aside
            aria-labelledby="onboarding-title"
            className="relative min-w-0 overflow-hidden border-t border-zinc-200 bg-zinc-950 p-6 text-white sm:p-10 lg:min-h-[650px] lg:border-l lg:border-t-0 lg:p-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.13),transparent_34%),linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_50%)]"
            />
            <div className="relative flex h-full flex-col">
              <div className="max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  A calmer first step
                </p>
                <h2 id="onboarding-title" className="mt-3 text-2xl font-semibold tracking-tight">
                  Start with the work in front of you.
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  PlanGlade keeps capture, planning, and project context in one honest workspace.
                </p>
              </div>

              <div className="mt-8 grid gap-3 lg:mt-auto">
                <article className="rounded-xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-zinc-100">
                      <Inbox className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">Capture first</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        Drop ideas into Inbox before they disappear.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-zinc-100">
                      <ListTodo className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">One task, many views</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        Tasks can appear in list, board, and calendar without duplicate records.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-zinc-100">
                      <Database className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">Own your workspace</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">
                        Open source, self-hostable, and built to stay honest.
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
