import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router'
import { WorkspaceProvider } from '@/store/workspace'
import { QuickCaptureProvider } from '@/components/QuickCapture'
import { TaskDrawerProvider } from '@/components/TaskDrawer'
import { CommandPalette } from '@/components/CommandPalette'
import AppShell from '@/components/AppShell'
import { AppCommandsProvider } from '@/store/app-commands'

const Home = lazy(() => import('@/pages/Home'))
const Inbox = lazy(() => import('@/pages/Inbox'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Projects = lazy(() => import('@/pages/Projects'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const Notes = lazy(() => import('@/pages/Notes'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const Connections = lazy(() => import('@/pages/Connections'))
const Settings = lazy(() => import('@/pages/Settings'))
const WorkspaceEntry = lazy(() => import('@/pages/WorkspaceEntry'))
const AuthLogin = lazy(() => import('@/pages/AuthLogin'))
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

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />
}

function LegacyProjectRedirect() {
  const { projectId } = useParams()
  const location = useLocation()
  return <Navigate to={`/projects/${encodeURIComponent(projectId ?? '')}${location.search}${location.hash}`} replace />
}

function WorkspaceApp() {
  return (
    <AppCommandsProvider>
      <WorkspaceProvider>
        <QuickCaptureProvider>
          <TaskDrawerProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-2 focus:text-sm"
          >
            Skip to content
          </a>
          <Outlet />
          <CommandPalette />
          </TaskDrawerProvider>
        </QuickCaptureProvider>
      </WorkspaceProvider>
    </AppCommandsProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<DeferredRoute><AuthLogin /></DeferredRoute>} />
      <Route path="/invite/review" element={<DeferredRoute><InvitationReview /></DeferredRoute>} />
      <Route path="/login" element={<RedirectWithSearch to="/auth/login" />} />
      <Route path="/setup" element={<DeferredRoute><Setup /></DeferredRoute>} />
      <Route path="/onboarding" element={<DeferredRoute><WorkspaceEntry /></DeferredRoute>} />
      <Route path="/app" element={<RedirectWithSearch to="/" />} />
      <Route path="/app/inbox" element={<RedirectWithSearch to="/inbox" />} />
      <Route path="/app/tasks" element={<RedirectWithSearch to="/tasks" />} />
      <Route path="/app/projects" element={<RedirectWithSearch to="/projects" />} />
      <Route path="/app/projects/:projectId" element={<LegacyProjectRedirect />} />
      <Route path="/app/notes" element={<RedirectWithSearch to="/notes" />} />
      <Route path="/app/calendar" element={<RedirectWithSearch to="/calendar" />} />
      <Route path="/app/connections" element={<RedirectWithSearch to="/connections" />} />
      <Route path="/app/settings" element={<RedirectWithSearch to="/settings" />} />
      <Route path="/board" element={<Navigate to="/tasks?view=board" replace />} />
      <Route path="/my-tasks" element={<Navigate to="/tasks?filter=mine" replace />} />
      <Route element={<WorkspaceApp />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DeferredRoute><Home /></DeferredRoute>} />
          <Route path="/inbox" element={<DeferredRoute><Inbox /></DeferredRoute>} />
          <Route path="/tasks" element={<DeferredRoute><Tasks /></DeferredRoute>} />
          <Route path="/projects" element={<DeferredRoute><Projects /></DeferredRoute>} />
          <Route path="/projects/:projectId" element={<DeferredRoute><ProjectDetail /></DeferredRoute>} />
          <Route path="/notes" element={<DeferredRoute><Notes /></DeferredRoute>} />
          <Route path="/calendar" element={<DeferredRoute><CalendarPage /></DeferredRoute>} />
          <Route path="/connections" element={<DeferredRoute><Connections /></DeferredRoute>} />
          <Route path="/settings" element={<DeferredRoute><Settings /></DeferredRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<DeferredRoute><NotFound /></DeferredRoute>} />
    </Routes>
  )
}
