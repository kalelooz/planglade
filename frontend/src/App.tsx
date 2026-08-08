import { Routes, Route, Outlet } from 'react-router'
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

function WorkspaceApp() {
  return (
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
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<WorkspaceEntry />} />
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
          <Route path="*" element={<Home />} />
        </Route>
      </Route>
    </Routes>
  )
}
