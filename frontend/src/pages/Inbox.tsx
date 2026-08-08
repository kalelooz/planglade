import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Inbox as InboxIcon, ArrowRight, X, CalendarDays, CheckSquare, Flag, FolderOpen } from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { EmptyState, PageContainer, priorityStyles } from '@/components/bits'
import { timeAgo, relativeLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { InboxItem, Priority } from '@/types'

function InboxRow({
  item,
  selected,
  selectable,
  onSelect,
}: {
  item: InboxItem
  selected: boolean
  selectable: boolean
  onSelect: (v: boolean) => void
}) {
  const ws = useWorkspace()
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const projectSelect = (
    <Select
      value={item.projectId ?? 'none'}
      onValueChange={(v) => ws.updateInboxItem(item.id, { projectId: v === 'none' ? null : v })}
    >
      <SelectTrigger
        aria-label="Assign project"
        className="h-8 min-w-0 max-w-[128px] data-[size=default]:h-8 overflow-hidden rounded-md border-0 bg-transparent px-1.5 text-[11.5px] shadow-none hover:bg-accent focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_1px_hsl(var(--ring))] [&>svg:last-child]:hidden"
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate"><SelectValue placeholder="Project" /></span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No project</SelectItem>
        {ws.projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const dateButton = (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              aria-label="Set due date"
              className={cn(
                'inline-flex h-8 max-w-[112px] items-center gap-1 rounded-md px-1.5 text-[11.5px] transition-colors hover:bg-accent',
                item.dueDate ? 'text-foreground' : 'text-muted-foreground/70',
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.dueDate ? relativeLabel(item.dueDate) : 'No date'}</span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{item.dueDate ? `Due ${relativeLabel(item.dueDate)}` : 'Set due date'}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start" sideOffset={6}>
        <Calendar
          mode="single"
          selected={item.dueDate ? parseISO(item.dueDate) : undefined}
          onSelect={(d) => ws.updateInboxItem(item.id, { dueDate: d ? format(d, 'yyyy-MM-dd') : null })}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )

  const prioritySelect = (
    <Select value={item.priority} onValueChange={(v) => ws.updateInboxItem(item.id, { priority: v as Priority })}>
      <SelectTrigger
        aria-label="Set priority"
        className={cn('h-8 max-w-[90px] data-[size=default]:h-8 overflow-hidden rounded-md border-0 bg-transparent px-1.5 text-[11.5px] shadow-none hover:bg-accent focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_1px_hsl(var(--ring))] [&>svg:last-child]:hidden', priorityStyles[item.priority])}
      >
        <Flag className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden truncate sm:inline"><SelectValue /></span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No priority</SelectItem>
        <SelectItem value="low">Low</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="high">High</SelectItem>
      </SelectContent>
    </Select>
  )

  const convertButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            void ws.convertInboxItem(item.id).then((t) => {
            if (t) {
              // allow opening the new task from the toast is handled in store; offer direct open on double action
            }
            })
          }}
          aria-label={`Convert "${item.text}" to task`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] sm:w-auto sm:px-2.5 sm:gap-1.5 sm:text-[12px] sm:font-medium"
        >
          <CheckSquare className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline truncate">Convert</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Convert to task</TooltipContent>
    </Tooltip>
  )

  const dismissButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setConfirmDismiss(true)}
          aria-label={`Dismiss "${item.text}"`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Dismiss</TooltipContent>
    </Tooltip>
  )

  const controls = (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {projectSelect}
      {dateButton}
      {prioritySelect}
    </div>
  )

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      {convertButton}
      {ws.canMutateTasks && dismissButton}
    </div>
  )

  return (<>
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      transition={{ duration: 0.16 }}
      className={cn(
        'group grid items-start gap-x-2.5 px-3 py-3 transition-colors sm:gap-x-3',
        selectable
          ? 'grid-cols-[28px_minmax(0,1fr)_auto] sm:grid-cols-[24px_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto]',
        selected ? 'bg-accent/70' : 'hover:bg-accent/40',
      )}
    >
      {selectable && <label className="inline-flex h-8 items-center justify-center pt-0.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          disabled={!ws.canMutateTasks}
          aria-label={`Select "${item.text}"`}
          className="h-4 w-4 shrink-0 rounded border-input accent-zinc-700 dark:accent-zinc-300 cursor-pointer disabled:cursor-default disabled:opacity-40"
        />
      </label>}
      <div className="min-w-0">
        <p className="pg-item-title truncate">{item.text}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="pg-meta shrink-0">{timeAgo(item.createdAt)}</span>
          {controls}
        </div>
      </div>
      {actions}
    </motion.div>
    <AlertDialog open={confirmDismiss} onOpenChange={setConfirmDismiss}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dismiss this inbox item?</AlertDialogTitle>
          <AlertDialogDescription>“{item.text}” will be permanently deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep item</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => ws.dismissInboxItem(item.id)}>
            Dismiss item
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}

export default function Inbox() {
  const ws = useWorkspace()
  const canBulkEdit = ws.canMutateTasks
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [confirmBulkDismiss, setConfirmBulkDismiss] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = ws.inbox
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  const toggle = (id: string, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      if (v) n.add(id)
      else n.delete(id)
      return n
    })

  const clearSelection = () => setSelected(new Set())

  const capture = () => {
    const v = text.trim()
    if (!v) return
    setSaving(true)
    void ws.capture(v).then((task) => {
      setSaving(false)
      if (task) {
        setText('')
        inputRef.current?.focus()
      }
    })
  }

  const selectedIds = useMemo(() => Array.from(selected).filter((id) => items.some((i) => i.id === id)), [selected, items])

  return (
    <PageContainer width="reading" className="py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="pg-page-title">Inbox</h1>
        <p className="pg-page-kicker">
          Capture first. Organize when you're ready.
        </p>
      </header>

      {/* Capture */}
      <div className="rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(240_8%_10%/0.04)] mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            capture()
          }}
          className="flex items-center gap-2.5 px-3.5"
        >
          <InboxIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            aria-label="Capture to inbox"
            className="flex-1 h-11 border-0 bg-transparent px-0 text-[14px] shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          {text.trim() && (
            <Button type="submit" size="sm" variant="ghost" disabled={saving} aria-busy={saving} className="h-11 lg:h-8 px-2 text-[13px] font-medium text-foreground disabled:opacity-50">
              {saving ? 'Saving…' : 'Capture'}
            </Button>
          )}
        </form>
      </div>

      {/* Bulk bar */}
      {canBulkEdit && <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2 mb-3">
              <span className="pg-section-title">{selectedIds.length} selected</span>
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <Select onValueChange={(v) => { ws.bulkAssignProject(selectedIds, v === 'none' ? null : v); }}>
                  <SelectTrigger className="h-11 data-[size=default]:h-11 lg:h-7 lg:data-[size=default]:h-7 text-[12px] w-[130px] bg-card">
                    <SelectValue placeholder="Move to project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {ws.projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => { ws.bulkConvert(selectedIds); clearSelection() }}
                  className="h-11 lg:h-7 px-2.5 rounded-md text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> Convert all
                </button>
                <button
                  onClick={() => setConfirmBulkDismiss(true)}
                  className="h-11 lg:h-7 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Dismiss
                </button>
                <button onClick={clearSelection} className="h-11 lg:h-7 px-2 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>}

      {/* List */}
      {items.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="h-7 w-7" />}
          title="Inbox zero"
          hint="Nothing waiting to be organized. Capture something above the next time a thought flies by."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(240_8%_10%/0.04)]">
          <div className="flex min-h-10 items-center gap-3 border-b border-border bg-muted/30 px-3 py-2">
            {canBulkEdit && <label className="inline-flex h-6 items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(items.map((i) => i.id)))
                  else clearSelection()
                }}
                aria-label="Select all inbox items"
                className="h-4 w-4 rounded border-input accent-zinc-700 dark:accent-zinc-300 cursor-pointer"
              />
            </label>}
            <span className="pg-meta font-medium">
              {items.length} {items.length === 1 ? 'item' : 'items'} to organize
            </span>
          </div>
          <div className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <InboxRow key={item.id} item={item} selected={selected.has(item.id)} selectable={canBulkEdit} onSelect={(v) => toggle(item.id, v)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <AlertDialog open={confirmBulkDismiss} onOpenChange={setConfirmBulkDismiss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss {selectedIds.length} inbox {selectedIds.length === 1 ? 'item' : 'items'}?</AlertDialogTitle>
            <AlertDialogDescription>The selected items will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep items</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { ws.bulkDismiss(selectedIds); clearSelection() }}
            >
              Dismiss selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
