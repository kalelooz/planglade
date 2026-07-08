import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { NextRequest } from "next/server"

import { POST as createAttachmentUploadUrl } from "../src/app/api/attachments/upload-url/route"
import { PATCH as patchNote } from "../src/app/api/notes/[noteId]/route"
import { GET as listNotes } from "../src/app/api/notes/route"
import { GET as searchWorkspace } from "../src/app/api/search/route"
import { POST as createWorkItem } from "../src/app/api/work-items/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalNoteFindMany = db.note.findMany
const originalNoteFindUnique = db.note.findUnique
const originalNoteCount = db.note.count
const originalProjectFindMany = db.project.findMany
const originalWorkItemFindMany = db.workItem.findMany
const originalLabelFindMany = db.label.findMany
const originalTransaction = db.$transaction

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "ws-1",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "member-b",
    role: "MEMBER",
  })) as unknown) as typeof db.workspaceMember.findUnique

  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
    ;(db.note as typeof db.note).findMany = originalNoteFindMany
    ;(db.note as typeof db.note).findUnique = originalNoteFindUnique
    ;(db.note as typeof db.note).count = originalNoteCount
    ;(db.project as typeof db.project).findMany = originalProjectFindMany
    ;(db.workItem as typeof db.workItem).findMany = originalWorkItemFindMany
    ;(db.label as typeof db.label).findMany = originalLabelFindMany
    ;(db as typeof db).$transaction = originalTransaction
  }
}

const expectedAccess = {
  OR: [
    { visibility: "WORKSPACE" },
    { visibility: "PRIVATE", createdById: "member-b" },
  ],
}

test("note list limits private notes to their author", async () => {
  await runWithMocks(async () => {
    let where: unknown
    ;(db.note as typeof db.note).findMany = ((async (args: unknown) => {
      where = (args as { where: unknown }).where
      return []
    }) as unknown) as typeof db.note.findMany

    const response = await listNotes(
      new NextRequest("http://localhost/api/notes?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "member-b" },
      })
    )

    assert.equal(response.status, 200)
    assert.deepEqual(where, { workspaceId: "ws-1", ...expectedAccess })
  })
})

test("a workspace member cannot mutate another author's private note", async () => {
  await runWithMocks(async () => {
    ;(db.note as typeof db.note).findUnique = ((async () => ({
      id: "private-a",
      workspaceId: "ws-1",
      title: "Private A",
      visibility: "PRIVATE",
      createdById: "member-a",
    })) as unknown) as typeof db.note.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("private note mutation must not start")
    }) as typeof db.$transaction

    const response = await patchNote(
      new NextRequest("http://localhost/api/notes/private-a?workspaceId=ws-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-b",
        },
        body: JSON.stringify({ title: "Changed" }),
      }),
      { params: Promise.resolve({ noteId: "private-a" }) }
    )

    assert.equal(response.status, 404)
    assert.equal(transactionCalled, false)
  })
})

test("workspace search applies the author-only private-note predicate", async () => {
  await runWithMocks(async () => {
    ;(db.project as typeof db.project).findMany = ((async () => []) as unknown) as typeof db.project.findMany
    ;(db.workItem as typeof db.workItem).findMany = ((async () => []) as unknown) as typeof db.workItem.findMany
    ;(db.label as typeof db.label).findMany = ((async () => []) as unknown) as typeof db.label.findMany

    let noteWhere: unknown
    ;(db.note as typeof db.note).findMany = ((async (args: unknown) => {
      noteWhere = (args as { where: unknown }).where
      return []
    }) as unknown) as typeof db.note.findMany

    const response = await searchWorkspace(
      new NextRequest("http://localhost/api/search?workspaceId=ws-1&q=plan", {
        headers: { "x-flowboard-user-id": "member-b" },
      })
    )

    assert.equal(response.status, 200)
    assert.deepEqual(noteWhere, {
      AND: [
        { workspaceId: "ws-1", ...expectedAccess },
        { OR: [{ title: { contains: "plan" } }, { body: { contains: "plan" } }] },
      ],
    })
  })
})

test("task creation rejects an inaccessible private note reference", async () => {
  await runWithMocks(async () => {
    let noteCountCalled = false
    ;(db.note as typeof db.note).count = ((async () => {
      noteCountCalled = true
      return 0
    }) as unknown) as typeof db.note.count

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("task transaction must not start")
    }) as typeof db.$transaction

    const response = await createWorkItem(
      new NextRequest("http://localhost/api/work-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-b",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          title: "Extracted task",
          noteIds: ["private-a"],
        }),
      })
    )

    assert.equal(response.status, 400)
    assert.equal(noteCountCalled, true)
    assert.equal(transactionCalled, false)
  })
})

test("attachment upload targets reject another author's private note", async () => {
  await runWithMocks(async () => {
    ;(db.note as typeof db.note).findUnique = ((async () => ({
      id: "private-a",
      workspaceId: "ws-1",
      projectId: null,
      visibility: "PRIVATE",
      createdById: "member-a",
    })) as unknown) as typeof db.note.findUnique

    const response = await createAttachmentUploadUrl(
      new NextRequest("http://localhost/api/attachments/upload-url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-b",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          noteId: "private-a",
          name: "notes.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
        }),
      })
    )

    assert.equal(response.status, 404)
  })
})

test("note editor suppresses raw HTML and executable MDX processing", async () => {
  const [component, core, lexicalLink] = await Promise.all([
    readFile("src/components/notes/markdown-editor-client.tsx", "utf8"),
    readFile("node_modules/@mdxeditor/editor/dist/plugins/core/index.js", "utf8"),
    readFile("node_modules/@lexical/link/LexicalLink.dev.js", "utf8"),
  ])

  assert.match(component, /suppressHtmlProcessing/)
  assert.doesNotMatch(component, /jsxPlugin/)
  assert.match(core, /if \(!\(params.*suppressHtmlProcessing\)\)/)
  assert.match(lexicalLink, /about:blank/)
  assert.match(lexicalLink, /new Set\(\[[\s\S]*http:[\s\S]*https:[\s\S]*mailto:[\s\S]*sms:[\s\S]*tel:/)

  const suppressedRepresentations = [
    "<script>inert marker</script>",
    '<img src="x" onerror="inert marker">',
    '<iframe src="about:blank"></iframe>',
    "{inertMdxExpression}",
  ]
  assert.equal(suppressedRepresentations.every((value) => /[<{]/.test(value)), true)
  assert.equal("[link](javascript:inert)".includes("javascript:"), true)
})

test("secondary note access paths use the shared author-only guard", async () => {
  const guardedReads = [
    "src/app/api/activity/route.ts",
    "src/app/api/workspace/export/route.ts",
    "src/app/api/workspace/import-local/route.ts",
    "src/app/api/workspace/import-preview/route.ts",
  ]
  const guardedItems = [
    "src/app/api/attachments/[attachmentId]/route.ts",
    "src/app/api/attachments/[attachmentId]/download-url/route.ts",
    "src/app/api/attachments/route.ts",
    "src/app/api/attachments/upload-url/route.ts",
  ]

  for (const path of guardedReads) {
    assert.match(await readFile(path, "utf8"), /buildNoteAccessWhere/)
  }
  for (const path of guardedItems) {
    assert.match(await readFile(path, "utf8"), /canAccessNote/)
  }
})
