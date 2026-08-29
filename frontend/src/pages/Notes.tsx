import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  Search, Plus, StickyNote, ArrowLeft, Eye, Pencil, Trash2, CheckSquare,
  Bold, Italic, Underline, List, ListOrdered, ListChecks, Link as LinkIcon, Quote, Table, Heading1, Heading2, Undo2, Redo2, X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store/workspace'
import { useAppCommands } from '@/store/app-commands'
import { Markdown } from '@/components/Markdown'
import { EmptyState, ProjectChip } from '@/components/bits'
import { timeAgo, relativeLabel } from '@/lib/dates'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group'
import type { Note, Priority } from '@/types'

interface ConvertState {
  open: boolean
  text: string
}

type FormattingTool = {
  icon: React.ElementType
  id: 'h1' | 'h2' | 'bold' | 'italic' | 'underline' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'link' | 'table'
  label: string
}

const formattingTools: FormattingTool[] = [
  { icon: Heading1, id: 'h1', label: 'Heading 1' },
  { icon: Heading2, id: 'h2', label: 'Heading 2' },
  { icon: Bold, id: 'bold', label: 'Bold' },
  { icon: Italic, id: 'italic', label: 'Italic' },
  { icon: Underline, id: 'underline', label: 'Underline' },
  { icon: List, id: 'bullet', label: 'Bullet list' },
  { icon: ListOrdered, id: 'numbered', label: 'Numbered list' },
  { icon: ListChecks, id: 'checklist', label: 'Checklist' },
  { icon: Quote, id: 'quote', label: 'Quote' },
  { icon: LinkIcon, id: 'link', label: 'Link' },
  { icon: Table, id: 'table', label: 'Table' },
]

function NoteEditor({ note, onBack }: { note: Note; onBack?: () => void }) {
  const ws = useWorkspace()
  const commands = useAppCommands()
  const canEdit = ws.canMutateNotes
  const [mode, setMode] = useState<'edit' | 'read'>('edit')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [convert, setConvert] = useState<ConvertState>({ open: false, text: '' })
  const [convProject, setConvProject] = useState<string>(note.projectId ?? 'none')
  const [convDate, setConvDate] = useState<string | null>(null)
  const [convPriority, setConvPriority] = useState<Priority>('none')
  const [title, setTitle] = useState(note.title)
  const [content, setContentDraft] = useState(note.content)
  const [historyState, setHistoryState] = useState({ noteId: note.id, canUndo: false, canRedo: false })
  const taRef = useRef<HTMLTextAreaElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const lastSaved = useRef({ title: note.title, content: note.content })
  const latestDraft = useRef({ title: note.title, content: note.content })

  useEffect(() => {
    latestDraft.current = { title, content }
  }, [content, title])

  const saveDraft = useCallback(async () => {
    const draft = latestDraft.current
    if (!canEdit || (draft.title === lastSaved.current.title && draft.content === lastSaved.current.content)) return null
    if (!draft.title.trim()) {
      setSaveState('error')
      return null
    }
    setSaveState('saving')
    const saved = await ws.updateNote(note.id, { title: draft.title, content: draft.content }, { silent: true })
    if (!saved) {
      setSaveState('error')
      return null
    }
    lastSaved.current = { title: saved.title, content: saved.content }
    if (latestDraft.current.title === draft.title) setTitle(saved.title)
    if (latestDraft.current.content === draft.content) setContentDraft(saved.content)
    setSaveState('idle')
    return saved
  }, [canEdit, note.id, ws])

  useEffect(() => {
    if (!canEdit || (title === lastSaved.current.title && content === lastSaved.current.content)) return
    const timer = window.setTimeout(() => { void saveDraft() }, 600)
    return () => window.clearTimeout(timer)
  }, [canEdit, content, saveDraft, title])

  const setContent = useCallback(
    (v: string, recordHistory = true) => {
      if (recordHistory) {
        undoStack.current.push(content)
        if (undoStack.current.length > 100) undoStack.current.shift()
        redoStack.current = []
        setHistoryState({ noteId: note.id, canUndo: undoStack.current.length > 0, canRedo: false })
      }
      setContentDraft(v)
    },
    [content, note.id],
  )

  const undo = () => {
    const prev = undoStack.current.pop()
    if (prev === undefined) return
    redoStack.current.push(content)
    setContent(prev, false)
    setHistoryState({ noteId: note.id, canUndo: undoStack.current.length > 0, canRedo: true })
  }
  const redo = () => {
    const next = redoStack.current.pop()
    if (next === undefined) return
    undoStack.current.push(content)
    setContent(next, false)
    setHistoryState({ noteId: note.id, canUndo: true, canRedo: redoStack.current.length > 0 })
  }

  const wrapSelection = (before: string, after = before, placeholder = '') => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const sel = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }

  const linePrefix = (prefix: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const block = value.slice(lineStart, e)
    const next = value.slice(0, lineStart) + block.split('\n').map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join('\n') + value.slice(e)
    setContent(next)
    requestAnimationFrame(() => ta.focus())
  }

  const insertAtCursor = (snippet: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, value } = ta
    const next = value.slice(0, s) + snippet + value.slice(s)
    setContent(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + snippet.length, s + snippet.length)
    })
  }

  const runFormattingTool = (tool: FormattingTool['id']) => {
    if (tool === 'h1') return linePrefix('# ')
    if (tool === 'h2') return linePrefix('## ')
    if (tool === 'bold') return wrapSelection('**')
    if (tool === 'italic') return wrapSelection('*')
    if (tool === 'underline') return wrapSelection('<u>', '</u>')
    if (tool === 'bullet') return linePrefix('- ')
    if (tool === 'numbered') return linePrefix('1. ')
    if (tool === 'checklist') return linePrefix('- [ ] ')
    if (tool === 'quote') return linePrefix('> ')
    if (tool === 'link') return wrapSelection('[', '](https://)', 'link text')
    insertAtCursor('\n| Column | Column |\n| --- | --- |\n|  |  |\n')
  }

  const selectionToTask = () => {
    const ta = taRef.current
    let text = ''
    if (ta && mode === 'edit') {
      text = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim()
    }
    if (!text) text = title
    setConvProject(note.projectId ?? 'none')
    setConvDate(null)
    setConvPriority('none')
    setConvert({ open: true, text: text.replace(/^[-*>\s#[\]]+/, '').slice(0, 120) })
  }

  const doConvert = async () => {
    const t = await ws.addTask({
      title: convert.text || title,
      projectId: convProject === 'none' ? null : convProject,
      dueDate: convDate,
      priority: convPriority,
      status: 'planned',
      description: `From note: ${title}`,
    })
    if (!t) return
    setConvert({ open: false, text: '' })
    toast.success('Task created from note', {
      action: { label: 'Open task', onClick: () => commands.dispatch('open-task', { taskId: t.id }) },
    })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      wrapSelection('**')
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault()
      wrapSelection('*')
    }
  }

  const editorMode = canEdit ? mode : 'read'
  const saveProject = async (value: string) => {
    setProjectSaving(true)
    await ws.updateNote(note.id, { projectId: value === 'none' ? null : value })
    setProjectSaving(false)
  }
  const removeNote = async () => {
    if (deleting) return
    setDeleting(true)
    const deleted = await ws.deleteNote(note.id)
    setDeleting(false)
    if (deleted) {
      setConfirmDelete(false)
      onBack?.()
    }
  }

  return (
    <Tabs value={editorMode} onValueChange={(value) => canEdit && setMode(value as 'edit' | 'read')} className="flex h-full min-h-0 flex-col gap-0">
      {/* header */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border flex-wrap">
        {onBack && (
          <button onClick={onBack} aria-label="Back to notes" className="h-11 w-11 -ml-1 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <input
          value={title}
          readOnly={!canEdit}
          onChange={(e) => canEdit && setTitle(e.target.value)}
          onBlur={() => { void saveDraft() }}
          aria-label="Note title"
          aria-invalid={canEdit && !title.trim()}
          className="flex-1 min-w-[140px] bg-transparent text-[15px] font-semibold outline-none rounded px-1 -ml-1 focus:bg-accent/40"
        />
        <div className="flex items-center gap-1">
          {canEdit && <TabsList aria-label="Editor mode" className="h-auto rounded-md border border-border bg-card p-0.5">
            {([['edit', Pencil, 'Edit'], ['read', Eye, 'Read']] as const).map(([m, Icon, label]) => (
              <TabsTrigger
                key={m}
                value={m}
                aria-label={label}
                className="h-11 flex-none gap-1 rounded border-0 bg-transparent px-2 text-[12px] font-normal shadow-none text-muted-foreground hover:text-foreground data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none lg:h-7 dark:data-[state=active]:bg-accent"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>}
          {canEdit && <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={selectionToTask} aria-label="Convert selection to task" className="h-11 w-11 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <CheckSquare className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Convert selection to task</TooltipContent>
          </Tooltip>}
          {canEdit && <Tooltip>
            <TooltipTrigger asChild>
              <button ref={deleteButtonRef} onClick={() => setConfirmDelete(true)} aria-label="Delete note" className="h-11 w-11 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete note</TooltipContent>
          </Tooltip>}
        </div>
      </div>

      {/* meta row */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border text-[12.5px] text-muted-foreground flex-wrap">
        <Select disabled={!canEdit || projectSaving} value={note.projectId ?? 'none'} onValueChange={(v) => { void saveProject(v) }}>
          <SelectTrigger className="!h-11 text-[12.5px] border-0 bg-transparent hover:bg-accent px-1.5 -ml-1.5 w-auto shadow-none focus:ring-1 gap-1" aria-label="Linked project">
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {ws.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span aria-hidden>·</span>
        <span>Edited {timeAgo(note.updatedAt)}</span>
        {canEdit && <span aria-live="polite">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? (!title.trim() ? 'A note needs a title before it can be saved.' : 'Could not save. Your edits are still here.') : ''}</span>}
      </div>

      <TabsContent value="edit" className="m-0 flex min-h-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-1.5" role="toolbar" aria-label="Formatting">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={undo} disabled={historyState.noteId !== note.id || !historyState.canUndo} aria-label="Undo" className="inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 lg:h-7 lg:w-7">
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Undo (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={redo} disabled={historyState.noteId !== note.id || !historyState.canRedo} aria-label="Redo" className="inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 lg:h-7 lg:w-7">
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-4 mx-1.5" />
          {formattingTools.map((t) => (
            <Tooltip key={t.label}>
              <TooltipTrigger asChild>
                <button onClick={() => runFormattingTool(t.id)} aria-label={t.label} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:h-7 lg:w-7">
                  <t.icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => { void saveDraft() }}
          onKeyDown={onKeyDown}
          aria-label="Note content (Markdown)"
          placeholder="Start writing. Markdown works here."
          className="flex-1 w-full max-w-[960px] mx-auto resize-none bg-transparent px-4 sm:px-5 py-4 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground font-mono min-h-[300px]"
        />
      </TabsContent>
      {canEdit ? (
        <TabsContent value="read" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-5">
          <div className="mx-auto w-full max-w-[960px]">
            <Markdown content={content} />
          </div>
        </TabsContent>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-5">
          <div className="mx-auto w-full max-w-[960px]">
            <Markdown content={content} />
          </div>
        </div>
      )}

      {/* convert dialog */}
      <Dialog open={convert.open} onOpenChange={(v) => setConvert((c) => ({ ...c, open: v }))}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base">Convert to task</DialogTitle>
            <DialogDescription className="sr-only">Create a task from this text.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="ct-title" className="text-[12px] text-muted-foreground">Task</label>
              <input
                id="ct-title"
                value={convert.text}
                onChange={(e) => setConvert((c) => ({ ...c, text: e.target.value }))}
                className="mt-1 h-11 w-full rounded-md border border-input bg-transparent px-3 lg:h-9 text-[14px] outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={convProject} onValueChange={setConvProject}>
                <SelectTrigger className="h-11 w-auto text-[13px] data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8 min-w-[130px]" aria-label="Project">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {ws.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-11 rounded-md border px-2.5 lg:h-8 border-input text-[13px] hover:bg-accent transition-colors">
                    {convDate ? relativeLabel(convDate) : 'No date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={convDate ? parseISO(convDate) : undefined} onSelect={(d) => setConvDate(d ? format(d, 'yyyy-MM-dd') : null)} initialFocus />
                </PopoverContent>
              </Popover>
              <Select value={convPriority} onValueChange={(v) => setConvPriority(v as Priority)}>
                <SelectTrigger className="h-11 w-auto text-[13px] data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8" aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConvert((c) => ({ ...c, open: false }))} className="h-11 rounded-md px-3 lg:h-8 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button onClick={doConvert} disabled={!convert.text.trim()} className="h-11 rounded-md px-3 lg:h-8 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
                Create task
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {canEdit && <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); deleteButtonRef.current?.focus() }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>“{title}” will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void removeNote() }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </Tabs>
  )
}

export default function Notes() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'all' | 'global' | string>('all')
  const [creating, setCreating] = useState(false)
  const noteId = searchParams.get('note')
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousNoteId = useRef(noteId)

  const createNote = async (partial?: Partial<Note>) => {
    if (!ws.canMutateNotes || creating) return
    setCreating(true)
    const created = await ws.addNote(partial)
    setCreating(false)
    if (created) openNote(created.id)
  }

  useEffect(() => {
    if (!ws.canMutateNotes) return
    if ((location.state as { newNote?: boolean } | null)?.newNote) {
      void createNote().finally(() => navigate(location.pathname, { replace: true, state: {} }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  useEffect(() => {
    if (previousNoteId.current && !noteId) listHeadingRef.current?.focus()
    previousNoteId.current = noteId
  }, [noteId])

  const notes = useMemo(() => {
    let l = [...ws.notes].sort((a, b) => b.updatedAt - a.updatedAt)
    if (scope === 'global') l = l.filter((n) => !n.projectId)
    else if (scope !== 'all') l = l.filter((n) => n.projectId === scope)
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    }
    return l
  }, [ws.notes, scope, search])

  const active = ws.getNote(noteId) ?? null

  useEffect(() => {
    if (active) ws.pushRecent({ type: 'note', id: active.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const openNote = (id: string) => setSearchParams({ note: id })

  // Mobile: list or editor. Desktop: side by side.
  const showEditor = !!active

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-x-hidden">
      <div className="flex flex-1 min-h-0">
        {/* list pane */}
        <div className={cn('flex-col border-r border-border bg-background w-full md:w-[320px] xl:w-[340px] md:flex shrink-0', showEditor ? 'hidden md:flex' : 'flex')}>
          <div className="px-4 pt-6 sm:pt-8 pb-3">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h1 ref={listHeadingRef} tabIndex={-1} className="pg-page-title">Notes</h1>
                <p className="pg-page-kicker">{ws.notes.length} notes</p>
              </div>
              {ws.canMutateNotes && <button
                onClick={() => { void createNote({ projectId: scope !== 'all' && scope !== 'global' ? scope : null }) }}
                aria-label="New note"
                aria-busy={creating}
                disabled={creating}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary lg:h-9 lg:w-9 text-primary-foreground inline-flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>}
            </header>
            {!ws.canMutateNotes && <p className="mb-3 text-xs text-muted-foreground">Notes are read-only in this workspace.</p>}
            <div className="mb-2">
              <InputGroup className="h-11 border-input lg:h-8 bg-card shadow-none">
                <InputGroupAddon className="pl-2.5 pr-0">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes"
                  aria-label="Search notes"
                  className="h-11 px-2 text-[13px] placeholder:text-muted-foreground lg:h-8"
                />
                {search && (
                  <InputGroupButton type="button" size="icon-sm" onClick={() => setSearch('')} aria-label="Clear search" className="mr-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </InputGroupButton>
                )}
              </InputGroup>
            </div>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-11 w-full border-input bg-card text-[13px] data-[size=default]:h-11 lg:h-8 lg:data-[size=default]:h-8" aria-label="Filter notes by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All notes</SelectItem>
                <SelectItem value="global">Global notes</SelectItem>
                {ws.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
            {notes.length === 0 ? (
                <EmptyState icon={<StickyNote className="h-6 w-6" />} title="No notes here" hint={search ? 'Try a different search.' : !ws.canMutateNotes ? 'Notes are read-only in this connected workspace.' : 'Create one to get started.'} />
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNote(n.id)}
                  aria-current={active?.id === n.id}
                  className={cn(
                    'mb-0.5 min-h-11 w-full rounded-md px-2.5 py-2 text-left transition-colors',
                    active?.id === n.id ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <p className="text-[13px] font-medium truncate">{n.title}</p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0">{timeAgo(n.updatedAt)}</span>
                    {n.projectId && <ProjectChip project={ws.getProject(n.projectId)} className="truncate" />}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* editor pane */}
        <div className={cn('flex-1 min-w-0 min-h-0 flex-col', showEditor ? 'flex' : 'hidden md:flex')}>
          {active ? (
            <NoteEditor key={active.id} note={active} onBack={() => setSearchParams({}, { replace: true })} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<StickyNote className="h-7 w-7" />}
                title="Pick a note, or start a new one"
                hint="Notes support Markdown and stay close to their project."
                action={ws.canMutateNotes ? (
                  <button
                    onClick={() => { void createNote() }}
                    disabled={creating}
                    className="h-11 rounded-md px-3 lg:h-8 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {creating ? 'Creating…' : 'New note'}
                  </button>
                ) : undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
