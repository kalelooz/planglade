import { lazy, Suspense, type ReactNode } from 'react'
import { Outlet, Route, Routes } from 'react-router'
import { AppCommandsProvider } from '@/store/app-commands'
import { WorkspaceProvider } from '@/store/workspace'
import { QuickCaptureProvider } from '@/components/QuickCapture'
import { TaskDrawerProvider } from '@/components/TaskDrawer'
import { CommandPalette } from '@/components/CommandPalette'
import AppShell from '@/components/AppShell'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'

const Home = lazy(() => import('@/pages/Home'))
const Inbox = lazy(() => import('@/pages/Inbox'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Projects = lazy(() => import('@/pages/Projects'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const Notes = lazy(() => import('@/pages/Notes'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const Connections = lazy(() => import('@/pages/Connections'))
const Settings = lazy(() => import('@/pages/Settings'))
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

export default function WorkspaceRoutes() {
  return (
    <Routes>
      <Route element={<WorkspaceApp />}>
        <Route element={<AppShell />}>
          <Route index element={<DeferredRoute><Home /></DeferredRoute>} />
          <Route path="inbox" element={<DeferredRoute><Inbox /></DeferredRoute>} />
          <Route path="tasks" element={<DeferredRoute><Tasks /></DeferredRoute>} />
          <Route path="projects" element={<DeferredRoute><Projects /></DeferredRoute>} />
          <Route path="projects/:projectId" element={<DeferredRoute><ProjectDetail /></DeferredRoute>} />
          <Route path="notes" element={<DeferredRoute><Notes /></DeferredRoute>} />
          <Route path="calendar" element={<DeferredRoute><CalendarPage /></DeferredRoute>} />
          <Route path="connections" element={<DeferredRoute><Connections /></DeferredRoute>} />
          <Route path="settings" element={<DeferredRoute><Settings /></DeferredRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<DeferredRoute><NotFound homeHref={WORKSPACE_PATHS.home} /></DeferredRoute>} />
    </Routes>
  )
}
