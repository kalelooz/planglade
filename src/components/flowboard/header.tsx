"use client"

import * as React from "react"
import { Search, PanelLeft } from "lucide-react"

import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/flowboard/theme-toggle"
import { useAuth } from "@/components/flowboard/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut } from "lucide-react"
import { useNavStore, type ViewId } from "@/components/flowboard/nav-store"
import { useCommandPalette } from "@/components/flowboard/command-palette"

const viewTitles: Record<ViewId, string> = {
  dashboard: "Home",
  inbox: "Inbox",
  projects: "Projects",
  timeline: "Timeline",
  calendar: "Calendar",
  "my-tasks": "My Tasks",
  notes: "Notes",
  "graph-view": "Graph View",
  "activity-log": "Activity Log",
  team: "Team",
  settings: "Settings",
  "project-report": "Project Report",
}

export function Header() {
  const { toggleSidebar, isMobile } = useSidebar()
  const activeView = useNavStore((s) => s.activeView)
  const { open: openCommandPalette } = useCommandPalette()
  const { user, signOut } = useAuth()

  // Detect Mac for keyboard hint
  const [isMac, setIsMac] = React.useState(false)
  React.useEffect(() => {
    setIsMac(navigator.platform?.toUpperCase().includes("MAC") ?? false)
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Mobile sidebar trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="size-9 md:hidden"
        onClick={toggleSidebar}
      >
        <PanelLeft className="size-4" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Page title */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">
          {viewTitles[activeView]}
        </h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search — opens command palette */}
      <button
        onClick={openCommandPalette}
        className="hidden sm:flex items-center gap-2 h-9 w-64 rounded-md border border-transparent bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:border-border cursor-pointer"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {isMac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>

      {/* Theme toggle */}
      <ThemeToggle />

      {/* User avatar & sign out */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/80 transition-colors cursor-pointer"
            onClick={signOut}
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {user?.displayName?.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? "??"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden lg:inline text-sm text-muted-foreground max-w-[100px] truncate">
              {user?.displayName?.split(" ")[0] ?? "User"}
            </span>
            <LogOut className="size-3.5 text-muted-foreground hidden lg:inline" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sign out</p>
        </TooltipContent>
      </Tooltip>
    </header>
  )
}
