import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  Home, Inbox, CheckSquare, FolderOpen, StickyNote, CalendarDays, Waypoints, Settings as SettingsIcon,
  Search, Plus, PanelLeftClose, PanelLeftOpen, Menu, Moon, Sun, MonitorSmartphone, Sprout, CircleUserRound,
  Check, ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import { useQuickCapture } from '@/components/QuickCapture'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { CountBadge } from '@/components/bits'

const NAV = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Inbox', path: '/inbox', icon: Inbox },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Projects', path: '/projects', icon: FolderOpen },
  { name: 'Notes', path: '/notes', icon: StickyNote },
  { name: 'Calendar', path: '/calendar', icon: CalendarDays },
  { name: 'Connections', path: '/connections', icon: Waypoints },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
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
            <button aria-label="Change appearance" className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors', triggerClassName)}>
              <Icon className="h-4 w-4" />
            </button>
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
              <button
                aria-label={`Switch workspace. Current workspace: ${current?.name ?? ws.state.workspaceName}`}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-md text-left transition-[background-color,color,transform] hover:bg-sidebar-accent active:scale-[0.96]',
                  mobile ? 'h-11 flex-1 px-2' : 'h-11 w-full px-2',
                  collapsed && 'w-10 justify-center px-0',
                )}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-hidden>
                  <Sprout className="h-4 w-4" />
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-semibold">{current?.name ?? ws.state.workspaceName}</span>
                      <span className="block truncate text-[10.5px] capitalize text-muted-foreground">{current?.role?.toLowerCase() ?? 'workspace'}</span>
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Switch workspace</TooltipContent>}
        </Tooltip>
        <DropdownMenuContent align="start" side={mobile ? 'bottom' : 'right'} sideOffset={6} className="w-[min(17rem,calc(100vw-1rem))] p-1.5">
          <DropdownMenuLabel className="px-2.5 py-2 text-[11px] font-medium text-muted-foreground">Workspaces</DropdownMenuLabel>
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
                  'grid size-7 shrink-0 place-items-center rounded-md text-[11px] font-semibold uppercase',
                  selected ? 'bg-background text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]' : 'bg-accent text-foreground',
                )} aria-hidden>{workspace.name.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{workspace.name}</span>
                  <span className="block text-[10.5px] capitalize text-muted-foreground">{workspace.role.toLowerCase()}</span>
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
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Workspace name"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/50"
              placeholder="Workspace name"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={!validName || pending} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40">
                {pending ? 'Creating...' : 'Create'}
              </button>
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
          end={item.path === '/'}
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
  const { openCapture } = useQuickCapture()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('planglade-sidebar') === 'collapsed')
  const [mobileNav, setMobileNav] = useState({ open: false, path: location.pathname })
  const reducedMotion = usePrefersReducedMotion()
  const mobileNavOpen = mobileNav.open && mobileNav.path === location.pathname

  useEffect(() => {
    localStorage.setItem('planglade-sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    const inboxGoto = () => navigate('/inbox')
    window.addEventListener('planglade:goto-inbox', inboxGoto)
    return () => window.removeEventListener('planglade:goto-inbox', inboxGoto)
  }, [navigate])

  const toggleCollapse = () => setCollapsed((c) => !c)

  return (
    <TooltipProvider delayDuration={350}>
      <div className="min-h-dvh bg-background flex">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar-background transition-[width] duration-200 ease-out md:flex',
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
                <button
                  onClick={() => openCapture()}
                  disabled={!ws.canMutateTasks}
                  className={cn(
                    'quick-capture-primary w-full inline-flex items-center gap-2 rounded-md bg-primary px-2.5 h-9 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.96] transition-[background-color,transform] shadow-[0_1px_2px_hsl(var(--foreground)/0.12)]',
                    collapsed && 'justify-center px-0',
                  )}
                  aria-label={!ws.canMutateTasks ? 'Quick capture unavailable in read-only mode' : 'Quick capture'}
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>Quick capture</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Quick capture</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('planglade:command-palette'))}
                  className={cn(
                    'mt-1.5 w-full inline-flex items-center gap-2 rounded-md px-2.5 h-8 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors',
                    collapsed && 'justify-center px-0',
                  )}
                  aria-label="Search and commands"
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && (
                    <>
                      <span>Search</span>
                      <kbd className="ml-auto text-[10px] text-muted-foreground/80 border border-border rounded px-1 py-px bg-background">⌘K</kbd>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Search (⌘K)</TooltipContent>}
            </Tooltip>
          </div>

          <NavItems collapsed={collapsed} />

          <div className={cn('border-t border-sidebar-border p-2 space-y-1', collapsed && 'items-center flex flex-col')}>
            <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'justify-between')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate('/settings')}
                    className={cn('inline-flex items-center gap-2 rounded-md px-2 h-8 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors min-w-0', collapsed && 'justify-center px-0 w-8')}
                    aria-label="Account"
                  >
                    <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{ws.state.userName} · {ws.readOnly ? 'Connected' : 'Local'}</span>}
                  </button>
                </TooltipTrigger>
                {collapsed && <TooltipContent side="right">{ws.state.userName} · {ws.readOnly ? 'Connected workspace' : 'Local prototype'}</TooltipContent>}
              </Tooltip>
              {!collapsed && (
                <div className="flex items-center">
                  <AppearanceMenu />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={toggleCollapse} aria-label="Collapse sidebar" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        <PanelLeftClose className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Collapse sidebar</TooltipContent>
                  </Tooltip>
                </div>
              )}
              {collapsed && (
                <>
                  <AppearanceMenu />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={toggleCollapse} aria-label="Expand sidebar" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        <PanelLeftOpen className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Expand sidebar</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center gap-2 px-3">
          <Sheet open={mobileNavOpen} onOpenChange={(open) => setMobileNav({ open, path: location.pathname })}>
            <SheetTrigger asChild>
              <button aria-label="Open navigation" className="inline-flex h-11 w-11 -ml-1.5 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col" aria-label="Navigation">
              <SheetHeader className="h-14 flex-row items-center space-y-0 border-b border-border pl-2 pr-12">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <WorkspaceSwitcher mobile />
              </SheetHeader>
              <div className="flex flex-col flex-1 overflow-hidden">
                <NavItems onNavigate={() => setMobileNav({ open: false, path: location.pathname })} />
                <div className="border-t border-border p-2">
                  <AppearanceMenu triggerClassName="h-11 w-11" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <button onClick={() => navigate('/')} className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-semibold truncate">{ws.state.workspaceName}</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('planglade:command-palette'))}
              aria-label="Search"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => openCapture()}
              disabled={!ws.canMutateTasks}
              aria-label={!ws.canMutateTasks ? 'Quick capture unavailable in read-only mode' : 'Quick capture'}
              className="quick-capture-primary inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.96] transition-[background-color,transform]"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

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
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
    </TooltipProvider>
  )
}
