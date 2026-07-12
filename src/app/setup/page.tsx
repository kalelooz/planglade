"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckSquare, Copy, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SetupScreen = "checking" | "authorize" | "details" | "recovery" | "unavailable" | "temporary" | "expired" | "completion-lost"
type SetupError = { error?: { code?: string; message?: string } }

const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/

function readCsrfCookie() {
  const prefix = "planglade-setup-csrf="
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
}

async function readError(response: Response) {
  return (await response.json().catch(() => ({}))) as SetupError
}

function SetupFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-100 text-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(161,161,170,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(161,161,170,0.12)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-6 sm:px-6 sm:py-10">
        <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_24px_80px_rgba(24,24,27,0.12)] sm:p-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-4"
            aria-label="PlanGlade landing page"
          >
            <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
              <CheckSquare className="size-4" aria-hidden="true" />
            </span>
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
    <ol className="mt-8 flex gap-2 text-xs font-medium text-zinc-500" aria-label="Setup progress">
      {[[1, "Authorize"], [2, "Owner"], [3, "Recovery codes"]].map(([step, label]) => (
        <li key={String(step)} className={step === current ? "text-zinc-950" : undefined}>
          {step} {label}
        </li>
      ))}
    </ol>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const tokenInput = React.useRef<HTMLInputElement>(null)
  const [screen, setScreen] = React.useState<SetupScreen>("checking")
  const [setupToken, setSetupToken] = React.useState("")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [passwordConfirmation, setPasswordConfirmation] = React.useState("")
  const [workspaceName, setWorkspaceName] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([])
  const [codesSaved, setCodesSaved] = React.useState(false)
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null)
  const [printStatus, setPrintStatus] = React.useState<string | null>(null)

  const clearToken = React.useCallback(() => {
    setSetupToken("")
    if (tokenInput.current) tokenInput.current.value = ""
  }, [])

  const clearPasswords = React.useCallback(() => {
    setPassword("")
    setPasswordConfirmation("")
  }, [])

  const clearAllSensitiveState = React.useCallback(() => {
    clearToken()
    clearPasswords()
    setName("")
    setEmail("")
    setWorkspaceName("")
    setRecoveryCodes([])
    setCodesSaved(false)
  }, [clearPasswords, clearToken])

  const discover = React.useCallback(async () => {
    setScreen("checking")
    setFormError(null)
    try {
      const response = await fetch("/api/auth/setup", { cache: "no-store", credentials: "same-origin" })
      if (response.status === 503) {
        setScreen("temporary")
        return
      }
      const payload = (await response.json().catch(() => ({}))) as { status?: unknown }
      setScreen(payload.status === "available" ? "authorize" : "unavailable")
    } catch {
      setScreen("temporary")
    }
  }, [])

  React.useEffect(() => {
    void discover()
  }, [discover])

  React.useEffect(() => () => {
    clearToken()
    clearPasswords()
    setRecoveryCodes([])
  }, [clearPasswords, clearToken])

  async function claimSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submittedToken = setupToken
    setSubmitting(true)
    setFormError(null)
    clearToken()
    try {
      const response = await fetch("/api/auth/setup/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-planglade-csrf": readCsrfCookie() ?? "",
        },
        body: JSON.stringify({ setupToken: submittedToken }),
      })
      if (response.status === 201) {
        setScreen("details")
        return
      }
      if (response.status === 503) {
        setScreen("temporary")
        return
      }
      if (response.status === 409) {
        setScreen("unavailable")
        return
      }
      const payload = await readError(response)
      setFormError(payload.error?.message ?? "Setup authorization failed.")
    } catch {
      setScreen("temporary")
    } finally {
      setSubmitting(false)
    }
  }

  function validateOwnerForm() {
    if (!name.trim()) return "Enter the owner's name."
    if (!email.trim() || email.length > 320) return "Enter a valid email address."
    const passwordLength = Array.from(password).length
    if (passwordLength < 15 || passwordLength > 128) return "Use a password between 15 and 128 characters."
    if (password !== passwordConfirmation) return "Passwords do not match."
    const trimmedWorkspaceName = workspaceName.trim()
    if (trimmedWorkspaceName.length < 2 || trimmedWorkspaceName.length > 80) {
      return "Use a workspace name between 2 and 80 characters."
    }
    return null
  }

  async function completeSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateOwnerForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    const body = { name, email, password, workspaceName }
    setSubmitting(true)
    setFormError(null)
    clearPasswords()
    try {
      const response = await fetch("/api/auth/setup/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-planglade-csrf": readCsrfCookie() ?? "",
        },
        body: JSON.stringify(body),
      })
      if (response.status === 201) {
        const payload = (await response.json()) as { recoveryCodes?: unknown }
        if (
          Array.isArray(payload.recoveryCodes) &&
          payload.recoveryCodes.length === 10 &&
          payload.recoveryCodes.every((code) => typeof code === "string" && recoveryCodePattern.test(code))
        ) {
          setRecoveryCodes(payload.recoveryCodes)
          setScreen("recovery")
          return
        }
        clearAllSensitiveState()
        setScreen("completion-lost")
        return
      }
      if (response.status === 410) {
        setScreen("expired")
        return
      }
      if (response.status === 503) {
        setScreen("temporary")
        return
      }
      if (response.status === 409) {
        clearAllSensitiveState()
        setScreen("unavailable")
        return
      }
      await readError(response)
      setFormError("Setup could not be completed. Check the details and try again.")
    } catch {
      clearAllSensitiveState()
      setScreen("completion-lost")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyCodes() {
    setCopyStatus(null)
    try {
      await navigator.clipboard.writeText(`PlanGlade recovery codes\n${window.location.origin}\n\n${recoveryCodes.join("\n")}`)
      setCopyStatus("Copied.")
    } catch {
      setCopyStatus("Copy failed. Select and copy the codes manually.")
    }
  }

  function printCodes() {
    setPrintStatus(null)
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setPrintStatus("Print failed. Select and copy the codes manually.")
      return
    }
    printWindow.opener = null
    printWindow.document.title = "PlanGlade recovery codes"
    printWindow.document.body.innerHTML = ""
    const content = printWindow.document.createElement("main")
    const title = printWindow.document.createElement("h1")
    const origin = printWindow.document.createElement("p")
    const generated = printWindow.document.createElement("p")
    const warning = printWindow.document.createElement("p")
    const list = printWindow.document.createElement("ol")
    title.textContent = "PlanGlade recovery codes"
    origin.textContent = window.location.origin
    generated.textContent = `Generated: ${new Date().toLocaleDateString()}`
    warning.textContent = "Save these recovery codes now. Each code works once. PlanGlade cannot show them again."
    for (const code of recoveryCodes) {
      const item = printWindow.document.createElement("li")
      item.textContent = code
      list.append(item)
    }
    content.append(title, origin, generated, warning, list)
    printWindow.document.body.append(content)
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true })
    printWindow.print()
  }

  if (screen === "checking") {
    return <SetupFrame><p className="mt-10 text-sm text-zinc-600" role="status">Checking setup availability...</p></SetupFrame>
  }

  if (screen === "unavailable") {
    return (
      <SetupFrame>
        <div className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight">Setup is not available</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Return to login or ask the operator to check this installation.</p>
          <Button asChild className="mt-6"><Link href="/login">Go to login</Link></Button>
        </div>
      </SetupFrame>
    )
  }

  if (screen === "temporary") {
    return (
      <SetupFrame>
        <div className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight">Setup is temporarily unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Try again in a moment or return to login.</p>
          <div className="mt-6 flex gap-3"><Button onClick={() => void discover()}>Try again</Button><Button asChild variant="outline"><Link href="/login">Go to login</Link></Button></div>
        </div>
      </SetupFrame>
    )
  }

  if (screen === "expired") {
    return (
      <SetupFrame>
        <div className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight">Your setup session expired</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Enter the setup token again to continue.</p>
          <Button className="mt-6" onClick={() => void discover()}>Enter setup token</Button>
        </div>
      </SetupFrame>
    )
  }

  if (screen === "completion-lost") {
    return (
      <SetupFrame>
        <div className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight">Setup may already be complete</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Try signing in with the owner email and password you entered. The original recovery codes cannot be retrieved or replayed.</p>
          <Button asChild className="mt-6"><Link href="/login">Go to login</Link></Button>
        </div>
      </SetupFrame>
    )
  }

  if (screen === "recovery") {
    return (
      <SetupFrame>
        <Progress current={3} />
        <div className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight">Save recovery codes</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Save these recovery codes now. Each code works once. PlanGlade cannot show them again.</p>
          <ol className="mt-6 grid gap-2 font-mono text-sm" aria-label="Recovery codes">
            {recoveryCodes.map((code, index) => <li key={code} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"><span className="mr-3 text-zinc-500">{index + 1}.</span>{code}</li>)}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => void copyCodes()}><Copy className="size-4" />Copy all codes</Button><Button type="button" variant="outline" onClick={printCodes}><Printer className="size-4" />Print codes</Button></div>
          {(copyStatus || printStatus) && <p className="mt-3 text-sm text-zinc-600" aria-live="polite">{copyStatus ?? printStatus}</p>}
          <label className="mt-8 flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm font-medium text-zinc-900">
            <input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} className="mt-0.5 size-4" />
            I saved these recovery codes. PlanGlade cannot show them again.
          </label>
          <Button className="mt-5" disabled={!codesSaved} onClick={() => { setRecoveryCodes([]); router.replace("/login") }}>Continue to login</Button>
        </div>
      </SetupFrame>
    )
  }

  if (screen === "details") {
    return (
      <SetupFrame>
        <Progress current={2} />
        <div className="mt-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Create the first owner</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Owner and workspace details</h1><p className="mt-3 text-sm leading-6 text-zinc-600">This creates the first owner and workspace on your self-hosted PlanGlade. It does not create a hosted PlanGlade account.</p></div>
        <form className="mt-8 grid gap-4" onSubmit={completeSetup}>
          <label className="grid gap-1.5 text-sm font-medium">Owner name<Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required /></label>
          <label className="grid gap-1.5 text-sm font-medium">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} required /></label>
          <label className="grid gap-1.5 text-sm font-medium">Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={15} maxLength={128} required /><span className="text-xs font-normal text-zinc-500">Use at least 15 characters. A password manager is recommended.</span></label>
          <label className="grid gap-1.5 text-sm font-medium">Confirm password<Input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={15} maxLength={128} required /></label>
          <label className="grid gap-1.5 text-sm font-medium">Workspace name<Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} autoComplete="organization" minLength={2} maxLength={80} required /></label>
          {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <Button type="submit" disabled={submitting}>{submitting ? "Creating owner and workspace..." : "Create owner and workspace"}</Button>
        </form>
      </SetupFrame>
    )
  }

  return (
    <SetupFrame>
      <Progress current={1} />
      <div className="mt-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Local self-host setup</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Set up this PlanGlade installation</h1><p className="mt-3 text-sm leading-6 text-zinc-600">This creates the first owner and workspace on your self-hosted PlanGlade. It does not create a hosted PlanGlade account.</p></div>
      <form className="mt-8 grid gap-4" onSubmit={claimSetup}>
        <label className="grid gap-1.5 text-sm font-medium">Setup token<Input ref={tokenInput} type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} autoComplete="off" spellCheck="false" autoCapitalize="none" required /><span className="text-xs font-normal text-zinc-500">Use the token configured by the operator for this installation.</span></label>
        {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <Button type="submit" disabled={submitting}>{submitting ? "Checking token..." : "Continue"}</Button>
      </form>
    </SetupFrame>
  )
}
