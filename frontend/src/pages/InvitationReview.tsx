import { useEffect, useMemo, useState } from 'react'
import { Loader2, MailCheck, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { AuthFrame } from '@/components/AuthFrame'
import { Button } from '@/components/ui/button'
import { acceptWorkspaceInvite, previewWorkspaceInvite, type WorkspaceInviteReview } from '@/lib/api/team'
import { ApiError } from '@/lib/api/errors'
import { normalizeWorkspaceDestination } from '@/lib/auth-destination'
import { rememberActiveWorkspace } from '@/lib/active-workspace'

type ReviewState = 'loading' | 'ready' | 'authentication-required' | 'unavailable' | 'temporary-error'
type ReviewResult = { token: string; state: Exclude<ReviewState, 'loading'>; review: WorkspaceInviteReview | null }

function roleDescription(role: WorkspaceInviteReview['role']) {
  if (role === 'ADMIN') return 'Admin — manage people and workspace settings'
  if (role === 'VIEWER') return 'Viewer — read-only workspace access'
  return 'Member — create and update workspace content'
}

export default function InvitationReview() {
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const inviteToken = params.get('inviteToken')
  const destination = normalizeWorkspaceDestination(params.get('next'))
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<'temporary' | 'unavailable' | null>(null)
  const state: ReviewState = result?.token === inviteToken ? result.state : inviteToken ? 'loading' : 'unavailable'
  const review = result?.token === inviteToken ? result.review : null
  const loginHref = inviteToken
    ? `/auth/login?inviteToken=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(destination)}`
    : '/auth/login'

  useEffect(() => {
    if (!inviteToken) return
    const controller = new AbortController()
    void previewWorkspaceInvite(inviteToken, controller.signal)
      .then((preview) => setResult({ token: inviteToken, state: 'ready', review: preview }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const state = error instanceof ApiError && error.kind === 'unauthenticated'
          ? 'authentication-required'
          : !(error instanceof ApiError) || error.kind === 'temporary' || error.kind === 'unknown'
            ? 'temporary-error'
            : 'unavailable'
        setResult({ token: inviteToken, state, review: null })
      })
    return () => controller.abort()
  }, [inviteToken, previewAttempt])

  function retryPreview() {
    setResult(null)
    setPreviewAttempt((attempt) => attempt + 1)
  }

  async function accept() {
    if (!inviteToken || accepting || review?.alreadyAccepted) return
    setAccepting(true)
    setAcceptError(null)
    try {
      const accepted = await acceptWorkspaceInvite(inviteToken)
      rememberActiveWorkspace(localStorage, accepted.workspace.id)
      window.location.assign(destination)
    } catch (error) {
      setAcceptError(
        !(error instanceof ApiError) || error.kind === 'temporary' || error.kind === 'unknown'
          ? 'temporary'
          : 'unavailable',
      )
      setAccepting(false)
    }
  }

  return (
    <AuthFrame>
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace invitation</p>
        <h1 className="pg-page-title mt-3">Review before joining</h1>
        <p className="pg-body-muted mt-3">Opening an invitation never grants access. Review the details, then choose whether to join.</p>

        {state === 'loading' && <div role="status" className="mt-8 flex min-h-20 items-center gap-3 rounded-lg border border-border bg-muted/45 px-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Checking this invitation…</div>}

        {state === 'authentication-required' && (
          <div className="mt-8 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-muted-foreground" /><div><p className="text-sm font-semibold">Sign in to review safely</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Use the exact email address that received the invitation. Signing in still does not accept it.</p></div></div>
            <Button asChild size="lg" className="mt-5 w-full"><Link to={loginHref}>Sign in to review invitation</Link></Button>
          </div>
        )}

        {state === 'temporary-error' && (
          <div role="alert" className="mt-8 rounded-lg border border-border bg-muted/45 p-5">
            <p className="text-sm font-semibold">This invitation could not be checked</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">PlanGlade could not reach the invitation service. Your access has not changed.</p>
            <Button type="button" className="mt-5 h-11 w-full" onClick={retryPreview}>Try again</Button>
          </div>
        )}

        {state === 'unavailable' && (
          <div role="alert" className="mt-8 rounded-lg border border-border bg-muted/45 p-5">
            <p className="text-sm font-semibold">This invitation cannot be reviewed</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">It may be expired, revoked, invalid, or tied to a different signed-in email address.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row"><Button asChild variant="outline" className="h-11 flex-1"><Link to="/auth/login">Not now</Link></Button>{inviteToken && <Button asChild className="h-11 flex-1"><Link to={loginHref}>Use another account</Link></Button>}</div>
          </div>
        )}

        {state === 'ready' && review && (
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border bg-muted/30 p-5"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 size-5 text-muted-foreground" /><div className="min-w-0"><p className="text-sm text-muted-foreground">You were invited to</p><p className="truncate text-lg font-semibold tracking-tight">{review.workspace.name}</p></div></div></div>
            <dl className="divide-y divide-border/70 px-5">
              <div className="grid gap-1 py-4 sm:grid-cols-[120px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><UserRound className="size-3.5" />Invited by</dt><dd className="min-w-0 text-sm"><span className="font-medium">{review.invitedBy.name || review.invitedBy.email}</span><span className="block truncate text-xs text-muted-foreground">{review.invitedBy.email}</span></dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[120px_1fr]"><dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><MailCheck className="size-3.5" />Your email</dt><dd className="truncate text-sm">{review.email}</dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[120px_1fr]"><dt className="text-xs font-medium text-muted-foreground">Access level</dt><dd className="text-sm">{roleDescription(review.role)}</dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[120px_1fr]"><dt className="text-xs font-medium text-muted-foreground">Expires</dt><dd className="text-sm">{new Date(review.expiresAt).toLocaleDateString()}</dd></div>
            </dl>
            {review.customMessage && <div className="border-t border-border bg-muted/20 px-5 py-4"><p className="text-xs font-medium text-muted-foreground">Message from the inviter</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{review.customMessage}</p></div>}
            <div className="border-t border-border p-5">
              <p className="text-xs leading-5 text-muted-foreground">Access is granted only after you press Accept invitation. If this was sent by mistake, choose Not now.</p>
              {acceptError && <p role="alert" className="mt-3 text-sm text-destructive">{acceptError === 'temporary' ? 'The invitation service could not be reached. Try accepting again.' : 'The invitation could not be accepted. It may have changed or expired.'}</p>}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button asChild variant="outline" className="h-11 sm:h-9"><Link to="/auth/login">Not now</Link></Button>{review.alreadyAccepted ? <Button asChild className="h-11 sm:h-9"><Link to={destination} onClick={() => rememberActiveWorkspace(localStorage, review.workspace.id)}>Continue to workspace</Link></Button> : <Button type="button" className="h-11 sm:h-9" disabled={accepting} onClick={() => void accept()}>{accepting && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{accepting ? 'Joining…' : 'Accept invitation'}</Button>}</div>
            </div>
          </div>
        )}
      </div>
    </AuthFrame>
  )
}
