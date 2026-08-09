import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import {
  Home, Inbox, CheckSquare, FolderOpen, StickyNote, CalendarDays, Waypoints, Settings,
  Plus, Moon, Sun, MonitorSmartphone, Clock,
} from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { useQuickCapture } from '@/components/QuickCapture'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { TASK_VIEW_CATALOG } from '@/lib/task-view-catalog'
import { useAppCommands } from '@/store/app-commands'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ws = useWorkspace()
  const { openCapture } = useQuickCapture()
  const { openTask } = useTaskDrawer()
  const commands = useAppCommands()
  const openerRef = useRef<HTMLElement | null>(null)

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => openerRef.current?.focus())
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === 'K' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setOpen((wasOpen) => {
          if (wasOpen) requestAnimationFrame(() => openerRef.current?.focus())
          return !wasOpen
        })
      }
    }
    const openHandler = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    document.addEventListener('keydown', down)
    const unsubscribe = commands.subscribe('open-command-palette', openHandler)
    return () => {
      document.removeEventListener('keydown', down)
      unsubscribe()
    }
  }, [commands])

  const go = (path: string) => {
    close(false)
    navigate(path)
  }

  const pages = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Inbox', path: '/inbox', icon: Inbox },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Projects', path: '/projects', icon: FolderOpen },
    { name: 'Notes', path: '/notes', icon: StickyNote },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
    { name: 'Connections', path: '/connections', icon: Waypoints },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const recents = useMemo(
    () =>
      ws.state.recents
        .map((r) => {
          if (r.type === 'task') {
            const t = ws.getTask(r.id)
            return t ? { kind: 'task' as const, id: r.id, label: t.title } : null
          }
          if (r.type === 'project') {
            const p = ws.getProject(r.id)
            return p ? { kind: 'project' as const, id: r.id, label: p.name } : null
          }
          const n = ws.getNote(r.id)
          return n ? { kind: 'note' as const, id: r.id, label: n.title } : null
        })
        .filter((r): r is { kind: 'task' | 'project' | 'note'; id: string; label: string } => !!r),
    [ws],
  )

  const theme = ws.state.settings.theme

  return (
    <CommandDialog open={open} onOpenChange={(next) => next ? setOpen(true) : close()} className="border-border/80 bg-popover">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>Nothing found. Try a different search.</CommandEmpty>
        <CommandGroup heading="Actions">
          {ws.canMutateTasks && <CommandItem onSelect={() => { close(false); openCapture() }}>
            <Plus className="mr-2 h-4 w-4" /> Capture to Inbox
          </CommandItem>}
          {ws.canMutateTasks && <CommandItem onSelect={() => { close(false); navigate('/tasks', { state: { newTask: true } }) }}>
            <CheckSquare className="mr-2 h-4 w-4" /> Create task
          </CommandItem>}
          {ws.canMutateNotes && <CommandItem onSelect={() => { close(false); navigate('/notes', { state: { newNote: true } }) }}>
            <StickyNote className="mr-2 h-4 w-4" /> Create note
          </CommandItem>}
          <CommandItem onSelect={() => { ws.updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }); close(false) }}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </CommandItem>
          {theme !== 'system' && (
            <CommandItem onSelect={() => { ws.updateSettings({ theme: 'system' }); close(false) }}>
              <MonitorSmartphone className="mr-2 h-4 w-4" /> Use system appearance
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem key={p.path} onSelect={() => go(p.path)}>
              <p.icon className="mr-2 h-4 w-4" /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Task views">
          {TASK_VIEW_CATALOG.map((item) => {
            const Icon = item.icon
            return <CommandItem key={item.view} onSelect={() => go(`/tasks${item.view === 'list' ? '' : `?view=${item.view}`}`)}>
              <Icon className="mr-2 h-4 w-4" /> Open {item.label} view
            </CommandItem>
          })}
        </CommandGroup>
        {recents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent">
              {recents.map((r) => (
                <CommandItem
                  key={`${r.kind}-${r.id}`}
                  onSelect={() => {
                    close(false)
                    if (r.kind === 'task') openTask(r.id)
                    else if (r.kind === 'project') navigate(`/projects/${r.id}`)
                    else navigate(`/notes?note=${r.id}`)
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" /> {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Tasks">
          {ws.tasks.filter((t) => t.status !== 'done' && !t.parentId).slice(0, 30).map((t) => (
            <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => { close(false); openTask(t.id) }}>
              <CheckSquare className="mr-2 h-4 w-4 opacity-60" /> {t.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Projects">
          {ws.projects.map((p) => (
            <CommandItem key={p.id} value={`project ${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
              <FolderOpen className="mr-2 h-4 w-4 opacity-60" /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Notes">
          {ws.notes.map((n) => (
            <CommandItem key={n.id} value={`note ${n.title}`} onSelect={() => go(`/notes?note=${n.id}`)}>
              <StickyNote className="mr-2 h-4 w-4 opacity-60" /> {n.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
