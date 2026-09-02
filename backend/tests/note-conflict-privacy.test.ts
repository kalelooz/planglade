import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { PATCH as updateNote } from "../src/app/api/notes/[noteId]/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.PLANGLADE_AUTH_MODE
const originals = {
  userFindUnique: db.user.findUnique,
  workspaceFindUnique: db.workspace.findUnique,
  memberFindUnique: db.workspaceMember.findUnique,
  noteFindUnique: db.note.findUnique,
  noteFindFirst: db.note.findFirst,
  transaction: db.$transaction,
}

test.afterEach(() => {
  if (originalAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
  else process.env.PLANGLADE_AUTH_MODE = originalAuthMode
  ;(db.user as typeof db.user).findUnique = originals.userFindUnique
  ;(db.workspace as typeof db.workspace).findUnique = originals.workspaceFindUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originals.memberFindUnique
  ;(db.note as typeof db.note).findUnique = originals.noteFindUnique
  ;(db.note as typeof db.note).findFirst = originals.noteFindFirst
  ;(db as typeof db).$transaction = originals.transaction
})

test("a stale note conflict cannot reveal a note made private during the race", async () => {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  ;(db.user as typeof db.user).findUnique = ((async () => ({
    id: "member-1",
    email: "alex.morgan@planglade.dev",
    normalizedEmail: "alex.morgan@planglade.dev",
    firebaseUid: null,
    name: "Alex Morgan",
    image: null,
    authVersion: 0,
  })) as unknown) as typeof db.user.findUnique
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-1",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "member-1",
    role: "MEMBER",
  })) as unknown) as typeof db.workspaceMember.findUnique
  ;(db.note as typeof db.note).findUnique = ((async () => ({
    id: "note-1",
    workspaceId: "workspace-1",
    title: "Initially shared",
    visibility: "WORKSPACE",
    createdById: "owner-1",
    updatedAt: new Date("2026-09-02T10:00:01.000Z"),
  })) as unknown) as typeof db.note.findUnique

  let currentWhere: unknown
  ;(db.note as typeof db.note).findFirst = ((async (args: { where: unknown }) => {
    currentWhere = args.where
    return null
  }) as unknown) as typeof db.note.findFirst
  ;(db as typeof db).$transaction = (async (callback: (tx: unknown) => Promise<unknown>) => callback({
    note: { updateMany: async () => ({ count: 0 }) },
  })) as typeof db.$transaction

  const response = await updateNote(new NextRequest(
    "http://localhost/api/notes/note-1?workspaceId=workspace-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Stale edit", expectedUpdatedAt: "2026-09-02T10:00:00.000Z" }),
    },
  ), { params: Promise.resolve({ noteId: "note-1" }) })
  const payload = await response.json()

  assert.equal(response.status, 409)
  assert.equal(payload.current, null)
  assert.deepEqual(currentWhere, {
    id: "note-1",
    workspaceId: "workspace-1",
    OR: [
      { visibility: "WORKSPACE" },
      { visibility: "PRIVATE", createdById: "member-1" },
    ],
  })
})
