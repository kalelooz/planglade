"use client"

import * as React from "react"
import {
  Home,
  Inbox,
  FolderKanban,
  GanttChartSquare,
  CalendarDays,
  CheckSquare,
  StickyNote,
  GitBranch,
  History,
  Users,
  Settings,
  Plus,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { useNavStore, type ViewId } from "@/components/flowboard/nav-store"
import { projectFormSchema, type ProjectFormValues } from "@/components/flowboard/schemas"

const primaryNavItems: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  viewId: ViewId
  badge?: string
}[] = [
  {
    title: "Home",
    icon: Home,
    viewId: "dashboard",
    badge: undefined,
  },
  {
    title: "Inbox",
    icon: Inbox,
    viewId: "inbox",
    badge: undefined,
  },
  {
    title: "Projects",
    icon: FolderKanban,
    viewId: "projects",
    badge: "5",
  },
  {
    title: "My Tasks",
    icon: CheckSquare,
    viewId: "my-tasks",
    badge: "12",
  },
  {
    title: "Notes",
    icon: StickyNote,
    viewId: "notes",
    badge: undefined,
  },
  {
    title: "Calendar",
    icon: CalendarDays,
    viewId: "calendar",
    badge: undefined,
  },
]

const advancedNavItems: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  viewId: ViewId
  badge?: string
}[] = [
  {
    title: "Timeline",
    icon: GanttChartSquare,
    viewId: "timeline",
    badge: undefined,
  },
  {
    title: "Graph View",
    icon: GitBranch,
    viewId: "graph-view",
    badge: undefined,
  },
  {
    title: "Activity Log",
    icon: History,
    viewId: "activity-log",
    badge: undefined,
  },
  {
    title: "Team",
    icon: Users,
    viewId: "team",
    badge: "5",
  },
]

function FlowBoardLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="6"
        className="fill-primary"
      />
      <path
        d="M9 10h6v4H9zM17 10h6v4h-6zM13 18h6v4h-6z"
        className="fill-primary-foreground"
      />
      <path
        d="M15 14l-2 4M17 14l2 4"
        className="stroke-primary-foreground"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Project Color Presets ────────────────────────────────────────────────

const PROJECT_COLORS = [
  { name: "Teal", value: "#01696f" },
  { name: "Blue", value: "#3b5bdb" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Orange", value: "#ea580c" },
  { name: "Rose", value: "#e11d48" },
  { name: "Green", value: "#059669" },
]

// ---------------------------------------------------------------------------
// Create Project Dialog
// ---------------------------------------------------------------------------

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "",
      startDate: "",
      endDate: "",
    },
  })

  const onSubmit = (values: ProjectFormValues) => {
    toast.success("Project created ✓")
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) form.reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Add a new project to your workspace.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Enter project name..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional description..." className="resize-none" rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-3">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => field.onChange(c.value)}
                        className={cn(
                          "size-8 rounded-full transition-all ring-2 ring-offset-2 ring-offset-background",
                          field.value === c.value
                            ? "ring-primary scale-110"
                            : "ring-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={!form.formState.isValid}
              >
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activeView, setActiveView } = useNavStore()
  const { isMobile, setOpenMobile } = useSidebar()
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

  const handleNavClick = (viewId: ViewId) => {
    setActiveView(viewId)
    // Auto-close sidebar on mobile when a nav item is tapped
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // Project Report is accessed from Home - highlight Home when on that view
  const effectiveView = activeView === "project-report" ? "dashboard" : activeView

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="gap-3">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                <FlowBoardLogo />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">FlowBoard</span>
                <span className="text-xs text-muted-foreground">Project Manager</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavItems.map((item) => {
                const isProjectRow = item.badge && item.viewId === "projects"
                return (
                <SidebarMenuItem key={item.title} className={isProjectRow ? "flex items-center" : undefined}>
                  <SidebarMenuButton
                    isActive={effectiveView === item.viewId}
                    tooltip={item.title}
                    onClick={() => handleNavClick(item.viewId)}
                    className={isProjectRow ? "flex-1 min-w-0 w-auto pr-2" : undefined}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {isProjectRow ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="bg-muted rounded-full px-1.5 text-[10px] font-medium text-muted-foreground leading-none tabular-nums">{item.badge}</span>
                      <button
                        className="size-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); setCreateProjectOpen(true) }}
                        title="New Project"
                      >
                        <Plus className="size-3.5" />
                        <span className="sr-only">New Project</span>
                      </button>
                    </div>
                  ) : item.badge ? (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Advanced</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advancedNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={effectiveView === item.viewId}
                    tooltip={item.title}
                    onClick={() => handleNavClick(item.viewId)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge ? (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarSeparator />
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "settings"}
                  tooltip="Settings"
                  onClick={() => handleNavClick("settings")}
                >
                  <Settings className="size-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  AM
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-medium">Alex Morgan</span>
                <span className="text-xs text-muted-foreground">
                  alex@flowboard.io
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      {/* Create Project Dialog */}
      <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
    </Sidebar>
  )
}
