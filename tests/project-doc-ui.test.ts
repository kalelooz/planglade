import assert from "node:assert/strict"
import test from "node:test"

import {
  hasProjectDocDraftChanges,
  selectInitialProjectDocId,
  toUiProjectDoc,
  type UiProjectDoc,
} from "../src/lib/project-doc-ui"

const docs: UiProjectDoc[] = [
  {
    id: "doc-1",
    title: "Runbook",
    body: "Steps",
    projectId: "project-1",
    status: "ACTIVE",
    updatedLabel: "Jun 6",
  },
  {
    id: "doc-2",
    title: "Plan",
    body: "",
    projectId: "project-1",
    status: "ACTIVE",
    updatedLabel: "Jun 5",
  },
]

test("project doc mapper keeps user text as plain escaped React content", () => {
  const doc = toUiProjectDoc({
    id: "doc-1",
    title: "  <script>Guide</script>  ",
    body: "<b>Use text, not HTML preview</b>",
    projectId: "project-1",
    status: "ACTIVE",
    updatedAt: "2026-06-06T12:00:00.000Z",
  })

  assert.equal(doc.title, "<script>Guide</script>")
  assert.equal(doc.body, "<b>Use text, not HTML preview</b>")
  assert.equal(doc.projectId, "project-1")
  assert.equal(doc.status, "ACTIVE")
})

test("selectInitialProjectDocId honors a valid requested doc and otherwise uses the first active doc", () => {
  assert.equal(selectInitialProjectDocId(docs, "doc-2"), "doc-2")
  assert.equal(selectInitialProjectDocId(docs, "missing"), "doc-1")
  assert.equal(selectInitialProjectDocId([], "missing"), null)
})

test("hasProjectDocDraftChanges tracks create and edit save state", () => {
  assert.equal(hasProjectDocDraftChanges(null, { title: "", body: "" }, "new"), false)
  assert.equal(hasProjectDocDraftChanges(null, { title: "Guide", body: "" }, "new"), true)
  assert.equal(hasProjectDocDraftChanges(docs[0], { title: "Runbook", body: "Steps" }, "edit"), false)
  assert.equal(hasProjectDocDraftChanges(docs[0], { title: "Runbook", body: "Updated" }, "edit"), true)
})
