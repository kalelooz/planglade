import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { POST as previewWorkspaceImport } from "../src/app/api/workspace/import-preview/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalProjectFindMany = db.project.findMany
const originalWorkItemFindMany = db.workItem.findMany
const originalNoteFindMany = db.note.findMany
const originalProjectDocFindMany = db.projectDoc.findMany
const originalTransaction = db.$transaction

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.project as typeof db.project).findMany = originalProjectFindMany
    ;(db.workItem as typeof db.workItem).findMany = originalWorkItemFindMany
    ;(db.note as typeof db.note).findMany = originalNoteFindMany
    ;(db.projectDoc as typeof db.projectDoc).findMany = originalProjectDocFindMany
    ;(db as unknown as { $transaction: unknown }).$transaction = originalTransaction
  }
}

function mockWorkspaceAccess(role: Role) {
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-1",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique

  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "actor-1",
    role,
  })) as unknown) as typeof db.workspaceMember.findUnique
}

function mockExistingWorkspaceRows() {
  ;(db.project as typeof db.project).findMany = ((async () => []) as unknown) as typeof db.project.findMany
  ;(db.workItem as typeof db.workItem).findMany = ((async () => []) as unknown) as typeof db.workItem.findMany
  ;(db.note as typeof db.note).findMany = ((async () => []) as unknown) as typeof db.note.findMany
  ;(db.projectDoc as typeof db.projectDoc).findMany = ((async () => []) as unknown) as typeof db.projectDoc.findMany
}

function previewRequest(body: unknown, userId = "actor-1") {
  return new NextRequest("http://localhost/api/workspace/import-preview?workspaceId=workspace-1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-flowboard-user-id": userId,
    },
    body: JSON.stringify(body),
  })
}

test("POST /workspace/import-preview rejects unauthenticated preview", async () => {
  await runWithMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "workspace-1",
      ownerId: "owner-1",
    })) as unknown) as typeof db.workspace.findUnique

    let duplicateLookupCalled = false
    ;(db.project as typeof db.project).findMany = ((async () => {
      duplicateLookupCalled = true
      return []
    }) as unknown) as typeof db.project.findMany

    const request = new NextRequest("http://localhost/api/workspace/import-preview?workspaceId=workspace-1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, data: { projects: [], workItems: [], notes: [], projectDocs: [] } }),
    })

    const response = await previewWorkspaceImport(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 403)
    assert.equal(payload.error, "You do not have access to this workspace")
    assert.equal(duplicateLookupCalled, false)
  })
})

test("POST /workspace/import-preview rejects invalid payload with a safe error", async () => {
  await runWithMocks(async () => {
    const request = previewRequest({ version: 1 })
    const response = await previewWorkspaceImport(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 400)
    assert.equal(payload.error, "Request body validation failed")
  })
})

test("POST /workspace/import-preview rejects malformed JSON with a safe error", async () => {
  await runWithMocks(async () => {
    const request = new NextRequest("http://localhost/api/workspace/import-preview?workspaceId=workspace-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: "{",
    })

    const response = await previewWorkspaceImport(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 400)
    assert.equal(payload.error, "Request body must be valid JSON")
  })
})

test("POST /workspace/import-preview returns counts including Project Docs and archived warnings", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")
    mockExistingWorkspaceRows()

    const response = await previewWorkspaceImport(
      previewRequest({
        version: 1,
        generatedAt: "2026-06-07T10:00:00.000Z",
        workspace: { id: "source-workspace", slug: "source", name: "Source Workspace" },
        settings: { userId: "source-user", theme: "dark" },
        data: {
          projects: [{ id: "project-1", name: "Launch", status: "ACTIVE" }],
          workItems: [{ id: "task-1", title: "Ship preview", status: "TODO", priority: "HIGH", project: "project-1" }],
          notes: [{ id: "note-1", title: "Prep", body: "Notes" }],
          projectDocs: [
            {
              id: "doc-1",
              project: "project-1",
              title: "Launch runbook",
              status: "ARCHIVED",
              archivedAt: "2026-06-06T10:00:00.000Z",
            },
          ],
        },
      })
    )
    const payload = (await response.json()) as {
      counts?: { projects?: number; tasks?: number; notes?: number; projectDocs?: number; archivedProjectDocs?: number }
      warnings?: Array<{ code: string; count?: number }>
      writes?: boolean
    }

    assert.equal(response.status, 200)
    assert.deepEqual(payload.counts, {
      projects: 1,
      tasks: 1,
      notes: 1,
      projectDocs: 1,
      settings: 1,
      archivedProjectDocs: 1,
    })
    assert.deepEqual(payload.warnings?.find((warning) => warning.code === "archived_project_docs"), {
      code: "archived_project_docs",
      message: "Archived Project Docs are included in this import file.",
      count: 1,
    })
    assert.equal(payload.writes, false)
  })
})

test("POST /workspace/import-preview warns about missing project references", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")
    mockExistingWorkspaceRows()

    const response = await previewWorkspaceImport(
      previewRequest({
        version: 1,
        data: {
          projects: [],
          workItems: [{ id: "task-1", title: "Unlinked task", status: "TODO", priority: "MEDIUM", project: "missing" }],
          notes: [],
          projectDocs: [{ id: "doc-1", project: "missing", title: "Unlinked doc", status: "ACTIVE" }],
        },
      })
    )
    const payload = (await response.json()) as {
      relationIssues?: { tasksMissingProjects?: number; projectDocsMissingProjects?: number }
      warnings?: Array<{ code: string; count?: number }>
    }

    assert.equal(response.status, 200)
    assert.equal(payload.relationIssues?.tasksMissingProjects, 1)
    assert.equal(payload.relationIssues?.projectDocsMissingProjects, 1)
    assert.equal(payload.warnings?.some((warning) => warning.code === "work_items_missing_projects"), true)
    assert.equal(payload.warnings?.some((warning) => warning.code === "project_docs_missing_projects"), true)
  })
})

test("POST /workspace/import-preview ignores spoofed workspace and user ids", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")
    mockExistingWorkspaceRows()

    const response = await previewWorkspaceImport(
      previewRequest({
        version: 1,
        workspace: { id: "evil-workspace", slug: "evil", name: "Imported Name" },
        settings: { userId: "evil-user", theme: "dark" },
        data: { projects: [], workItems: [], notes: [], projectDocs: [] },
      })
    )
    const payload = (await response.json()) as {
      workspaceId?: string
      source?: { workspaceName?: string; workspaceSlug?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.workspaceId, "workspace-1")
    assert.deepEqual(payload.source, {
      version: 1,
      generatedAt: null,
      workspaceName: "Imported Name",
      workspaceSlug: "evil",
    })
  })
})

test("POST /workspace/import-preview uses read-only duplicate checks and never writes", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")

    let transactionCalled = false
    ;(db as unknown as { $transaction: unknown }).$transaction = (async () => {
      transactionCalled = true
    }) as unknown as typeof db.$transaction

    ;(db.project as typeof db.project).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown; select: unknown }).where, { workspaceId: "workspace-1" })
      assert.deepEqual((args as { where: unknown; select: unknown }).select, { name: true })
      return [{ name: "Launch" }]
    }) as unknown) as typeof db.project.findMany
    ;(db.workItem as typeof db.workItem).findMany = ((async () => [{ title: "Ship preview" }]) as unknown) as typeof db.workItem.findMany
    ;(db.note as typeof db.note).findMany = ((async () => [{ title: "Prep" }]) as unknown) as typeof db.note.findMany
    ;(db.projectDoc as typeof db.projectDoc).findMany = ((async () => [{ title: "Launch runbook" }]) as unknown) as typeof db.projectDoc.findMany

    const response = await previewWorkspaceImport(
      previewRequest({
        version: 1,
        data: {
          projects: [{ id: "project-1", name: "Launch", status: "ACTIVE" }],
          workItems: [{ id: "task-1", title: "Ship preview", status: "TODO", priority: "MEDIUM" }],
          notes: [{ id: "note-1", title: "Prep" }],
          projectDocs: [{ id: "doc-1", title: "Launch runbook", status: "ACTIVE" }],
        },
      })
    )
    const payload = (await response.json()) as {
      duplicateCandidates?: { projects?: number; tasks?: number; notes?: number; projectDocs?: number }
      warnings?: Array<{ code: string; message: string; count?: number }>
      writes?: boolean
    }

    assert.equal(response.status, 200)
    assert.deepEqual(payload.duplicateCandidates, {
      projects: 1,
      tasks: 1,
      notes: 1,
      projectDocs: 1,
    })
    assert.equal(payload.warnings?.some((warning) => warning.code === "duplicate_project_docs"), true)
    assert.equal(
      payload.warnings?.some((warning) =>
        warning.code === "duplicate_tasks" && /simple title matching/.test(warning.message)
      ),
      true
    )
    assert.equal(payload.writes, false)
    assert.equal(transactionCalled, false)
  })
})

test("POST /workspace/import-preview warns about unsupported export version", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")
    mockExistingWorkspaceRows()

    const response = await previewWorkspaceImport(
      previewRequest({
        version: 999,
        data: { projects: [], workItems: [], notes: [], projectDocs: [] },
      })
    )
    const payload = (await response.json()) as { warnings?: Array<{ code: string }> }

    assert.equal(response.status, 200)
    assert.equal(payload.warnings?.some((warning) => warning.code === "unsupported_export_version"), true)
  })
})
