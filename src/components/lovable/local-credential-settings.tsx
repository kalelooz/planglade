"use client"

import * as React from "react"
import Link from "next/link"

import { RecoveryCodesPanel } from "@/components/lovable/recovery-codes-panel"
import { useAuth } from "@/components/lovable/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/server-session-client"

type EnrollmentStatus = "loading" | "available" | "enrolled" | "unavailable" | "error"
const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/

function validRecoveryCodes(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length === 10 &&
    value.every((code) => typeof code === "string" && recoveryCodePattern.test(code))
}

export function LocalCredentialSettings() {
  const { signOut } = useAuth()
  const [status, setStatus] = React.useState<EnrollmentStatus>("loading")
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")
  const [codes, setCodes] = React.useState<string[]>([])

  React.useEffect(() => {
    let active = true
    void apiFetch("/api/auth/local-credential", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { status?: unknown } | null
        if (!active) return
        if (!response.ok || !payload) {
          setStatus("error")
          return
        }
        if (payload.status === "available" || payload.status === "enrolled" || payload.status === "unavailable") {
          setStatus(payload.status)
          return
        }
        setStatus("error")
      })
      .catch(() => {
        if (active) setStatus("error")
      })

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    const clearSensitiveState = () => {
      setPassword("")
      setConfirmation("")
      setCodes([])
    }
    window.addEventListener("pagehide", clearSensitiveState)
    return () => window.removeEventListener("pagehide", clearSensitiveState)
  }, [])

  const enroll = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    const passwordLength = [...password].length
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
      const response = await apiFetch("/api/auth/local-credential", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const payload = (await response.json().catch(() => null)) as { recoveryCodes?: unknown } | null
      if (!response.ok || !validRecoveryCodes(payload?.recoveryCodes)) {
        setError("Local sign-in could not be enrolled. Please try again.")
        return
      }
      setCodes(payload.recoveryCodes)
      setPassword("")
      setConfirmation("")
    } catch {
      setError("Local sign-in could not be enrolled. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (codes.length) {
    return (
      <RecoveryCodesPanel
        codes={codes}
        title="Local sign-in is ready"
        description="Save these new one-time recovery codes before signing in again. Any older recovery codes no longer work."
        continueLabel="I saved the codes — sign out"
        onContinue={async () => {
          try {
            await signOut("/login")
          } catch {
            window.location.assign("/login")
          }
        }}
      />
    )
  }

  if (status === "loading") {
    return <p className="text-[13px] text-muted-foreground" aria-live="polite">Checking local sign-in…</p>
  }
  if (status === "unavailable") {
    return <p className="text-[13px] text-muted-foreground">Local sign-in is disabled by this host.</p>
  }
  if (status === "error") {
    return <p className="text-[13px] text-destructive" role="alert">Local sign-in status could not be loaded.</p>
  }
  if (status === "enrolled") {
    return (
      <div className="max-w-md text-[13px] leading-5 text-muted-foreground">
        <p>Local email and password sign-in is enrolled for this owner account.</p>
        <Link href="/recover" className="mt-2 inline-flex font-medium text-foreground underline underline-offset-4">
          Change the password with a recovery code
        </Link>
      </div>
    )
  }

  return (
    <form className="grid max-w-sm gap-3" onSubmit={enroll} noValidate>
      <p className="text-[13px] leading-5 text-muted-foreground">
        Add a local password to this existing owner account. This does not create another user or workspace.
      </p>
      {error && <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
      <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="local-password">
        New password
      </label>
      <Input
        id="local-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        aria-describedby="local-password-help"
        required
      />
      <p id="local-password-help" className="text-xs text-muted-foreground">
        Use 15–128 characters. A password manager is recommended.
      </p>
      <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="local-password-confirmation">
        Confirm password
      </label>
      <Input
        id="local-password-confirmation"
        type="password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="new-password"
        required
      />
      <Button type="submit" className="mt-1 min-h-10 w-fit" disabled={submitting}>
        {submitting ? "Enrolling local sign-in…" : "Enroll local sign-in"}
      </Button>
    </form>
  )
}
