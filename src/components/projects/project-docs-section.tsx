"use client"

import { useEffect, useMemo, useState } from "react"
import { Archive, FileText, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/server-session-client"
import {
  type ApiProjectDoc,
  type UiProjectDoc,
  hasProjectDocDraftChanges,
  selectInitialProjectDocId,
  toUiProjectDoc,
} from "@/lib/project-doc-ui"

type Draft = { title: string; body: string }

const EMPTY_DRAFT: Draft = { title: "", body: "" }

export function ProjectDocsSection({
  workspaceId,
  currentUserId,
  projectId,
  onDocsChanged,
}: {
  workspaceId: string | null
  currentUserId: string | null
  projectId: string
  onDocsChanged?: (docs: UiProjectDoc[]) => void
}) {
  const [docs, setDocs] = useState<UiProjectDoc[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<"new" | "edit">("new")
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.id === selectedId) ?? null,
    [docs, selectedId]
  )
  const dirty = hasProjectDocDraftChanges(selectedDoc, draft, mode)

  useEffect(() => {
    let active = true

    async function loadDocs() {
      if (!workspaceId) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          workspaceId,
          projectId,
          status: "ACTIVE",
        })
        const response = await apiFetch(`/api/project-docs?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) throw new Error("Failed to load project docs")
        const payload = (await response.json()) as { docs: ApiProjectDoc[] }
        if (!active) return
        const mapped = payload.docs.map(toUiProjectDoc)
        const nextSelectedId = selectInitialProjectDocId(mapped, selectedId)
        const nextSelected = mapped.find((doc) => doc.id === nextSelectedId) ?? null
        setDocs(mapped)
        setSelectedId(nextSelectedId)
        setMode(nextSelected ? "edit" : "new")
        setDraft(nextSelected ? { title: nextSelected.title, body: nextSelected.body } : EMPTY_DRAFT)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : "Failed to load project docs")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDocs()
    return () => {
      active = false
    }
  }, [projectId, workspaceId])

  const startNewDoc = () => {
    setSelectedId(null)
    setMode("new")
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const selectDoc = (doc: UiProjectDoc) => {
    setSelectedId(doc.id)
    setMode("edit")
    setDraft({ title: doc.title, body: doc.body })
    setError(null)
  }

  const saveDoc = async () => {
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
          ? await apiFetch("/api/project-docs", {
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
              }),
            })
          : selectedDoc
            ? await apiFetch(`/api/project-docs/${encodeURIComponent(selectedDoc.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
                method: "PATCH",
                headers: {
                  "content-type": "application/json",
                  "x-flowboard-user-id": currentUserId ?? "",
                },
                body: JSON.stringify({
                  title,
                  body: draft.body,
                }),
              })
            : null

      if (!response) return
      if (!response.ok) throw new Error(mode === "new" ? "Failed to create project doc" : "Failed to save project doc")
      const payload = (await response.json()) as { doc: ApiProjectDoc }
      const next = toUiProjectDoc(payload.doc)
      const nextDocs =
        mode === "new"
          ? [next, ...docs]
          : docs.map((doc) => (doc.id === next.id ? next : doc))
      setDocs(nextDocs)
      onDocsChanged?.(nextDocs)
      setSelectedId(next.id)
      setMode("edit")
      setDraft({ title: next.title, body: next.body })
      toast.success(mode === "new" ? "Project doc created" : "Project doc saved")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save project doc")
    } finally {
      setSaving(false)
    }
  }

  const archiveDoc = async () => {
    if (!workspaceId || !selectedDoc) return
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch(
        `/api/project-docs/${encodeURIComponent(selectedDoc.id)}/archive?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "POST", headers: { "x-flowboard-user-id": currentUserId ?? "" } }
      )
      if (!response.ok) throw new Error("Failed to archive project doc")
      const remaining = docs.filter((doc) => doc.id !== selectedDoc.id)
      onDocsChanged?.(remaining)
      const nextSelected = remaining[0] ?? null
      setDocs(remaining)
      setSelectedId(nextSelected?.id ?? null)
      setMode(nextSelected ? "edit" : "new")
      setDraft(nextSelected ? { title: nextSelected.title, body: nextSelected.body } : EMPTY_DRAFT)
      toast.success("Project doc archived")
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive project doc")
    } finally {
      setSaving(false)
    }
  }

  const deleteDoc = async () => {
    if (!workspaceId || !selectedDoc) return
    if (!window.confirm(`Delete "${selectedDoc.title}"? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch(
        `/api/project-docs/${encodeURIComponent(selectedDoc.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Failed to delete project doc")
      const remaining = docs.filter((doc) => doc.id !== selectedDoc.id)
      onDocsChanged?.(remaining)
      const nextSelected = remaining[0] ?? null
      setDocs(remaining)
      setSelectedId(nextSelected?.id ?? null)
      setMode(nextSelected ? "edit" : "new")
      setDraft(nextSelected ? { title: nextSelected.title, body: nextSelected.body } : EMPTY_DRAFT)
      toast.success("Project doc deleted")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete project doc")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid min-h-[520px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-md border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight">Project Docs</h2>
            <p className="text-[11px] text-muted-foreground">{docs.length} active</p>
          </div>
          <button type="button" onClick={startNewDoc} className="lov-btn lov-btn-primary h-8 px-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" /> New doc
          </button>
        </div>

        <div className="max-h-[460px] overflow-y-auto">
          {loading ? (
            <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">Loading docs...</div>
          ) : docs.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <FileText className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="text-[13px] font-medium text-foreground">No project docs yet</p>
              <p className="mx-auto mt-1 max-w-[220px] text-[12px] leading-5 text-muted-foreground">
                Keep project context, SOPs, plans, and decisions beside the work.
              </p>
              <button type="button" onClick={startNewDoc} className="lov-btn lov-btn-primary mt-4 h-8 px-2 text-[12px]">
                <Plus className="h-3.5 w-3.5" /> New doc
              </button>
            </div>
          ) : (
            docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => selectDoc(doc)}
                className={`block w-full border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-[var(--color-hover)]/40 ${
                  selectedId === doc.id ? "bg-[var(--color-hover)]/60" : ""
                }`}
              >
                <span className="block truncate text-[13px] font-medium text-foreground">{doc.title}</span>
                {doc.body && <span className="mt-1 line-clamp-2 block text-[12px] text-muted-foreground">{doc.body}</span>}
                <span className="mt-2 block text-[11px] text-muted-foreground">Edited {doc.updatedLabel}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {mode === "new" ? "New project doc" : "Editing project doc"}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              Plain text with simple Markdown is enough for guides, SOPs, and plans.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && selectedDoc && (
              <>
                <button type="button" onClick={() => { void archiveDoc() }} disabled={saving} className="lov-btn lov-btn-ghost h-8 px-2 text-[12px]">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
                <button type="button" onClick={() => { void deleteDoc() }} disabled={saving} className="lov-btn lov-btn-danger h-8 px-2 text-[12px]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { void saveDoc() }}
              disabled={saving || !draft.title.trim() || (mode === "edit" && !dirty)}
              className="lov-btn lov-btn-primary h-8 px-2 text-[12px] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving" : mode === "new" ? "Create doc" : "Save"}
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
              placeholder="e.g. Launch checklist"
              className="h-9 w-full rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Body</span>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write the useful context, steps, decisions, or plan here."
              rows={18}
              className="min-h-[360px] w-full resize-y rounded-md border bg-background px-3 py-2 text-[13px] leading-6 outline-none focus:border-ring"
            />
          </label>
        </div>
      </div>
    </section>
  )
}
