import { Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router'
import { WorkspaceProvider } from '@/store/workspace'
import { QuickCaptureProvider } from '@/components/QuickCapture'
import { TaskDrawerProvider } from '@/components/TaskDrawer'
import { CommandPalette } from '@/components/CommandPalette'
import AppShell from '@/components/AppShell'
import Home from '@/pages/Home'
import Inbox from '@/pages/Inbox'
import Tasks from '@/pages/Tasks'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import Notes from '@/pages/Notes'
import CalendarPage from '@/pages/CalendarPage'
import Connections from '@/pages/Connections'
import Settings from '@/pages/Settings'
import WorkspaceEntry from '@/pages/WorkspaceEntry'
import AuthLogin from '@/pages/AuthLogin'
import Setup from '@/pages/Setup'
import NotFound from '@/pages/NotFound'
import { AppCommandsProvider } from '@/store/app-commands'

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
      <Route path="/auth/login" element={<AuthLogin />} />
      <Route path="/login" element={<RedirectWithSearch to="/auth/login" />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/onboarding" element={<WorkspaceEntry />} />
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
          <Route path="/" element={<Home />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
