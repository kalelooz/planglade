import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Github, Loader2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthFrame } from '@/components/AuthFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeWorkspaceDestination } from '@/lib/auth-destination'
import { submitNextAuthSignIn, type AuthProvider } from '@/lib/next-auth-client'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'

type SetupStatus = 'checking' | 'available' | 'configuration-required' | 'unavailable'

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285f4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853" />
      <path d="M5.84 14.09A6.3 6.3 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="#fbbc05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335" />
    </svg>
  )
}

export default function AuthLogin() {
  const location = useLocation()
  const emailRef = useRef<HTMLInputElement>(null)
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const destination = normalizeWorkspaceDestination(params.get('next'))
  const inviteToken = params.get('inviteToken')
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('checking')
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [sessionAvailable, setSessionAvailable] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingProvider, setPendingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetch('/api/auth/setup', { cache: 'no-store', credentials: 'include', signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ status?: unknown }> : null)
        .then((payload) => {
          const status = payload?.status
          setSetupStatus(status === 'available' || status === 'configuration-required' || status === 'unavailable' ? status : 'unavailable')
        })
        .catch(() => !controller.signal.aborted && setSetupStatus('unavailable')),
      fetch('/api/auth/providers', { cache: 'no-store', credentials: 'include', signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<Record<string, AuthProvider>> : {})
        .then((payload) => setProviders(Object.values(payload)))
        .catch(() => !controller.signal.aborted && setProviders([])),
      fetch('/api/auth/session', { cache: 'no-store', credentials: 'include', signal: controller.signal })
        .then((response) => setSessionAvailable(response.ok))
        .catch(() => undefined),
    ])
    return () => controller.abort()
  }, [])

  const credentials = providers.find((provider) => provider.type === 'credentials')
  const oauthProviders = providers.filter((provider) => provider.type === 'oauth')
  const callbackUrl = inviteToken
    ? `/invite/review?inviteToken=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(destination)}`
    : destination

  async function signInWithCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!credentials || pendingProvider) return
    setPendingProvider(credentials.id)
    setError(null)
    try {
      const url = await submitNextAuthSignIn(credentials, callbackUrl, { email: email.trim(), password })
      if (!url) {
        setError('Email or password is incorrect. Wait a moment and try again.')
        requestAnimationFrame(() => emailRef.current?.focus())
      } else window.location.assign(url)
    } catch {
      setError('Sign-in could not be completed. Check your connection and try again.')
    } finally {
      setPassword('')
      setPendingProvider(null)
    }
  }

  async function signInWithProvider(provider: AuthProvider) {
    if (pendingProvider) return
    setPendingProvider(provider.id)
    setError(null)
    try {
      const url = await submitNextAuthSignIn(provider, callbackUrl)
      if (!url) setError(`${provider.name} sign-in could not be started.`)
      else window.location.assign(url)
    } catch {
      setError(`${provider.name} sign-in could not be started. Check your connection and try again.`)
    } finally {
      setPendingProvider(null)
    }
  }

  const checking = setupStatus === 'checking'

  return (
    <AuthFrame>
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {checking ? 'Getting ready' : setupStatus === 'available' ? 'First-time setup' : inviteToken ? 'Workspace invitation' : 'Sign in'}
        </p>
        <h1 className="pg-page-title mt-3">
          {checking ? 'Checking this installation' : setupStatus === 'available' ? 'Set up PlanGlade' : inviteToken ? 'Join your workspace' : 'Welcome back'}
        </h1>
        <p className="pg-body-muted mt-3">
          {checking ? 'Confirming whether PlanGlade is ready for setup or sign-in.' : setupStatus === 'available' ? 'Create the owner account and first workspace. No OAuth or email service is required.' : inviteToken ? 'Sign in to review and accept this invitation.' : 'Continue to your workspace.'}
        </p>

        <div className="mt-8">
          {checking ? (
            <div role="status" className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Checking installation status…</div>
          ) : setupStatus === 'available' ? (
            <div className="rounded-lg border border-border bg-muted/65 p-4">
              <p className="text-sm font-medium">This installation is ready for its owner.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Create one local account, name the workspace, and save the recovery codes.</p>
              <Button asChild size="lg" className="mt-4 w-full"><Link to={destination === WORKSPACE_PATHS.home ? '/setup' : `/setup?next=${encodeURIComponent(destination)}`}>Start setup</Link></Button>
            </div>
          ) : setupStatus === 'configuration-required' ? (
            <div role="alert" className="rounded-md border border-border bg-muted px-3 py-3 text-sm"><p className="font-medium">First-time setup needs installation configuration.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Run <code className="font-mono text-foreground">npm run setup:local</code>, restart PlanGlade, then return here.</p></div>
          ) : sessionAvailable ? (
            <Button asChild size="lg" className="w-full"><Link to={callbackUrl}>{inviteToken ? 'Review invitation' : 'Continue to workspace'}</Link></Button>
          ) : (
            <div className="space-y-5">
              {credentials && (
                <form className="space-y-4" onSubmit={signInWithCredentials}>
                  <div><label htmlFor="login-email" className="text-sm font-medium">Email</label><Input ref={emailRef} id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={320} required aria-invalid={Boolean(error)} aria-describedby={error ? 'sign-in-error' : undefined} className="mt-1 h-11 bg-muted/45" /></div>
                  <div><label htmlFor="login-password" className="text-sm font-medium">Password</label><Input id="login-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={128} required aria-invalid={Boolean(error)} aria-describedby={error ? 'sign-in-error' : undefined} className="mt-1 h-11 bg-muted/45" /></div>
                  <Button type="submit" size="lg" className="w-full" disabled={Boolean(pendingProvider)}>{pendingProvider === credentials.id && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{pendingProvider === credentials.id ? 'Signing in…' : inviteToken ? 'Sign in to review invitation' : 'Sign in'}</Button>
                </form>
              )}
              {credentials && oauthProviders.length > 0 && <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">or</span><span className="h-px flex-1 bg-border" /></div>}
              {oauthProviders.map((provider) => (
                <Button key={provider.id} type="button" variant="outline" size="lg" className="w-full" disabled={Boolean(pendingProvider)} onClick={() => void signInWithProvider(provider)}>
                  {pendingProvider === provider.id ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : provider.id === 'google' ? <GoogleLogo /> : provider.id === 'github' ? <Github className="size-5" aria-hidden="true" /> : null}
                  {pendingProvider === provider.id ? 'Opening sign-in…' : `Continue with ${provider.name}`}
                </Button>
              ))}
              {!credentials && oauthProviders.length === 0 && <div role="alert" className="rounded-md border border-border bg-muted px-3 py-3 text-sm">No sign-in method is enabled. Run the local setup command or ask the administrator to configure one.</div>}
            </div>
          )}
          <p id="sign-in-error" role={error ? 'alert' : undefined} className={error ? 'mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive' : 'sr-only'}>{error}</p>
          {inviteToken && <p role="status" className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">Signing in does not accept the invitation. You will review the workspace and role before deciding.</p>}
          <p className="mt-5 text-xs leading-5 text-muted-foreground">{setupStatus === 'available' ? 'The setup token stays on this machine and is used only to claim the first owner account.' : credentials ? 'Your password is verified by this PlanGlade installation.' : 'Sign-in availability is controlled by this installation.'}</p>
        </div>
      </div>
    </AuthFrame>
  )
}
