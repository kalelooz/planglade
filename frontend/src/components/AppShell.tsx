import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  Home, Inbox, CheckSquare, FolderOpen, StickyNote, CalendarDays, Waypoints, Settings as SettingsIcon,
  Search, Plus, PanelLeftClose, PanelLeftOpen, Menu, Moon, Sun, MonitorSmartphone, CircleUserRound,
  Check, ChevronsUpDown, CreditCard, Github, LifeBuoy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import { useQuickCapture } from '@/components/QuickCapture'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { NotificationCenter } from '@/components/NotificationCenter'
import { CountBadge } from '@/components/bits'
import { PlanGladeMark } from '@/components/PlanGladeBrand'
import { useAppCommands } from '@/store/app-commands'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'
import { SupportSheet } from '@/components/SupportSheet'

const NAV = [
  { name: 'Home', path: WORKSPACE_PATHS.home, icon: Home },
  { name: 'Inbox', path: WORKSPACE_PATHS.inbox, icon: Inbox },
  { name: 'Tasks', path: WORKSPACE_PATHS.tasks, icon: CheckSquare },
  { name: 'Projects', path: WORKSPACE_PATHS.projects, icon: FolderOpen },
  { name: 'Notes', path: WORKSPACE_PATHS.notes, icon: StickyNote },
  { name: 'Calendar', path: WORKSPACE_PATHS.calendar, icon: CalendarDays },
  { name: 'Connections', path: WORKSPACE_PATHS.connections, icon: Waypoints },
  { name: 'Settings', path: WORKSPACE_PATHS.settings, icon: SettingsIcon },
]

function AppearanceMenu({ triggerClassName }: { triggerClassName?: string }) {
  const ws = useWorkspace()
  const theme = ws.state.settings.theme
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorSmartphone
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Change appearance" className={cn('text-muted-foreground hover:text-foreground', triggerClassName)}>
              <Icon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Appearance</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', MonitorSmartphone, 'System']] as const).map(([v, I, label]) => (
          <DropdownMenuItem key={v} onClick={() => ws.updateSettings({ theme: v })} aria-checked={theme === v}>
            <I className="mr-2 h-4 w-4" /> {label}
            {theme === v && <span className="ml-auto text-xs text-muted-foreground">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FooterLink({
  to,
  label,
  collapsed = false,
  className,
  onNavigate,
}: {
  to: string
  label: string
  collapsed?: boolean
  className?: string
  onNavigate?: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          onClick={onNavigate}
          aria-label={label}
          className={cn(
            'flex h-8 w-full items-center justify-start gap-2 rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
            isActive && 'bg-accent text-foreground font-medium',
            collapsed && 'w-8 justify-center px-0',
            className,
          )}
        >
          <CreditCard className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  )
}

function SupportButton({
  collapsed = false,
  className,
  onClick,
}: {
  collapsed?: boolean
  className?: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn('h-8 w-full justify-start gap-2 px-2 text-[12.5px] text-muted-foreground hover:bg-accent/70 hover:text-foreground', collapsed && 'w-8 justify-center px-0', className)}
          aria-label="Help and support"
        >
          <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">Help &amp; support</span>}
        </Button>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">Help &amp; support</TooltipContent>}
    </Tooltip>
  )
}

function WorkspaceSwitcher({ collapsed = false, mobile = false }: { collapsed?: boolean; mobile?: boolean }) {
  const ws = useWorkspace()
  const current = ws.workspaces.find((workspace) => workspace.id === ws.workspaceId) ?? ws.workspaces[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const validName = name.trim().length >= 2

  const createWorkspace = async () => {
    if (!validName || pending) return
    setPending(true)
    const created = await ws.createWorkspace(name)
    setPending(false)
    if (created) {
      setName('')
      setCreateOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Switch workspace. Current workspace: ${current?.name ?? ws.state.workspaceName}`}
                className={cn(
                  'min-w-0 justify-start gap-2 text-left hover:bg-sidebar-accent',
                  mobile ? 'h-11 flex-1 px-2' : 'h-11 w-full px-2',
                  collapsed && 'w-10 justify-center px-0',
                )}
              >
                <PlanGladeMark className="size-7" />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-semibold">{current?.name ?? ws.state.workspaceName}</span>
                      <span className="block truncate text-[12.5px] capitalize text-muted-foreground">{current?.role?.toLowerCase() ?? 'workspace'}</span>
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Switch workspace</TooltipContent>}
        </Tooltip>
        <DropdownMenuContent align="start" side={mobile ? 'bottom' : 'right'} sideOffset={6} className="w-[min(17rem,calc(100vw-1rem))] p-1.5">
          <DropdownMenuLabel className="px-2.5 py-2 text-[12.5px] font-medium text-muted-foreground">Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ws.workspaces.map((workspace) => {
            const selected = workspace.id === ws.workspaceId || (!ws.workspaceId && workspace.id === current?.id)
            return (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => !selected && ws.switchWorkspace(workspace.id)}
                className={cn(
                  'min-h-12 gap-2.5 rounded-md px-2.5 py-2 data-[highlighted]:bg-accent/70',
                  selected && 'bg-secondary text-foreground data-[highlighted]:bg-secondary',
                )}
              >
                <span className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-md text-[12.5px] font-semibold uppercase',
                  selected ? 'bg-background text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]' : 'bg-accent text-foreground',
                )} aria-hidden>{workspace.name.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{workspace.name}</span>
                  <span className="block text-[12.5px] capitalize text-muted-foreground">{workspace.role.toLowerCase()}</span>
                </span>
                <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
                  {selected && <Check className="h-4 w-4" aria-label="Current workspace" />}
                </span>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="min-h-9 gap-2 rounded-md px-2.5">
            <Plus className="h-4 w-4" aria-hidden />
            New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base">New workspace</DialogTitle>
            <DialogDescription>Create a separate space for another team, client, or project group.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void createWorkspace()
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Workspace name"
              className="h-9"
              placeholder="Workspace name"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!validName || pending}>
                {pending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const ws = useWorkspace()
  const inboxCount = ws.inbox.length
  return (
    <nav aria-label="Primary" className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
      {NAV.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === WORKSPACE_PATHS.home}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-2.5 rounded-md px-2.5 h-9 text-[13.5px] transition-colors duration-150 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
              isActive
                ? 'bg-accent text-foreground font-medium'
                : 'text-sidebar-foreground hover:text-foreground hover:bg-accent/60',
              collapsed && 'justify-center px-0',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2.5px] rounded-full bg-foreground/70" aria-hidden />}
              <item.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {!collapsed && <span className="truncate">{item.name}</span>}
              {!collapsed && item.name === 'Inbox' && inboxCount > 0 && (
                <CountBadge className="ml-auto" count={inboxCount} label={`${inboxCount} items in inbox`} />
              )}
              {collapsed && <span className="sr-only">{item.name}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

export default function AppShell() {
  const ws = useWorkspace()
  const currentWorkspace = ws.workspaces.find((workspace) => workspace.id === ws.workspaceId) ?? ws.workspaces[0]
  const { openCapture } = useQuickCapture()
  const location = useLocation()
  const navigate = useNavigate()
  const commands = useAppCommands()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('planglade-sidebar') === 'collapsed')
  const [mobileNav, setMobileNav] = useState({ open: false, path: location.pathname })
  const [supportOpen, setSupportOpen] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const mobileNavOpen = mobileNav.open && mobileNav.path === location.pathname

  useEffect(() => {
    localStorage.setItem('planglade-sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => commands.subscribe('open-support', () => setSupportOpen(true)), [commands])

  const toggleCollapse = () => setCollapsed((c) => !c)

  return (
    <>
      <div className="min-h-dvh bg-background flex">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex',
            collapsed ? 'w-[60px]' : 'w-[228px]',
          )}
          aria-label="Sidebar"
        >
          <div className={cn('flex h-14 shrink-0 items-center px-2', collapsed && 'justify-center px-0')}>
            <WorkspaceSwitcher collapsed={collapsed} />
          </div>

          <div className={cn('px-2 pb-1', collapsed && 'px-2')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => openCapture()}
                  disabled={!ws.canMutateTasks}
                  className={cn(
                    'quick-capture-primary h-9 w-full justify-start gap-2 px-2.5 text-[13px] shadow-[0_1px_2px_hsl(var(--foreground)/0.12)]',
                    collapsed && 'justify-center px-0',
                  )}
                  aria-label={!ws.canMutateTasks ? 'Quick capture unavailable in read-only mode' : 'Quick capture'}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>Quick capture</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Quick capture</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => commands.dispatch('open-command-palette')}
                  className={cn(
                    'mt-1.5 h-8 w-full justify-start gap-2 px-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/70',
                    collapsed && 'justify-center px-0',
                  )}
                  aria-label="Search and commands"
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && (
                    <>
                      <span>Search</span>
                      <Kbd className="ml-auto">⌘K</Kbd>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Search (⌘K)</TooltipContent>}
            </Tooltip>
          </div>

          <NavItems collapsed={collapsed} />

          <div className={cn('border-t border-sidebar-border p-2 space-y-1', collapsed && 'items-center flex flex-col')}>
            <FooterLink to={WORKSPACE_PATHS.plans} label="Plans" collapsed={collapsed} />
            <SupportButton collapsed={collapsed} onClick={() => setSupportOpen(true)} />
            {!collapsed ? (
              <>
                <div className="mt-2 rounded-lg border border-sidebar-border bg-card p-2 shadow-sm" data-sidebar-account-card>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(WORKSPACE_PATHS.settings)}
                    className="h-auto min-h-8 w-full min-w-0 justify-start gap-2.5 overflow-hidden p-0 text-left text-muted-foreground transition-opacity hover:bg-transparent hover:text-foreground hover:opacity-80"
                    aria-label="Account"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent" aria-hidden>
                      <CircleUserRound className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">{ws.state.userName}</span>
                      <span className="mt-1 block truncate text-xs font-normal leading-4 text-muted-foreground">
                        <span className="capitalize">{currentWorkspace?.role?.toLowerCase() ?? 'workspace'}</span>
                        <span aria-hidden> · </span>
                        {ws.mode.kind === 'server' ? 'Connected' : 'Local'}
                      </span>
                    </span>
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1" data-sidebar-utilities>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="https://github.com/kalelooz/planglade"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="PlanGlade on GitHub"
                        className="inline-flex h-8 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.96]"
                      >
                        <Github className="h-4 w-4" aria-hidden />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="right">GitHub</TooltipContent>
                  </Tooltip>
                  <AppearanceMenu triggerClassName="w-full" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={toggleCollapse} aria-label="Collapse sidebar" className="w-full text-muted-foreground hover:text-foreground">
                        <PanelLeftClose className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Collapse sidebar</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(WORKSPACE_PATHS.settings)}
                      className="h-8 w-8 flex-none justify-center px-0 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      aria-label="Account"
                    >
                      <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{ws.state.userName} · {ws.mode.kind === 'server' ? 'Connected workspace' : 'Local prototype'}</TooltipContent>
                </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href="https://github.com/kalelooz/planglade"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="PlanGlade on GitHub"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.96]"
                      >
                        <Github className="h-4 w-4" aria-hidden />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="right">GitHub</TooltipContent>
                  </Tooltip>
                  <AppearanceMenu />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={toggleCollapse} aria-label="Expand sidebar" className="text-muted-foreground hover:text-foreground">
                        <PanelLeftOpen className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Expand sidebar</TooltipContent>
                  </Tooltip>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center gap-2 px-3">
          <Sheet open={mobileNavOpen} onOpenChange={(open) => setMobileNav({ open, path: location.pathname })}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Open navigation" className="-ml-1.5 size-11 text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col" aria-label="Navigation">
              <SheetHeader className="h-14 flex-row items-center space-y-0 border-b border-border pl-2 pr-12">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <WorkspaceSwitcher mobile />
              </SheetHeader>
              <div className="flex flex-col flex-1 overflow-hidden">
                <NavItems onNavigate={() => setMobileNav({ open: false, path: location.pathname })} />
                <div className="flex items-center border-t border-border p-2">
                  <FooterLink
                    to={WORKSPACE_PATHS.plans}
                    label="Plans"
                    className="h-11 min-w-0 flex-1"
                    onNavigate={() => setMobileNav({ open: false, path: location.pathname })}
                  />
                  <SupportButton
                    className="h-11 min-w-0 flex-1"
                    onClick={() => {
                      setMobileNav({ open: false, path: location.pathname })
                      setSupportOpen(true)
                    }}
                  />
                  <a
                    href="https://github.com/kalelooz/planglade"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="PlanGlade on GitHub"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.96]"
                  >
                    <Github className="h-4 w-4" aria-hidden />
                  </a>
                  <AppearanceMenu triggerClassName="h-11 w-11" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button type="button" variant="ghost" onClick={() => navigate(WORKSPACE_PATHS.home)} className="h-11 min-w-0 justify-start gap-2 px-1">
            <span className="text-[14px] font-semibold truncate">{ws.state.workspaceName}</span>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => commands.dispatch('open-command-palette')}
              aria-label="Search"
              className="size-11 text-muted-foreground hover:text-foreground"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => openCapture()}
              disabled={!ws.canMutateTasks}
              aria-label={!ws.canMutateTasks ? 'Quick capture unavailable in read-only mode' : 'Quick capture'}
              className="quick-capture-primary size-11"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {ws.mode.kind === 'server' && (
          <div className="fixed right-[108px] top-1.5 z-50 md:right-3 md:top-2.5">
            <NotificationCenter
              workspaceId={ws.workspaceId}
              onOpenTask={(taskId) => commands.dispatch('open-task', { taskId })}
            />
          </div>
        )}

        {/* Main */}
        <div className={cn('min-h-dvh flex-1 min-w-0 flex flex-col', collapsed ? 'md:pl-[60px]' : 'md:pl-[228px]')}>
          <main id="main" className="flex-1 min-w-0 md:pt-0 pt-14 flex flex-col">
            <motion.div
              key={location.pathname}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.1, ease: 'easeOut' }}
              className="flex-1 flex flex-col min-h-0"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
      <SupportSheet open={supportOpen} onOpenChange={setSupportOpen} />
      <Toaster theme={ws.state.settings.theme} position="bottom-right" toastOptions={{ duration: 4000 }} />
    </>
  )
}
