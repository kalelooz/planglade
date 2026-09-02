import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { GET as listWorkItems } from "../src/app/api/work-items/route"
import { db } from "../src/lib/db"

const originalUserFindUnique = db.user.findUnique
const originalMemberFindUnique = db.workspaceMember.findUnique
const originalTransaction = db.$transaction
const originalAuthMode = process.env.PLANGLADE_AUTH_MODE
const originalPublicAuthMode = process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE

test.afterEach(() => {
  ;(db.user as typeof db.user).findUnique = originalUserFindUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalMemberFindUnique
  ;(db as typeof db).$transaction = originalTransaction
  if (originalAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
  else process.env.PLANGLADE_AUTH_MODE = originalAuthMode
  if (originalPublicAuthMode === undefined) delete process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
  else process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = originalPublicAuthMode
})

test("work-item ordering and lane versions come from one serializable snapshot", async () => {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"
  ;(db.user as typeof db.user).findUnique = ((async () => ({
    id: "user-1",
    email: "alex.morgan@planglade.dev",
    normalizedEmail: "alex.morgan@planglade.dev",
    firebaseUid: null,
    name: "Alex Morgan",
    image: null,
    authVersion: 0,
  })) as unknown) as typeof db.user.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "user-1",
    role: "MEMBER",
  })) as unknown) as typeof db.workspaceMember.findUnique

  let transactionCalls = 0
  let isolationLevel: unknown
  ;(db as typeof db).$transaction = (async (callback: (tx: unknown) => Promise<unknown>, options?: { isolationLevel?: unknown }) => {
    transactionCalls += 1
    isolationLevel = options?.isolationLevel
    return callback({
      workItem: { findMany: async () => [{ id: "task-1", status: "TODO", position: 1024 }] },
      workItemLaneVersion: { findMany: async () => [{ status: "TODO", version: 7 }] },
    })
  }) as typeof db.$transaction

  const response = await listWorkItems(new NextRequest(
    "http://localhost/api/work-items?workspaceId=workspace-1",
  ))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(transactionCalls, 1)
  assert.equal(isolationLevel, "Serializable")
  assert.equal(payload.workItems[0].id, "task-1")
  assert.deepEqual(payload.laneVersions, {
    BACKLOG: 0,
    TODO: 7,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  })
})
