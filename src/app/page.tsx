"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GripVertical } from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/flowboard/app-sidebar"
import { Header } from "@/components/flowboard/header"
import { Dashboard, InboxView } from "@/components/flowboard/dashboard"
import { KanbanBoard } from "@/components/flowboard/kanban-board"
import { NotesView } from "@/components/flowboard/notes-view"
import { GraphView } from "@/components/flowboard/graph-view"
import { ActivityLog } from "@/components/flowboard/activity-log"
import { ProjectReport } from "@/components/flowboard/project-report"
import { GanttView } from "@/components/flowboard/gantt-view"
import { CalendarView } from "@/components/flowboard/calendar-view"
import { TeamView } from "@/components/flowboard/team-view"
import { SettingsView } from "@/components/flowboard/settings-view"
import { MyTasksView } from "@/components/flowboard/my-tasks-view"
import { AuthProvider, useAuth } from "@/components/flowboard/auth-context"
import { LoginPage } from "@/components/flowboard/login-page"
import { useNavStore, type ViewId } from "@/components/flowboard/nav-store"
import { CommandPalette } from "@/components/flowboard/command-palette"
import { DrawerProvider } from "@/components/flowboard/drawer-context"
import { UniversalDrawer } from "@/components/flowboard/universal-drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Sidebar Resize Handle
// ---------------------------------------------------------------------------

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_DEFAULT_WIDTH = 256

function SidebarResizeHandle({
  sidebarWidth,
  onWidthChange,
}: {
  sidebarWidth: number
  onWidthChange: (width: number) => void
}) {
  const isDragging = React.useRef(false)
  const startX = React.useRef(0)
  const startWidth = React.useRef(0)

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const delta = moveEvent.clientX - startX.current
        const newWidth = Math.max(
          SIDEBAR_MIN_WIDTH,
          Math.min(SIDEBAR_MAX_WIDTH, startWidth.current + delta)
        )
        onWidthChange(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [sidebarWidth, onWidthChange]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "group relative z-40 flex w-1 cursor-col-resize items-center justify-center",
        "bg-border transition-colors duration-200 hover:bg-primary/40",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2"
      )}
    >
      <div className="z-10 flex h-6 w-4 items-center justify-center rounded-sm border border-border bg-background opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <GripVertical className="size-3 text-muted-foreground" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View Router
// ---------------------------------------------------------------------------

function ViewContent({ view }: { view: ViewId }) {
  switch (view) {
    case "dashboard":
      return <Dashboard />
    case "inbox":
      return <InboxView />
    case "projects":
      return <KanbanBoard />
    case "timeline":
      return <GanttView />
    case "calendar":
      return <CalendarView />
    case "my-tasks":
      return <MyTasksView />
    case "notes":
      return <NotesView />
    case "graph-view":
      return <GraphView />
    case "activity-log":
      return <ActivityLog />
    case "team":
      return <TeamView />
    case "settings":
      return <SettingsView />
    case "project-report":
      return <ProjectReport />
    default:
      return <Dashboard />
  }
}

function ViewRouter() {
  const activeView = useNavStore((s) => s.activeView)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        <ViewContent view={activeView} />
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------

function MainLayout() {
  const isMobile = useIsMobile()
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_DEFAULT_WIDTH)

  const handleWidthChange = React.useCallback((width: number) => {
    setSidebarWidth(width)
  }, [])

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": `${sidebarWidth}px`,
        "--sidebar-width-icon": "3rem",
      } as React.CSSProperties}
    >
      <AppSidebar />
      {/* Desktop: resize handle between sidebar and content */}
      {!isMobile && (
        <SidebarResizeHandle
          sidebarWidth={sidebarWidth}
          onWidthChange={handleWidthChange}
        />
      )}
      <SidebarInset className="flex flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6 overflow-auto">
            <ViewRouter />
          </div>
          <UniversalDrawer />
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}

// ---------------------------------------------------------------------------
// Auth Guard — shows login page if not authenticated
// ---------------------------------------------------------------------------

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <>{children}</>
}

// ---------------------------------------------------------------------------
// Home Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <AuthProvider>
      <AuthGuard>
        <DrawerProvider>
          <MainLayout />
        </DrawerProvider>
      </AuthGuard>
    </AuthProvider>
  )
}
