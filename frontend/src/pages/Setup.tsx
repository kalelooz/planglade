import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Copy, Printer } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AuthFrame } from '@/components/AuthFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeWorkspaceDestination } from '@/lib/auth-destination'

type SetupScreen = 'checking' | 'authorize' | 'details' | 'recovery' | 'configuration' | 'unavailable' | 'temporary' | 'completion-lost'
type OwnerField = 'name' | 'email' | 'password' | 'confirmation' | 'workspaceName'
type OwnerErrors = Partial<Record<OwnerField, string>>

const csrfCookieName = 'planglade-setup-csrf'
const recoveryCodePattern = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/

function readCsrfCookie() {
  const prefix = `${csrfCookieName}=`
  return document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? null
}

function exactSetupStatus(value: unknown, status: 'available' | 'configuration-required' | 'unavailable') {
  return value !== null && typeof value === 'object' && Object.keys(value).length === 1 && 'status' in value && value.status === status
}

function normalizedEmail(value: string) {
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function Progress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground" aria-label="Setup progress">
      {([[1, 'Authorize'], [2, 'Owner'], [3, 'Recovery codes']] as const).map(([step, label]) => (
        <li key={step} aria-current={step === current ? 'step' : undefined} className={step === current ? 'text-foreground' : undefined}>{step}. {label}</li>
      ))}
    </ol>
  )
}

function ownerErrors(values: { name: string; email: string; password: string; confirmation: string; workspaceName: string }): OwnerErrors {
  const errors: OwnerErrors = {}
  const nameLength = values.name.trim().length
  if (nameLength < 1 || nameLength > 120) errors.name = "Enter the owner's name."
  if (values.email.length > 320 || !normalizedEmail(values.email)) errors.email = 'Enter a valid email address.'
  const passwordLength = [...values.password].length
  if (passwordLength < 15 || passwordLength > 128) errors.password = 'Use a password between 15 and 128 characters.'
  if (!values.confirmation || values.password !== values.confirmation) errors.confirmation = 'Passwords do not match.'
  const workspaceLength = values.workspaceName.trim().length
  if (workspaceLength < 2 || workspaceLength > 80) errors.workspaceName = 'Use a workspace name between 2 and 80 characters.'
  return errors
}

function StatePage({ title, detail, retry }: { title: string; detail?: ReactNode; retry?: () => void }) {
  return (
    <AuthFrame compact>
      <h1 tabIndex={-1} className="pg-page-title outline-none">{title}</h1>
      {detail && <div className="pg-body-muted mt-3">{detail}</div>}
      <div className="mt-6 flex flex-wrap gap-3">
        {retry && <Button onClick={retry}>Try again</Button>}
        <Button asChild variant={retry ? 'outline' : 'default'}><Link to="/auth/login">Go to sign in</Link></Button>
      </div>
    </AuthFrame>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const tokenInputRef = useRef<HTMLInputElement>(null)
  const recoveryRef = useRef<HTMLDivElement>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const [screen, setScreen] = useState<SetupScreen>('checking')
  const [setupToken, setSetupToken] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [touched, setTouched] = useState<Partial<Record<OwnerField, boolean>>>({})
  const [errors, setErrors] = useState<OwnerErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codesSaved, setCodesSaved] = useState(false)
  const [routineStatus, setRoutineStatus] = useState('')

  const clearToken = useCallback(() => {
    setSetupToken('')
    if (tokenInputRef.current) tokenInputRef.current.value = ''
  }, [])
  const clearPasswords = useCallback(() => { setPassword(''); setConfirmation('') }, [])
  const clearAllSensitiveState = useCallback(() => {
    clearToken(); clearPasswords(); setName(''); setEmail(''); setWorkspaceName(''); setRecoveryCodes([]); setCodesSaved(false)
    recoveryRef.current?.replaceChildren()
  }, [clearPasswords, clearToken])
  const beginRequest = useCallback(() => {
    activeRequestRef.current?.abort()
    const controller = new AbortController()
    activeRequestRef.current = controller
    return controller
  }, [])
  const discover = useCallback(async () => {
    const controller = beginRequest()
    setScreen('checking')
    setFormError(null)
    try {
      const response = await fetch('/api/auth/setup', { cache: 'no-store', credentials: 'include', signal: controller.signal })
      const payload = response.ok ? await response.json().catch(() => null) as { status?: unknown } | null : null
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.ok && exactSetupStatus(payload, 'available')) setScreen('authorize')
      else if (response.ok && exactSetupStatus(payload, 'configuration-required')) setScreen('configuration')
      else if (response.ok && exactSetupStatus(payload, 'unavailable')) setScreen('unavailable')
      else setScreen('temporary')
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setScreen('temporary')
    }
  }, [beginRequest])

  useEffect(() => { void discover() }, [discover])
  useEffect(() => { if (screen !== 'checking') headingRef.current?.focus() }, [screen])
  useEffect(() => {
    mountedRef.current = true
    const clearRenderedSecrets = () => {
      if (tokenInputRef.current) tokenInputRef.current.value = ''
      document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => { input.value = '' })
      recoveryRef.current?.replaceChildren()
    }
    window.addEventListener('pagehide', clearRenderedSecrets)
    return () => {
      mountedRef.current = false
      activeRequestRef.current?.abort()
      clearRenderedSecrets()
      window.removeEventListener('pagehide', clearRenderedSecrets)
    }
  }, [])

  async function claimSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let requestBody = JSON.stringify({ setupToken })
    const controller = beginRequest()
    setSubmitting(true); setFormError(null); clearToken()
    try {
      const response = await fetch('/api/auth/setup/claim', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-planglade-csrf': readCsrfCookie() ?? '' },
        body: requestBody, signal: controller.signal,
      })
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.status === 201) setScreen('details')
      else if (response.status === 409 || response.status === 404) setScreen('unavailable')
      else if (response.status === 401 || response.status === 403) setFormError('Setup authorization failed. Check the setup token and try again.')
      else setScreen('temporary')
    } catch {
      if (mountedRef.current && !controller.signal.aborted) await discover()
    } finally {
      requestBody = ''; clearToken(); if (mountedRef.current) setSubmitting(false)
    }
  }

  function validateField(field: OwnerField) {
    const next = ownerErrors({ name, email, password, confirmation, workspaceName })
    setTouched((current) => ({ ...current, [field]: true }))
    setErrors((current) => ({ ...current, [field]: next[field] }))
  }

  async function completeSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = ownerErrors({ name, email, password, confirmation, workspaceName })
    if (Object.keys(nextErrors).length) {
      setTouched({ name: true, email: true, password: true, confirmation: true, workspaceName: true })
      setErrors(nextErrors); setFormError('Fix the errors below and try again.')
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    let requestBody = JSON.stringify({ name: name.trim(), email: email.trim(), password, workspaceName: workspaceName.trim() })
    const controller = beginRequest()
    setSubmitting(true); setFormError(null); clearPasswords()
    try {
      const response = await fetch('/api/auth/setup/complete', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-planglade-csrf': readCsrfCookie() ?? '' },
        body: requestBody, signal: controller.signal,
      })
      if (!mountedRef.current || controller.signal.aborted) return
      if (response.status === 201) {
        const payload = await response.json().catch(() => null) as { recoveryCodes?: unknown } | null
        if (Array.isArray(payload?.recoveryCodes) && payload.recoveryCodes.length === 10 && payload.recoveryCodes.every((code) => typeof code === 'string' && recoveryCodePattern.test(code))) {
          setRecoveryCodes(payload.recoveryCodes); setScreen('recovery')
        } else { clearAllSensitiveState(); setScreen('completion-lost') }
      } else if (response.status === 410) {
        clearPasswords(); setFormError('Your setup session expired. Enter the setup token again to continue.'); setScreen('authorize')
      } else if (response.status === 409 || response.status === 404) {
        clearAllSensitiveState(); setScreen('unavailable')
      } else setFormError('Setup could not be completed. Check the details and try again.')
    } catch {
      if (mountedRef.current && !controller.signal.aborted) { clearAllSensitiveState(); setScreen('completion-lost') }
    } finally {
      requestBody = ''; if (mountedRef.current) setSubmitting(false)
    }
  }

  async function copyCodes() {
    try { await navigator.clipboard.writeText(`PlanGlade recovery codes\n${window.location.origin}\n${recoveryCodes.join('\n')}`); setRoutineStatus('Copied.') }
    catch { setRoutineStatus('Copy failed. Select and copy the codes manually.') }
  }

  function printCodes() {
    setRoutineStatus('')
    let printWindow: Window | null = null
    try {
      printWindow = window.open('', '_blank')
      if (!printWindow || printWindow.closed) throw new Error('Print window unavailable')
      printWindow.opener = null
      const printDocument = printWindow.document
      const style = printDocument.createElement('style'); style.textContent = 'body{color:#000;background:#fff;font:12pt system-ui,sans-serif;margin:2cm}ol{font:14pt ui-monospace,monospace;line-height:1.8}'
      const main = printDocument.createElement('main'); const title = printDocument.createElement('h1'); const origin = printDocument.createElement('p'); const generated = printDocument.createElement('p'); const warning = printDocument.createElement('p'); const list = printDocument.createElement('ol')
      title.textContent = 'PlanGlade'; origin.textContent = window.location.origin; generated.textContent = `Generated: ${new Date().toLocaleDateString()}`; warning.textContent = 'One-time recovery codes. Each code works once. PlanGlade cannot show them again.'
      recoveryCodes.forEach((code) => { const item = printDocument.createElement('li'); item.textContent = code; list.append(item) })
      main.append(title, origin, generated, warning, list); printDocument.head.append(style); printDocument.body.append(main); printWindow.print()
    } catch { setRoutineStatus('Print failed. Select and copy the codes manually.') }
    finally { try { printWindow?.close() } catch { /* no-op */ } }
  }

  function continueToLogin() {
    clearAllSensitiveState()
    const destination = normalizeWorkspaceDestination(new URLSearchParams(location.search).get('next'))
    navigate(destination === '/' ? '/auth/login' : `/auth/login?next=${encodeURIComponent(destination)}`, { replace: true })
  }

  const fieldError = (field: OwnerField) => touched[field] ? errors[field] : undefined
  const describedBy = (field: OwnerField, help?: string) => [help, fieldError(field) ? `${field}-error` : null].filter(Boolean).join(' ') || undefined

  if (screen === 'checking') return <AuthFrame compact><h1 className="pg-page-title">Checking setup availability</h1><p role="status" className="pg-body-muted mt-3">This check does not change your workspace.</p></AuthFrame>
  if (screen === 'configuration') return <StatePage title="Setup needs installation configuration" detail={<>Run <code className="font-mono text-foreground">npm run setup:local</code>, restart PlanGlade, then return here.</>} retry={() => void discover()} />
  if (screen === 'unavailable') return <StatePage title="Setup is not available" detail="An owner account already exists or this installation does not allow first-time setup." />
  if (screen === 'temporary') return <StatePage title="Setup is temporarily unavailable" detail="Check that the PlanGlade backend is running, then try again." retry={() => void discover()} />
  if (screen === 'completion-lost') return <StatePage title="Setup may already be complete" detail="Try signing in with the owner email and password you entered." />

  if (screen === 'recovery') return (
    <AuthFrame compact><Progress current={3} /><div ref={recoveryRef} className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="pg-page-title outline-none">Recovery codes</h1><p className="pg-body-muted mt-3 font-medium text-foreground">Save these codes now. Each works once, and PlanGlade cannot show them again.</p><ol className="mt-6 grid gap-2 font-mono text-sm" aria-label="Recovery codes">{recoveryCodes.map((code, index) => <li key={code} className="select-text rounded-md border border-border bg-muted/55 px-3 py-2"><span className="mr-3 text-muted-foreground">{index + 1}.</span>{code.split('-').map((group, groupIndex) => <span key={`${group}-${groupIndex}`} className="inline-block whitespace-nowrap">{group}{groupIndex < 7 ? '-' : ''}</span>)}</li>)}</ol><div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" size="lg" onClick={() => void copyCodes()}><Copy aria-hidden="true" />Copy all codes</Button><Button type="button" variant="outline" size="lg" onClick={printCodes}><Printer aria-hidden="true" />Print codes</Button></div><p className="mt-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">{routineStatus}</p><label className="mt-6 flex min-h-11 items-start gap-3 rounded-md border border-border p-3 text-sm font-medium"><input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} className="mt-0.5 size-5" />I saved these recovery codes.</label><Button size="lg" className="mt-5 w-full" disabled={!codesSaved} onClick={continueToLogin}>Continue to sign in</Button></div></AuthFrame>
  )

  if (screen === 'details') return (
    <AuthFrame compact><Progress current={2} /><div className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="pg-page-title outline-none">Create the owner</h1><p className="pg-body-muted mt-3">One account and one workspace are enough to start.</p></div><form className="mt-8 grid gap-3" onSubmit={completeSetup} noValidate>{formError && <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none">{formError}</div>}{([
      ['name', 'Owner name', 'text', name, setName, 'name', undefined, 120],
      ['email', 'Email', 'email', email, setEmail, 'email', undefined, 320],
      ['password', 'Password', 'password', password, setPassword, 'new-password', 'Use 15–128 characters. A password manager is recommended.', 128],
      ['confirmation', 'Confirm password', 'password', confirmation, setConfirmation, 'new-password', undefined, 128],
      ['workspaceName', 'Workspace name', 'text', workspaceName, setWorkspaceName, 'organization', undefined, 80],
    ] as const).map(([field, label, type, value, setter, autoComplete, help, maxLength]) => <div key={field}><label className="text-sm font-medium" htmlFor={field}>{label}</label><Input id={field} type={type} value={value} onChange={(event) => setter(event.target.value)} onBlur={() => validateField(field)} autoComplete={autoComplete} maxLength={maxLength} required aria-invalid={Boolean(fieldError(field))} aria-describedby={describedBy(field, help ? `${field}-help` : undefined)} className="mt-1 h-11 bg-muted/45" />{help && <p id={`${field}-help`} className="mt-1 text-xs text-muted-foreground">{help}</p>}{fieldError(field) && <p id={`${field}-error`} className="mt-1 text-sm text-destructive">{fieldError(field)}</p>}</div>)}<Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>{submitting ? 'Creating owner and workspace…' : 'Create owner and workspace'}</Button></form></AuthFrame>
  )

  return (
    <AuthFrame compact><Progress current={1} /><div className="mt-8"><h1 ref={headingRef} tabIndex={-1} className="pg-page-title outline-none">Authorize setup</h1><p className="pg-body-muted mt-3">Use the one-time token printed by the local setup command.</p></div><form className="mt-8 grid gap-4" onSubmit={claimSetup}><div><label className="text-sm font-medium" htmlFor="setup-token">Setup token</label><Input id="setup-token" ref={tokenInputRef} type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" required aria-describedby="setup-token-help" className="mt-1 h-11 bg-muted/45" /><p id="setup-token-help" className="mt-1 text-xs text-muted-foreground">The token stays on this machine and is cleared after submission.</p></div>{formError && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}<Button type="submit" size="lg" className="w-full" disabled={submitting}>{submitting ? 'Checking token…' : 'Continue'}</Button></form></AuthFrame>
  )
}
