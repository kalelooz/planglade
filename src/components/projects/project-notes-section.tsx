"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/server-session-client"

export type UiProjectNote = {
  id: string
  title: string
  tag: string
  body: string
  projectId: string | null
  updated: string
  excerpt: string
}

type ApiNote = {
  id: string
  title: string
  body: string | null
  projectId?: string | null
  tags?: unknown
  updatedAt: string
}

type Draft = { title: string; body: string }

const EMPTY_DRAFT: Draft = { title: "", body: "" }

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function mapTag(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0]
  return "Note"
}

function toProjectNote(note: ApiNote): UiProjectNote {
  const body = note.body ?? ""
  const trimmedBody = body.trim()
  const firstBodyLine = trimmedBody
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean)
  const title = note.title.trim() === "Untitled" && firstBodyLine ? firstBodyLine.slice(0, 80) : note.title

  return {
    id: note.id,
    title,
    tag: mapTag(note.tags),
    body,
    projectId: note.projectId ?? null,
    updated: formatShortDate(note.updatedAt),
    excerpt: trimmedBody.length > 80 ? `${trimmedBody.slice(0, 80)}...` : trimmedBody,
  }
}

export function ProjectNotesSection({
  workspaceId,
  currentUserId,
  projectId,
  projectName,
  notes,
  onNotesChanged,
}: {
  workspaceId: string | null
  currentUserId: string | null
  projectId: string
  projectName?: string
  notes: UiProjectNote[]
  onNotesChanged: (notes: UiProjectNote[]) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<"new" | "edit">("edit")
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId]
  )
  const dirty =
    mode === "new"
      ? draft.title.trim().length > 0 || draft.body.trim().length > 0
      : Boolean(selectedNote && (selectedNote.title !== draft.title || selectedNote.body !== draft.body))

  useEffect(() => {
    if (notes.length === 0) {
      setSelectedId(null)
      setMode("new")
      if (mode !== "new") setDraft(EMPTY_DRAFT)
      return
    }

    if (mode === "new") return

    const nextSelected = notes.find((note) => note.id === selectedId) ?? notes[0]
    setSelectedId(nextSelected.id)
    setMode("edit")
    setDraft({ title: nextSelected.title, body: nextSelected.body })
  }, [mode, notes, selectedId])

  const startNewNote = () => {
    setSelectedId(null)
    setMode("new")
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const selectNote = (note: UiProjectNote) => {
    setSelectedId(note.id)
    setMode("edit")
    setDraft({ title: note.title, body: note.body })
    setError(null)
  }

  const saveNote = async () => {
    if (!workspaceId) return
    const title = draft.title.trim()
    if (!title) {
      setError("Add a title before saving.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response =
        mode === "new"
          ? await apiFetch("/api/notes", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-flowboard-user-id": currentUserId ?? "",
              },
              body: JSON.stringify({
                workspaceId,
                projectId,
                title,
                body: draft.body,
                visibility: "PRIVATE",
                tags: ["Note"],
              }),
            })
          : selectedNote
            ? await apiFetch(`/api/notes/${encodeURIComponent(selectedNote.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
                method: "PATCH",
                headers: {
                  "content-type": "application/json",
                  "x-flowboard-user-id": currentUserId ?? "",
                },
                body: JSON.stringify({
                  projectId,
                  title,
                  body: draft.body,
                  tags: ["Note"],
                }),
              })
            : null

      if (!response) return
      if (!response.ok) throw new Error(mode === "new" ? "Failed to create project note" : "Failed to save project note")
      const payload = (await response.json()) as { note: ApiNote }
      const next = toProjectNote(payload.note)
      onNotesChanged(
        mode === "new"
          ? [next, ...notes]
          : notes.map((note) => (note.id === next.id ? next : note))
      )
      setSelectedId(next.id)
      setMode("edit")
      setDraft({ title: next.title, body: next.body })
      toast.success(mode === "new" ? "Project note created" : "Project note saved")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save project note")
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async () => {
    if (!workspaceId || !selectedNote) return
    if (!window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch(
        `/api/notes/${encodeURIComponent(selectedNote.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Failed to delete project note")
      const remaining = notes.filter((note) => note.id !== selectedNote.id)
      onNotesChanged(remaining)
      const nextSelected = remaining[0] ?? null
      setSelectedId(nextSelected?.id ?? null)
      setMode(nextSelected ? "edit" : "new")
      setDraft(nextSelected ? { title: nextSelected.title, body: nextSelected.body } : EMPTY_DRAFT)
      toast.success("Project note deleted")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete project note")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid min-h-[520px] min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold tracking-tight">Notes</h2>
            <p className="text-[11px] text-muted-foreground">
              {notes.length} linked · Project context{projectName ? ` for ${projectName}` : ""}
            </p>
          </div>
          <button type="button" onClick={startNewNote} className="lov-btn lov-btn-primary h-8 shrink-0 px-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" /> New note
          </button>
        </div>

        <div className="max-h-[460px] overflow-y-auto">
          {notes.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <FileText className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="text-[13px] font-medium text-foreground">No project notes yet.</p>
              <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-5 text-muted-foreground">
                Capture decisions, research, meeting notes, and project context here.
              </p>
              <button type="button" onClick={startNewNote} className="lov-btn lov-btn-primary mt-4 h-8 px-2 text-[12px]">
                <Plus className="h-3.5 w-3.5" /> New note
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => selectNote(note)}
                className={`block w-full border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-[var(--color-hover)]/40 ${
                  selectedId === note.id ? "bg-[var(--color-hover)]/60" : ""
                }`}
              >
                <span className="block truncate text-[13px] font-medium text-foreground">{note.title}</span>
                {note.excerpt && <span className="mt-1 line-clamp-2 block text-[12px] text-muted-foreground">{note.excerpt}</span>}
                <span className="mt-2 block text-[11px] text-muted-foreground">Edited {note.updated}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="min-w-0 rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {mode === "new" ? "New project note" : "Editing project note"}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              Saved notes stay linked to this project and also appear on the global Notes page.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {mode === "edit" && selectedNote && (
              <button type="button" onClick={() => { void deleteNote() }} disabled={saving} className="lov-btn lov-btn-danger h-8 px-2 text-[12px]">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => { void saveNote() }}
              disabled={saving || !draft.title.trim() || (mode === "edit" && !dirty)}
              className="lov-btn lov-btn-primary h-8 px-2 text-[12px] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving" : mode === "new" ? "Create note" : "Save note"}
            </button>
          </div>
        </div>

        {error && <div className="mx-4 mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}

        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Title</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Meeting notes"
              className="h-9 w-full rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Body</span>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder="Capture the thought, meeting detail, or project note here."
              rows={18}
              className="min-h-[360px] w-full resize-y rounded-md border bg-background px-3 py-2 text-[13px] leading-6 outline-none focus:border-ring"
            />
          </label>
        </div>
      </div>
    </section>
  )
}
