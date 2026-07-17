"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckSquare, Copy, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizeEmail } from "@/lib/local-auth-email"

type SetupScreen = "checking" | "authorize" | "details" | "recovery" | "unavailable" | "temporary" | "completion-lost"
type OwnerField = "name" | "email" | "password" | "confirmation" | "workspaceName"
type OwnerErrors = Partial<Record<OwnerField, string>>

const csrfCookieName = "planglade-setup-csrf"
const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/
const demoReadOnlyDeployment = process.env.PLANGLADE_BUILD_DEMO_READ_ONLY === "true"

function readCsrfCookie() {
  const prefix = `${csrfCookieName}=`
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
  return value ?? null
}

function exactSetupStatus(value: unknown, status: "available" | "unavailable") {
  return value !== null && typeof value === "object" && Object.keys(value).length === 1 && "status" in value && value.status === status
}

function SetupFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-100 text-zinc-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(161,161,170,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(161,161,170,0.12)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-[max(1rem,env(safe-area-inset-left))] py-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-10">
        <section className="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(24,24,27,0.12)] sm:p-10">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4" aria-label="PlanGlade landing page">
            <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50"><CheckSquare className="size-4" aria-hidden="true" /></span>
            PlanGlade
          </Link>
          {children}
        </section>
      </div>
    </main>
  )
}

function Progress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-zinc-500" aria-label="Setup progress">
      {[[1, "Authorize"], [2, "Owner"], [3, "Recovery codes"]].map(([step, label]) => (
        <li key={String(step)} aria-current={step === current ? "step" : undefined} className={step === current ? "text-zinc-950" : undefined}>{step} {label}</li>
      ))}
    </ol>
  )
}

function ownerErrors(values: { name: string; email: string; password: string; confirmation: string; workspaceName: string }): OwnerErrors {
  const errors: OwnerErrors = {}
  const nameLength = values.name.trim().length
  if (nameLength < 1 || nameLength > 120) errors.name = "Enter the owner's name."
  if (values.email.length > 320 || !normalizeEmail(values.email)) errors.email = "Enter a valid email address."
  const passwordLength = [...values.password].length
  if (passwordLength < 15 || passwordLength > 128) errors.password = "Use a password between 15 and 128 characters."
  if (!values.confirmation || values.password !== values.confirmation) errors.confirmation = "Passwords do not match."
  const workspaceLength = values.workspaceName.trim().length
  if (workspaceLength < 2 || workspaceLength > 80) errors.workspaceName = "Use a workspace name between 2 and 80 characters."
  return errors
}

export default function SetupPage() {
  const router = useRouter()
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const summaryRef = React.useRef<HTMLDivElement>(null)
  const tokenInputRef = React.useRef<HTMLInputElement>(null)
  const recoveryRef = React.useRef<HTMLDivElement>(null)
  const activeRequestRef = React.useRef<AbortController | null>(null)
  const mountedRef = React.useRef(true)
  const [screen, setScreen] = React.useState<SetupScreen>(
    demoReadOnlyDeployment ? "unavailable" : "checking",
  )
  const [setupToken, setSetupToken] = React.useState("")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [workspaceName, setWorkspaceName] = React.useState("")
  const [touched, setTouched] = React.useState<Partial<Record<OwnerField, boolean>>>({})
  const [errors, setErrors] = React.useState<OwnerErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([])
  const [codesSaved, setCodesSaved] = React.useState(false)
  const [routineStatus, setRoutineStatus] = React.useState("")

  const clearToken = React.useCallback(() => {
    setSetupToken("")
    if (tokenInputRef.current) tokenInputRef.current.value = ""
  }, [])

  const clearPasswords = React.useCallback(() => {
    setPassword("")
    setConfirmation("")
  }, [])

  const clearAllSensitiveState = React.useCallback(() => {
    clearToken()
    clearPasswords()
    setName("")
    setEmail("")
    setWorkspaceName("")
    setRecoveryCodes([])
    setCodesSaved(false)
    recoveryRef.current?.replaceChildren()
  }, [clearPasswords, clearToken])

  const beginRequest = React.useCallback(() => {
    activeRequestRef.current?.abort()
    const controller = new AbortController()
    activeRequestRef.current = controller
    return controller
  }, [])

  const discover = React.useCallback(async () => {
    const controller = beginRequest()
    setScreen("checking")
    setFormError(null)
    try {
      const response = await fetch("/api/auth/setup", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      const payload = response.ok ? (await response.json().catch(() => null)) as { status?: unknown } | null : null
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.ok && exactSetupStatus(payload, "available")) setScreen("authorize")
      else if (response.ok && exactSetupStatus(payload, "unavailable")) setScreen("unavailable")
      else setScreen("temporary")
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setScreen("temporary")
    }
  }, [beginRequest])

  React.useEffect(() => {
    if (!demoReadOnlyDeployment) void discover()
  }, [discover])
  React.useEffect(() => { if (screen !== "checking") headingRef.current?.focus() }, [screen])
  React.useEffect(() => {
    mountedRef.current = true
    const clearRenderedSecrets = () => {
      if (tokenInputRef.current) tokenInputRef.current.value = ""
      document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => { input.value = "" })
      recoveryRef.current?.replaceChildren()
    }
    window.addEventListener("pagehide", clearRenderedSecrets)
    return () => {
      mountedRef.current = false
      activeRequestRef.current?.abort()
      clearRenderedSecrets()
      window.removeEventListener("pagehide", clearRenderedSecrets)
    }
  }, [])

  async function claimSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let requestBody = JSON.stringify({ setupToken })
    const controller = beginRequest()
    setSubmitting(true)
    setFormError(null)
    clearToken()
    try {
      const response = await fetch("/api/auth/setup/claim", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json", "x-planglade-csrf": readCsrfCookie() ?? "" },
        body: requestBody,
        signal: controller.signal,
      })
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.status === 201) setScreen("details")
      else if (response.status === 409 || response.status === 404) setScreen("unavailable")
      else if (response.status === 401 || response.status === 403) setFormError("Setup authorization failed. Check the setup token and try again.")
      else setScreen("temporary")
    } catch {
      if (mountedRef.current && !controller.signal.aborted) await discover()
    } finally {
      requestBody = ""
      clearToken()
      if (mountedRef.current) setSubmitting(false)
    }
  }

  function validateField(field: OwnerField) {
    const next = ownerErrors({ name, email, password, confirmation, workspaceName })
    setTouched((current) => ({ ...current, [field]: true }))
    setErrors((current) => ({ ...current, [field]: next[field] }))
  }

  async function completeSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = ownerErrors({ name, email, password, confirmation, workspaceName })
    if (Object.keys(nextErrors).length) {
      setTouched({ name: true, email: true, password: true, confirmation: true, workspaceName: true })
      setErrors(nextErrors)
      setFormError("Fix the errors below and try again.")
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }

    let requestBody = JSON.stringify({ name: name.trim(), email: email.trim(), password, workspaceName: workspaceName.trim() })
    const controller = beginRequest()
    setSubmitting(true)
    setFormError(null)
    clearPasswords()
    try {
      const response = await fetch("/api/auth/setup/complete", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json", "x-planglade-csrf": readCsrfCookie() ?? "" },
        body: requestBody,
        signal: controller.signal,
      })
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.status === 201) {
        const payload = (await response.json().catch(() => null)) as { recoveryCodes?: unknown } | null
        if (Array.isArray(payload?.recoveryCodes) && payload.recoveryCodes.length === 10 && payload.recoveryCodes.every((code) => typeof code === "string" && recoveryCodePattern.test(code))) {
          setRecoveryCodes(payload.recoveryCodes)
          setScreen("recovery")
        } else {
          clearAllSensitiveState()
          setScreen("completion-lost")
        }
      } else if (response.status === 410) {
        clearPasswords()
        setFormError("Your setup session expired. Enter the setup token again to continue.")
        setScreen("authorize")
      } else if (response.status === 409 || response.status === 404) {
        clearAllSensitiveState()
        setScreen("unavailable")
      } else {
        setFormError("Setup could not be completed. Check the details and try again.")
      }
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        clearAllSensitiveState()
        setScreen("completion-lost")
      }
    } finally {
      requestBody = ""
      if (mountedRef.current) setSubmitting(false)
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(`PlanGlade recovery codes\n${window.location.origin}\n${recoveryCodes.join("\n")}`)
      setRoutineStatus("Copied.")
    } catch {
      setRoutineStatus("Copy failed. Select and copy the codes manually.")
    }
  }

  function printCodes() {
    setRoutineStatus("")
    let printWindow: Window | null = null
    try {
      printWindow = window.open("", "_blank")
      if (!printWindow || printWindow.closed) throw new Error("Print window unavailable")
      printWindow.opener = null
      const document = printWindow.document
      const style = document.createElement("style")
      style.textContent = "body{color:#000;background:#fff;font:12pt system-ui,sans-serif;margin:2cm}ol{font:14pt ui-monospace,monospace;line-height:1.8}"
      const main = document.createElement("main")
      const title = document.createElement("h1")
      const origin = document.createElement("p")
      const generated = document.createElement("p")
      const warning = document.createElement("p")
      const list = document.createElement("ol")
      title.textContent = "PlanGlade"
      origin.textContent = window.location.origin
      generated.textContent = `Generated: ${new Date().toLocaleDateString()}`
      warning.textContent = "One-time recovery codes. Each code works once. PlanGlade cannot show them again."
      recoveryCodes.forEach((code) => { const item = document.createElement("li"); item.textContent = code; list.append(item) })
      main.append(title, origin, generated, warning, list)
      document.head.append(style)
      document.body.append(main)
      printWindow.print()
    } catch {
      setRoutineStatus("Print failed. Select and copy the codes manually.")
    } finally {
      try { printWindow?.close() } catch {}
    }
  }

  function continueToLogin() {
    clearAllSensitiveState()
    router.replace("/login")
  }

  const fieldError = (field: OwnerField) => touched[field] ? errors[field] : undefined
  const describedBy = (field: OwnerField, help?: string) => [help, fieldError(field) ? `${field}-error` : null].filter(Boolean).join(" ") || undefined

  if (screen === "checking") return <SetupFrame><h1 className="mt-10 text-3xl font-semibold tracking-tight">Checking setup availability</h1></SetupFrame>
  if (screen === "unavailable") return <SetupFrame><div className="mt-10"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Setup is not available</h1><Button asChild className="mt-6"><Link href="/login">Go to login</Link></Button></div></SetupFrame>
  if (screen === "temporary") return <SetupFrame><div className="mt-10"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Setup is temporarily unavailable</h1><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => void discover()}>Try again</Button><Button asChild variant="outline"><Link href="/login">Go to login</Link></Button></div></div></SetupFrame>
  if (screen === "completion-lost") return <SetupFrame><div className="mt-10"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Setup may already be complete</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Setup may already be complete. Try signing in with the owner email and password you entered.</p><Button asChild className="mt-6"><Link href="/login">Go to login</Link></Button></div></SetupFrame>

  if (screen === "recovery") return (
    <SetupFrame><Progress current={3} /><div ref={recoveryRef} className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Recovery codes</h1><p className="mt-3 text-sm font-medium leading-6 text-zinc-800">Save these recovery codes now. Each code works once. PlanGlade cannot show them again.</p><ol className="mt-6 grid gap-2 font-mono text-sm" aria-label="Recovery codes">{recoveryCodes.map((code, index) => <li key={index} className="select-text rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"><span className="mr-3 text-zinc-500">{index + 1}.</span>{code.split("-").map((group, groupIndex) => <span key={groupIndex} className="inline-block whitespace-nowrap">{group}{groupIndex < 7 ? "-" : ""}</span>)}</li>)}</ol><div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" className="min-h-11" onClick={() => void copyCodes()}><Copy className="size-4" aria-hidden="true" />Copy all codes</Button><Button type="button" variant="outline" className="min-h-11" onClick={printCodes}><Printer className="size-4" aria-hidden="true" />Print codes</Button></div><p className="mt-3 min-h-5 text-sm text-zinc-600" aria-live="polite">{routineStatus}</p><label className="mt-6 flex min-h-11 items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm font-medium text-zinc-900"><input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} className="mt-0.5 size-5" />I saved these recovery codes. PlanGlade cannot show them again.</label><Button className="mt-5 min-h-11" disabled={!codesSaved} onClick={continueToLogin}>Continue to login</Button></div></SetupFrame>
  )

  if (screen === "details") return (
    <SetupFrame><Progress current={2} /><div className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Create the owner</h1></div><form className="mt-8 grid gap-4" onSubmit={completeSetup} noValidate>{formError && <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 outline-none">{formError}</div>}<label className="grid gap-1.5 text-sm font-medium" htmlFor="name">Owner name</label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => validateField("name")} autoComplete="name" maxLength={120} required aria-invalid={Boolean(fieldError("name"))} aria-describedby={describedBy("name")} />{fieldError("name") && <p id="name-error" className="text-sm text-red-700">{fieldError("name")}</p>}<label className="grid gap-1.5 text-sm font-medium" htmlFor="email">Email</label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => validateField("email")} autoComplete="email" maxLength={320} required aria-invalid={Boolean(fieldError("email"))} aria-describedby={describedBy("email")} />{fieldError("email") && <p id="email-error" className="text-sm text-red-700">{fieldError("email")}</p>}<label className="grid gap-1.5 text-sm font-medium" htmlFor="password">Password</label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onBlur={() => validateField("password")} autoComplete="new-password" required aria-invalid={Boolean(fieldError("password"))} aria-describedby={describedBy("password", "password-help")} /><p id="password-help" className="text-xs text-zinc-500">Use at least 15 characters. A password manager is recommended.</p>{fieldError("password") && <p id="password-error" className="text-sm text-red-700">{fieldError("password")}</p>}<label className="grid gap-1.5 text-sm font-medium" htmlFor="confirmation">Confirm password</label><Input id="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} onBlur={() => validateField("confirmation")} autoComplete="new-password" required aria-invalid={Boolean(fieldError("confirmation"))} aria-describedby={describedBy("confirmation")} />{fieldError("confirmation") && <p id="confirmation-error" className="text-sm text-red-700">{fieldError("confirmation")}</p>}<label className="grid gap-1.5 text-sm font-medium" htmlFor="workspaceName">Workspace name</label><Input id="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} onBlur={() => validateField("workspaceName")} autoComplete="organization" required aria-invalid={Boolean(fieldError("workspaceName"))} aria-describedby={describedBy("workspaceName")} />{fieldError("workspaceName") && <p id="workspaceName-error" className="text-sm text-red-700">{fieldError("workspaceName")}</p>}<Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? "Creating owner and workspace..." : "Create owner and workspace"}</Button></form></SetupFrame>
  )

  return (
    <SetupFrame><Progress current={1} /><div className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">Authorize setup</h1></div><form className="mt-8 grid gap-4" onSubmit={claimSetup}><label className="grid gap-1.5 text-sm font-medium" htmlFor="setup-token">Setup token</label><Input id="setup-token" ref={tokenInputRef} type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" required aria-describedby="setup-token-help" /><p id="setup-token-help" className="text-xs text-zinc-500">Use the token configured by the operator for this installation.</p>{formError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}<Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? "Checking token..." : "Continue"}</Button></form></SetupFrame>
  )
}
