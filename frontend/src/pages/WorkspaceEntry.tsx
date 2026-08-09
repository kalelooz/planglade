import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { getSession } from '@/lib/api/session'
import { createWorkspace } from '@/lib/api/onboarding'
import { toApiError } from '@/lib/api/errors'
import { authLoginHref, normalizeWorkspaceDestination } from '@/lib/auth-destination'
import { AuthFrame } from '@/components/AuthFrame'

function EntryFrame({ children }: { children: ReactNode }) {
  return <AuthFrame compact>{children}</AuthFrame>
}

export default function WorkspaceEntry() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const destination = normalizeWorkspaceDestination(new URLSearchParams(location.search).get('next'))
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: ({ signal }) => getSession(null, signal),
    retry: false,
  })
  const sessionError = sessionQuery.error ? toApiError(sessionQuery.error) : null
  const onboardingRequired = sessionError?.kind === 'onboarding_required'
  const onboarding = useMutation({
    mutationFn: createWorkspace,
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate(destination, { replace: true })
    },
  })

  useEffect(() => {
    if (onboardingRequired) nameInput.current?.focus()
  }, [onboardingRequired])

  if (sessionQuery.isPending) {
    return (
      <EntryFrame>
        <h1 className="pg-page-title">Preparing your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Checking your PlanGlade session.</p>
        <button className="mt-6 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled>
          Loading workspace…
        </button>
      </EntryFrame>
    )
  }

  if (onboardingRequired) {
    const validName = name.trim().length >= 2
    const mutationError = onboarding.error ? toApiError(onboarding.error) : null
    return (
      <EntryFrame>
        <h1 className="pg-page-title">Create your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a name to finish setting up PlanGlade.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (validName) onboarding.mutate(name.trim())
          }}
        >
          <div>
            <label className="text-sm font-medium" htmlFor="workspace-name">Workspace name</label>
            <input
              ref={nameInput}
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby="workspace-name-help"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              maxLength={80}
              required
            />
            <p id="workspace-name-help" className="mt-1 text-xs text-muted-foreground">Use at least two characters.</p>
          </div>
          {mutationError && <p role="alert" className="text-sm text-destructive">PlanGlade could not create the workspace. Please try again.</p>}
          <button
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={!validName || onboarding.isPending}
          >
            {onboarding.isPending ? 'Creating workspace…' : 'Continue to workspace'}
          </button>
        </form>
      </EntryFrame>
    )
  }

  if (sessionError) {
    const signedOut = sessionError.kind === 'unauthenticated'
    return (
      <EntryFrame>
        <h1 className="pg-page-title">{signedOut ? 'Sign in to continue' : 'PlanGlade is temporarily unavailable'}</h1>
        <p role="alert" className="mt-2 text-sm text-muted-foreground">
          {signedOut ? 'Your PlanGlade session is not active.' : 'Please try again when the workspace service is available.'}
        </p>
        {signedOut ? (
          <a className="mt-6 flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={authLoginHref(destination)}>
            Continue to sign in
          </a>
        ) : (
          <button
            className="mt-6 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => void sessionQuery.refetch()}
          >
            Try again
          </button>
        )}
      </EntryFrame>
    )
  }

  return (
    <EntryFrame>
      <h1 className="pg-page-title">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your workspace is ready.</p>
      <button
        className="mt-6 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        onClick={() => navigate(destination, { replace: true })}
      >
        Continue to workspace
      </button>
    </EntryFrame>
  )
}
