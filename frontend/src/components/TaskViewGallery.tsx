import { useState } from 'react'
import { ArrowDown, ArrowUp, Bookmark, Pin, PinOff, Star, Trash2 } from 'lucide-react'
import type { BackendSavedView } from '@/lib/api/contracts'
import { savedViewPlacement } from '@/lib/saved-presentations'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function TaskViewGallery({
  savedViews,
  activeSavedId,
  loading,
  error,
  onChooseSaved,
  onRename,
  onTogglePinned,
  onSetDefault,
  onMove,
  onDelete,
}: {
  savedViews: BackendSavedView[]
  activeSavedId: string | null
  loading: boolean
  error: boolean
  onChooseSaved: (saved: BackendSavedView) => void
  onRename: (saved: BackendSavedView, name: string) => Promise<void>
  onTogglePinned: (saved: BackendSavedView) => Promise<void>
  onSetDefault: (saved: BackendSavedView) => Promise<void>
  onMove: (saved: BackendSavedView, direction: -1 | 1) => Promise<void>
  onDelete: (saved: BackendSavedView) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Manage saved task views">
          <Bookmark className="h-3.5 w-3.5" aria-hidden /> Saved
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="max-h-[min(620px,calc(100dvh-80px))] w-[min(520px,calc(100vw-24px))] overflow-y-auto p-3">
        <header className="px-1 pb-2">
          <h2 className="text-[13px] font-semibold">Saved views</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Reuse a view with its filters, sorting, and display settings.</p>
        </header>

        {loading ? (
          <p className="px-1 py-3 text-[12px] text-muted-foreground">Loading saved views…</p>
        ) : error ? (
          <p className="px-1 py-3 text-[12px] text-destructive">Saved views could not load. Your current view is safe; try reopening this menu.</p>
        ) : savedViews.length === 0 ? (
          <p className="rounded-md bg-muted/45 px-3 py-4 text-[12px] text-muted-foreground">No saved views yet.</p>
        ) : (
          <div className="space-y-1">
            {savedViews.map((saved) => {
              const placement = savedViewPlacement(saved)
              if (editing === saved.id) {
                return (
                  <form key={saved.id} onSubmit={(event) => { event.preventDefault(); if (!editName.trim()) return; void onRename(saved, editName.trim()).then(() => setEditing(null)) }} className="flex gap-2 rounded-md bg-accent/35 p-2">
                    <input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} aria-label={`Rename ${saved.name}`} className="h-9 min-w-0 flex-1 rounded border border-input bg-background px-2 text-base outline-none focus:ring-1 focus:ring-ring sm:text-[12px]" />
                    <button className="rounded bg-foreground px-2 text-[12.5px] text-background">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-1 text-[12.5px] text-muted-foreground">Cancel</button>
                  </form>
                )
              }
              return (
                <div key={saved.id} className={cn('group flex flex-wrap items-center gap-1 rounded-md px-1 py-1 hover:bg-accent/40', activeSavedId === saved.id && 'bg-accent/60')}>
                  <button onClick={() => { onChooseSaved(saved); setOpen(false) }} className="min-w-[10rem] flex-1 rounded px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex items-center gap-1.5 truncate text-[12.5px] font-medium">{saved.name}{saved.isDefault && <Star className="h-3 w-3 fill-current" aria-label="Default view" />}</span>
                    <span className="block text-[12.5px] capitalize text-muted-foreground">{saved.layout === 'kanban' ? 'Board' : saved.layout}</span>
                  </button>
                  <button onClick={() => void onMove(saved, -1)} aria-label={`Move ${saved.name} up`} className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => void onMove(saved, 1)} aria-label={`Move ${saved.name} down`} className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => void onSetDefault(saved)} aria-label={`Set ${saved.name} as default`} className={cn('grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground', saved.isDefault && 'text-foreground')}><Star className={cn('h-3.5 w-3.5', saved.isDefault && 'fill-current')} /></button>
                  <button onClick={() => void onTogglePinned(saved)} aria-label={placement.pinned ? `Unpin ${saved.name}` : `Pin ${saved.name}`} className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">{placement.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                  <button onClick={() => { setEditing(saved.id); setEditName(saved.name) }} className="rounded px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground">Rename</button>
                  <button onClick={() => void onDelete(saved)} aria-label={`Delete ${saved.name}`} className="grid size-8 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
