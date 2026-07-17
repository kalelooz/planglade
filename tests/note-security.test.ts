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
const originalThrottleDeleteMany = db.authThrottle.deleteMany
const originalQueryRaw = db.$queryRaw

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
  ;(db.authThrottle as typeof db.authThrottle).deleteMany = (async () => ({ count: 0 })) as typeof db.authThrottle.deleteMany
  ;(db as unknown as { $queryRaw: unknown }).$queryRaw = (async () => [{ blockedUntil: null }]) as typeof db.$queryRaw

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
    ;(db.authThrottle as typeof db.authThrottle).deleteMany = originalThrottleDeleteMany
    ;(db as unknown as { $queryRaw: unknown }).$queryRaw = originalQueryRaw
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

test("note editor suppresses raw HTML, unsafe links, and executable content", async () => {
  const [config, component] = await Promise.all([
    readFile("src/components/notes/markdown-editor-config.ts", "utf8"),
    readFile("src/components/notes/markdown-editor.tsx", "utf8"),
  ])

  // Explicit protocol allowlist (not a fragile prefix check): only http, https, mailto.
  assert.match(config, /SAFE_LINK_PROTOCOLS\s*=\s*new Set\(\[["']http:["'].*["']https:["'].*["']mailto:["']/)
  assert.match(config, /isSafeNoteLink/)
  assert.match(config, /isAllowedUri:\s*isSafeNoteLink/)
  assert.match(config, /sanitizeNoteDocument/)

  // No raw-HTML injection path in the editor surface.
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/)
  assert.doesNotMatch(component, /MDXEditor/)

  // Runtime verification against a real Tiptap editor instance: hostile Markdown
  // cannot survive as executable content or an actionable unsafe link.
  const { Editor } = await import("@tiptap/core")
  const {
    createNoteEditorExtensions,
    prepareNoteMarkdown,
    sanitizeNoteDocument,
    serializeNoteMarkdown,
    isSafeNoteLink,
  } = await import("../src/components/notes/markdown-editor-config")

  const hostile = [
    '<script>alert("x")</script>',
    '<img src=x onerror=alert("x")>',
    '<iframe src="about:blank"></iframe>',
    "[bad](javascript:alert(1))",
    "[data](data:text/html,<script>)",
    "[good](https://example.com)",
    "[mail](mailto:hello@example.com)",
  ].join("\n\n")

  const editor = new Editor({
    extensions: createNoteEditorExtensions(),
    content: prepareNoteMarkdown(hostile),
    contentType: "markdown",
  })

  const document = sanitizeNoteDocument(editor.getJSON())
  const documentJson = JSON.stringify(document)
  const serialized = serializeNoteMarkdown(editor)
  editor.destroy()

  // Hostile HTML never becomes an executable node type: scripts, images, and
  // iframes must appear only as inert text, never as their own element nodes.
  assert.doesNotMatch(documentJson, /"type":"script"|"type":"image"|"type":"iframe"/i)
  assert.doesNotMatch(documentJson, /"onerror"|javascript:|vbscript:/i)
  // No unsafe protocol survives as an active link mark attribute.
  for (const node of document.content ?? []) {
    for (const mark of node.marks ?? []) {
      if (mark.type === "link") {
        assert.match(String(mark.attrs?.href ?? ""), /^https?:|^mailto:/)
      }
    }
  }
  // Serialized Markdown escapes raw HTML rather than emitting active elements.
  assert.doesNotMatch(serialized, /<script|<iframe/i)
  assert.match(serialized, /&lt;script&gt;/i)
  // Unsafe protocols are rejected by the allowlist; safe links round-trip.
  assert.equal(isSafeNoteLink("javascript:alert(1)"), false)
  assert.equal(isSafeNoteLink("data:text/html,<script>"), false)
  assert.equal(isSafeNoteLink("vbscript:msgbox"), false)
  assert.equal(isSafeNoteLink("https://example.com"), true)
  assert.equal(isSafeNoteLink("mailto:hello@example.com"), true)
  assert.match(serialized, /\[good\]\(https:\/\/example\.com\)/)

  // MDX expressions never execute: the editor has no MDX/JSX runtime, so an
  // expression like {whoami()} is stored as inert plain text rather than evaluated.
  const mdxExpression = "{whoami()}"
  const expressionEditor = new Editor({
    extensions: createNoteEditorExtensions(),
    content: prepareNoteMarkdown(mdxExpression),
    contentType: "markdown",
  })
  const expressionDocument = sanitizeNoteDocument(expressionEditor.getJSON())
  const expressionSerialized = serializeNoteMarkdown(expressionEditor)
  expressionEditor.destroy()
  assert.equal(expressionSerialized.includes("{whoami()}"), true)
  assert.equal(JSON.stringify(expressionDocument).includes('"type":"mdxExpression"'), false)
  assert.doesNotMatch(JSON.stringify(expressionDocument), /"type":"mdx[\w]*"/i)
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
