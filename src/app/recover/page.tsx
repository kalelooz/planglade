"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, CheckSquare } from "lucide-react"

import { RecoveryCodesPanel } from "@/components/lovable/recovery-codes-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/

function validRecoveryCodes(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length === 10 &&
    value.every((code) => typeof code === "string" && recoveryCodePattern.test(code))
}

export default function RecoveryPage() {
  const [secret, setSecret] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [fragmentLoaded, setFragmentLoaded] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")
  const [codes, setCodes] = React.useState<string[]>([])

  React.useEffect(() => {
    const fragment = window.location.hash.slice(1)
    if (fragment && fragment.length <= 128) {
      setSecret(fragment)
      setFragmentLoaded(true)
    }
    if (fragment) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
    }

    const clearSensitiveState = () => {
      setSecret("")
      setPassword("")
      setConfirmation("")
      setCodes([])
    }
    window.addEventListener("pagehide", clearSensitiveState)
    return () => window.removeEventListener("pagehide", clearSensitiveState)
  }, [])

  const recover = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    const passwordLength = [...password].length
    if (!secret.trim()) {
      setError("Enter a recovery code or open a one-time recovery link.")
      return
    }
    if (passwordLength < 15 || passwordLength > 128) {
      setError("Use a password between 15 and 128 characters.")
      return
    }
    if (password !== confirmation) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, password }),
      })
      const payload = (await response.json().catch(() => null)) as { recoveryCodes?: unknown } | null
      if (!response.ok || !validRecoveryCodes(payload?.recoveryCodes)) {
        setError(response.status === 429
          ? "Too many recovery attempts. Wait before trying again."
          : "Recovery code or link is invalid or expired.")
        return
      }
      setCodes(payload.recoveryCodes)
      setSecret("")
      setPassword("")
      setConfirmation("")
    } catch {
      setError("Recovery is temporarily unavailable. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-100 px-4 py-8 text-zinc-950 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(161,161,170,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(161,161,170,0.12)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
      />
      <div className="relative mx-auto w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(24,24,27,0.10)] sm:p-10">
        <Link
          href="/login"
          className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4"
        >
          <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
            <CheckSquare className="size-4" aria-hidden="true" />
          </span>
          PlanGlade
        </Link>

        {codes.length ? (
          <div className="mt-8">
            <RecoveryCodesPanel
              codes={codes}
              title="Password changed"
              description="Save these replacement recovery codes now. The code or one-time link you used, and all older codes, no longer work."
              continueLabel="I saved the codes — continue to login"
              onContinue={() => window.location.assign("/login")}
            />
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Account recovery</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Set a new password</h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                PlanGlade does not send password-reset email. Use one of your saved recovery codes or a one-time link from the host administrator.
              </p>
            </div>

            <form className="mt-8 grid gap-4" onSubmit={recover} noValidate>
              {fragmentLoaded && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
                  One-time recovery access loaded. The secret has been removed from the address bar.
                </p>
              )}
              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <label className="grid gap-1.5 text-sm font-medium" htmlFor="recovery-secret">
                Recovery code or one-time token
              </label>
              <Input
                id="recovery-secret"
                type="password"
                value={secret}
                onChange={(event) => {
                  setSecret(event.target.value)
                  setFragmentLoaded(false)
                }}
                autoComplete="off"
                spellCheck={false}
                maxLength={128}
                required
              />
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="recovery-password">
                New password
              </label>
              <Input
                id="recovery-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                aria-describedby="recovery-password-help"
                required
              />
              <p id="recovery-password-help" className="text-xs text-zinc-500">
                Use 15–128 characters. A password manager is recommended.
              </p>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="recovery-confirmation">
                Confirm password
              </label>
              <Input
                id="recovery-confirmation"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                required
              />
              <Button type="submit" className="mt-1 min-h-11" disabled={submitting}>
                {submitting ? "Changing password…" : "Change password"}
              </Button>
            </form>

            <div className="mt-7 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">
              <p>Host administrators can create a 15-minute link with:</p>
              <code className="mt-2 block max-w-full overflow-x-auto whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-2 text-zinc-700">
                npm run auth:create-recovery-link -- owner@example.com
              </code>
            </div>
          </>
        )}

        <Link
          href="/login"
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md text-xs font-medium text-zinc-500 outline-none hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to login
        </Link>
      </div>
    </main>
  )
}
