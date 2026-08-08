export type ApiProjectDoc = {
  id: string
  title: string
  body: string | null
  projectId: string | null
  status: "ACTIVE" | "ARCHIVED"
  updatedAt: string
}

export type UiProjectDoc = {
  id: string
  title: string
  body: string
  projectId: string | null
  status: "ACTIVE" | "ARCHIVED"
  updatedLabel: string
}

export function toUiProjectDoc(doc: ApiProjectDoc): UiProjectDoc {
  return {
    id: doc.id,
    title: doc.title.trim() || "Untitled doc",
    body: doc.body ?? "",
    projectId: doc.projectId ?? null,
    status: doc.status,
    updatedLabel: new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }
}

export function selectInitialProjectDocId(docs: UiProjectDoc[], requestedId?: string | null) {
  if (requestedId && docs.some((doc) => doc.id === requestedId)) return requestedId
  return docs[0]?.id ?? null
}

export function hasProjectDocDraftChanges(
  doc: UiProjectDoc | null,
  draft: { title: string; body: string },
  mode: "new" | "edit"
) {
  if (mode === "new") return draft.title.trim().length > 0 || draft.body.trim().length > 0
  if (!doc) return false
  return draft.title.trim() !== doc.title || draft.body !== doc.body
}
