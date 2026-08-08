import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CalendarDays, CircleHelp, Flag, FolderOpen, Inbox as InboxIcon } from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { parseCaptureInput, relativeLabel } from '@/lib/dates'

interface QuickCaptureCtx {
  openCapture: (seed?: string) => void
}

const Ctx = createContext<QuickCaptureCtx>({ openCapture: () => {} })
// eslint-disable-next-line react-refresh/only-export-components
export const useQuickCapture = () => useContext(Ctx)

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const ws = useWorkspace()

  const openCapture = useCallback((s?: string) => {
    if (!ws.canMutateTasks) {
      return
    }
    setValue(s ?? '')
    setOpen(true)
  }, [ws.canMutateTasks])

  useEffect(() => {
    const handler = () => openCapture()
    window.addEventListener('planglade:quick-capture', handler)
    return () => window.removeEventListener('planglade:quick-capture', handler)
  }, [openCapture])

  const projectNames = useMemo(() => ws.projects.map((p) => p.name), [ws.projects])
  const parsed = useMemo(() => parseCaptureInput(value, projectNames), [value, projectNames])
  const parsedProject = parsed.projectName ? ws.projects.find((p) => p.name === parsed.projectName) : null
  const projectExample = ws.projects[0]?.name.split(/\s+/)[0] ?? 'project'
  const examples = [
    'Send homepage draft tomorrow',
    'Review launch copy next Friday p1',
    `Prepare workshop #${projectExample} next week medium priority`,
  ]

  const save = async () => {
    if (!parsed.text.trim()) return
    setSaving(true)
    const saved = await ws.capture(parsed.text.trim(), {
      projectId: parsedProject?.id ?? null,
      dueDate: parsed.dueDate,
      priority: parsed.priority,
    })
    setSaving(false)
    if (saved) {
      setOpen(false)
      setValue('')
    }
  }

  return (
    <Ctx.Provider value={{ openCapture }}>
      {children}
      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setHelpOpen(false) }}>
        <DialogContent className="sm:max-w-[480px] top-[20%] translate-y-0">
          <DialogHeader>
            <div className="flex items-center gap-1.5 pr-8">
              <DialogTitle className="text-base">Capture something</DialogTitle>
              <Popover open={helpOpen} onOpenChange={setHelpOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Show capture examples"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="w-[min(20rem,calc(100vw-2rem))] p-3">
                  <div className="mb-2">
                    <p className="text-[12px] font-semibold text-foreground">Capture examples</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Click one to try it. Dates, priorities, and project tags are organized automatically.</p>
                  </div>
                  <div className="space-y-1">
                    {examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => { setValue(example); setHelpOpen(false) }}
                        className="min-h-11 w-full rounded-md px-2 py-1.5 text-left text-[12px] leading-4 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 border-t border-border pt-2 text-[10.5px] leading-4 text-muted-foreground">Try dates like “today,” “in 3 days,” or “next Monday.” Priorities also accept p1, p2, and p3.</p>
                </PopoverContent>
              </Popover>
            </div>
            <DialogDescription className="sr-only">
              Quickly save a task. You can organize it later.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Send homepage draft tomorrow #Client high priority"
              aria-label="Capture text"
              className="h-auto w-full border-0 bg-transparent px-0 py-1 text-[15px] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
            />
            {parsed.inferred && value.trim() && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
                <span className="text-[11px] text-muted-foreground mr-1">Will save:</span>
                <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground max-w-[220px]">
                  <InboxIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{parsed.text}</span>
                </span>
                {parsed.dueDate && (
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                    <CalendarDays className="h-3 w-3" /> {relativeLabel(parsed.dueDate)}
                  </span>
                )}
                {parsed.priority !== 'none' && (
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground capitalize">
                    <Flag className="h-3 w-3" /> {parsed.priority}
                  </span>
                )}
                {parsedProject && (
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground max-w-[160px]">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    <span className="truncate">{parsedProject.name}</span>
                  </span>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Try “tomorrow”, “next Friday”, “p1”, or “#project”
              </p>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="h-8 px-3 text-sm text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={!value.trim() || saving}
                  aria-busy={saving}
                  className="h-8 px-3 text-sm disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save to Inbox'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}
