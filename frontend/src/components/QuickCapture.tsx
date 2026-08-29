import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CalendarDays, Flag, FolderOpen, Inbox as InboxIcon, WandSparkles } from 'lucide-react'
import { useWorkspaceActions, useWorkspaceCapabilities, useWorkspaceData } from '@/store/workspace'
import { parseCaptureInput, relativeLabel } from '@/lib/dates'
import { useSubmissionLifecycle } from '@/lib/use-submission-lifecycle'

interface QuickCaptureCtx {
  openCapture: (seed?: string) => void
}

const Ctx = createContext<QuickCaptureCtx>({ openCapture: () => {} })
// eslint-disable-next-line react-refresh/only-export-components
export const useQuickCapture = () => useContext(Ctx)

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const { invalidate, pending: saving, submit } = useSubmissionLifecycle()
  const { canMutateTasks } = useWorkspaceCapabilities()
  const { projects } = useWorkspaceData()
  const { capture } = useWorkspaceActions()

  const openCapture = useCallback((s?: string) => {
    if (!canMutateTasks) return
    invalidate()
    setValue(s ?? '')
    setOpen(true)
  }, [canMutateTasks, invalidate])

  const projectNames = useMemo(() => projects.map((p) => p.name), [projects])
  const parsed = useMemo(() => parseCaptureInput(value, projectNames), [value, projectNames])
  const parsedProject = parsed.projectName ? projects.find((p) => p.name === parsed.projectName) : null
  const projectExample = projects[0]?.name.split(/\s+/)[0] ?? 'project'
  const examples = [
    'Send homepage draft tomorrow',
    'Review launch copy next Friday p1',
    `Prepare workshop #${projectExample} next week medium priority`,
  ]

  const save = async () => {
    const text = parsed.text.trim()
    if (!text) return
    const input = {
      text,
      meta: {
        projectId: parsedProject?.id ?? null,
        dueDate: parsed.dueDate,
        priority: parsed.priority,
      },
    }
    await submit(
      input,
      (submission) => capture(submission.text, submission.meta),
      Boolean,
      () => {
        setOpen(false)
        setValue('')
      },
    )
  }

  return (
    <Ctx.Provider value={{ openCapture }}>
      {children}
      <Dialog open={open} onOpenChange={(nextOpen) => {
        if (nextOpen !== open) invalidate()
        setOpen(nextOpen)
      }}>
        <DialogContent className="top-[16%] translate-y-0 sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base">Capture something</DialogTitle>
            <DialogDescription className="max-w-[46ch] text-pretty">
              Write naturally. PlanGlade can pull out a date, priority, and project before saving it to Inbox.
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
              onChange={(e) => {
                invalidate()
                setValue(e.target.value)
              }}
              placeholder="e.g. Send homepage draft tomorrow #Client high priority"
              aria-label="Capture text"
              className="h-11 w-full bg-background px-3 text-[15px] placeholder:text-muted-foreground/75"
            />
            {!value.trim() && (
              <div className="mt-3 rounded-lg border border-border/70 bg-muted/35 p-2.5">
                <p className="flex items-center gap-1.5 px-1 text-[12.5px] font-medium text-foreground">
                  <WandSparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  Try an example
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        invalidate()
                        setValue(example)
                      }}
                      className="min-h-11 w-full rounded-md px-2 py-1.5 text-left text-[13px] leading-5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {parsed.inferred && value.trim() && (
              <div className="mt-3 rounded-lg border border-border/70 bg-muted/35 p-2.5" aria-live="polite">
                <p className="text-[12.5px] font-medium text-foreground">Ready for Inbox</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex max-w-[260px] items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12.5px] text-secondary-foreground">
                  <InboxIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{parsed.text}</span>
                </span>
                {parsed.dueDate && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12.5px] text-secondary-foreground">
                    <CalendarDays className="h-3 w-3" /> {relativeLabel(parsed.dueDate)}
                  </span>
                )}
                {parsed.priority !== 'none' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12.5px] text-secondary-foreground capitalize">
                    <Flag className="h-3 w-3" /> {parsed.priority}
                  </span>
                )}
                {parsedProject && (
                  <span className="inline-flex max-w-[180px] items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12.5px] text-secondary-foreground">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    <span className="truncate">{parsedProject.name}</span>
                  </span>
                )}
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <p className="hidden max-w-[28ch] text-[12.5px] leading-4 text-muted-foreground sm:block">
                Try “tomorrow”, “next Friday”, “p1”, or “#project”.
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
