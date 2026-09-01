import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { RouteMetadata } from '@/components/RouteMetadata'
import {
  LEGACY_PROJECT_ROUTE,
  LEGACY_WORKSPACE_REDIRECTS,
  WORKSPACE_PATHS,
  withPreservedLocation,
  workspaceProjectPath,
} from '@/lib/workspace-routes'

const Landing = lazy(() => import('@/pages/Landing'))
const WorkspaceRoutes = lazy(() => import('@/WorkspaceRoutes'))
const WorkspaceEntry = lazy(() => import('@/pages/WorkspaceEntry'))
const AuthLogin = lazy(() => import('@/pages/AuthLogin'))
const AuthRecovery = lazy(() => import('@/pages/AuthRecovery'))
const InvitationReview = lazy(() => import('@/pages/InvitationReview'))
const Setup = lazy(() => import('@/pages/Setup'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function DeferredRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-48 flex-1 items-center justify-center p-6 text-sm text-muted-foreground" role="status">
          Loading page…
        </div>
      )}
    >
      {children}
    </Suspense>
  )
}

function RedirectWithLocation({
  to,
  requiredSearchParams,
}: {
  to: string
  requiredSearchParams?: Record<string, string | null | undefined>
}) {
  const location = useLocation()
  return <Navigate to={withPreservedLocation(to, location, requiredSearchParams)} replace />
}

function LegacyProjectRedirect() {
  const { projectId } = useParams()
  const location = useLocation()
  return <Navigate to={withPreservedLocation(workspaceProjectPath(projectId), location)} replace />
}

export default function App() {
  return (
    <>
      <RouteMetadata />
      <Routes>
        <Route path="/" element={<DeferredRoute><Landing /></DeferredRoute>} />
      <Route path="/auth/login" element={<DeferredRoute><AuthLogin /></DeferredRoute>} />
      <Route path="/auth/recover" element={<DeferredRoute><AuthRecovery /></DeferredRoute>} />
      <Route path="/invite/review" element={<DeferredRoute><InvitationReview /></DeferredRoute>} />
      <Route path="/login" element={<RedirectWithLocation to="/auth/login" />} />
      <Route path="/setup" element={<DeferredRoute><Setup /></DeferredRoute>} />
      <Route path="/onboarding" element={<DeferredRoute><WorkspaceEntry /></DeferredRoute>} />
      <Route path={`${WORKSPACE_PATHS.home}/*`} element={<DeferredRoute><WorkspaceRoutes /></DeferredRoute>} />
      {LEGACY_WORKSPACE_REDIRECTS.map((redirect) => (
        <Route
          key={redirect.path}
          path={redirect.path}
          element={<RedirectWithLocation to={redirect.to} requiredSearchParams={redirect.requiredSearchParams} />}
        />
      ))}
      <Route path={LEGACY_PROJECT_ROUTE} element={<LegacyProjectRedirect />} />
        <Route path="*" element={<DeferredRoute><NotFound /></DeferredRoute>} />
      </Routes>
    </>
  )
}
