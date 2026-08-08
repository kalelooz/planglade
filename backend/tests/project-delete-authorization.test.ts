import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { DELETE as deleteProject, PATCH as updateProject } from "../src/app/api/projects/[projectId]/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.PLANGLADE_AUTH_MODE
const originals = {
  userUpsert: db.user.upsert,
  workspaceFindUnique: db.workspace.findUnique,
  memberFindUnique: db.workspaceMember.findUnique,
  projectFindUnique: db.project.findUnique,
  transaction: db.$transaction,
}

test.afterEach(() => {
  if (originalAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
  else process.env.PLANGLADE_AUTH_MODE = originalAuthMode
  ;(db.user as typeof db.user).upsert = originals.userUpsert
  ;(db.workspace as typeof db.workspace).findUnique = originals.workspaceFindUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originals.memberFindUnique
  ;(db.project as typeof db.project).findUnique = originals.projectFindUnique
  ;(db as typeof db).$transaction = originals.transaction
})

function request() {
  return new NextRequest("http://localhost/api/projects/project-1?workspaceId=workspace-1", { method: "DELETE" })
}

function mockWorkspace(role: "VIEWER" | "MEMBER") {
  process.env.PLANGLADE_AUTH_MODE = "dev"
  ;(db.user as typeof db.user).upsert = ((async () => ({ id: "member-1", email: "dev@planglade.local", name: "Dev User" })) as unknown) as typeof db.user.upsert
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({ id: "workspace-1", ownerId: "owner-1" })) as unknown) as typeof db.workspace.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({ userId: "member-1", role })) as unknown) as typeof db.workspaceMember.findUnique
}

test("project deletion rejects viewers before loading the project", async () => {
  mockWorkspace("VIEWER")
  let projectLoaded = false
  ;(db.project as typeof db.project).findUnique = ((async () => {
    projectLoaded = true
    return null
  }) as unknown) as typeof db.project.findUnique

  const response = await deleteProject(request(), { params: Promise.resolve({ projectId: "project-1" }) })

  assert.equal(response.status, 403)
  assert.equal(projectLoaded, false)
})

test("project deletion rejects a project outside the authorized workspace", async () => {
  mockWorkspace("MEMBER")
  ;(db.project as typeof db.project).findUnique = ((async () => ({ id: "project-1", workspaceId: "workspace-2", name: "Foreign project" })) as unknown) as typeof db.project.findUnique
  let transactionCalled = false
  ;(db as typeof db).$transaction = (async () => {
    transactionCalled = true
    throw new Error("mutation must not start")
  }) as typeof db.$transaction

  const response = await deleteProject(request(), { params: Promise.resolve({ projectId: "project-1" }) })

  assert.equal(response.status, 404)
  assert.equal(transactionCalled, false)
})

test("project updates validate a partial target date against the stored start date", async () => {
  mockWorkspace("MEMBER")
  ;(db.project as typeof db.project).findUnique = ((async () => ({
    id: "project-1",
    workspaceId: "workspace-1",
    name: "Launch",
    mode: "STANDARD",
    featureFlags: null,
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    dueDate: null,
  })) as unknown) as typeof db.project.findUnique
  let transactionCalled = false
  ;(db as typeof db).$transaction = (async () => {
    transactionCalled = true
    throw new Error("mutation must not start")
  }) as typeof db.$transaction

  const response = await updateProject(
    new NextRequest("http://localhost/api/projects/project-1?workspaceId=workspace-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dueDate: "2026-08-31T00:00:00.000Z" }),
    }),
    { params: Promise.resolve({ projectId: "project-1" }) }
  )

  assert.equal(response.status, 400)
  assert.equal(transactionCalled, false)
})
