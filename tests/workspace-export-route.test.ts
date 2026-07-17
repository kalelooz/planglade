import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { GET as exportWorkspace } from "../src/app/api/workspace/export/route"
import { POST as importWorkspace } from "../src/app/api/workspace/import-local/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalProjectFindMany = db.project.findMany
const originalWorkItemFindMany = db.workItem.findMany
const originalNoteFindMany = db.note.findMany
const originalLabelFindMany = db.label.findMany
const originalProjectDocFindMany = db.projectDoc.findMany
const originalUserSettingsFindUnique = db.userSettings.findUnique
const originalTransaction = db.$transaction
const originalThrottleDeleteMany = db.authThrottle.deleteMany
const originalQueryRaw = db.$queryRaw

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  ;(db.authThrottle as typeof db.authThrottle).deleteMany = (async () => ({ count: 0 })) as typeof db.authThrottle.deleteMany
  ;(db as unknown as { $queryRaw: unknown }).$queryRaw = (async () => [{ blockedUntil: null }]) as typeof db.$queryRaw
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.project as typeof db.project).findMany = originalProjectFindMany
    ;(db.workItem as typeof db.workItem).findMany = originalWorkItemFindMany
    ;(db.note as typeof db.note).findMany = originalNoteFindMany
    ;(db.label as typeof db.label).findMany = originalLabelFindMany
    ;(db.projectDoc as typeof db.projectDoc).findMany = originalProjectDocFindMany
    ;(db.userSettings as typeof db.userSettings).findUnique = originalUserSettingsFindUnique
    ;(db as unknown as { $transaction: unknown }).$transaction = originalTransaction
    ;(db.authThrottle as typeof db.authThrottle).deleteMany = originalThrottleDeleteMany
    ;(db as unknown as { $queryRaw: unknown }).$queryRaw = originalQueryRaw
  }
}

function mockWorkspaceAccess(role: Role) {
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-1",
    ownerId: "owner-1",
    slug: "acme",
    name: "Acme",
    taskPriorityDisplayStyle: "text",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  })) as unknown) as typeof db.workspace.findUnique

  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "actor-1",
    role,
  })) as unknown) as typeof db.workspaceMember.findUnique
}

function mockEmptyWorkspaceExport() {
  ;(db.project as typeof db.project).findMany = ((async () => []) as unknown) as typeof db.project.findMany
  ;(db.workItem as typeof db.workItem).findMany = ((async () => []) as unknown) as typeof db.workItem.findMany
  ;(db.note as typeof db.note).findMany = ((async () => []) as unknown) as typeof db.note.findMany
  ;(db.label as typeof db.label).findMany = ((async () => []) as unknown) as typeof db.label.findMany
  ;(db.projectDoc as typeof db.projectDoc).findMany = ((async () => []) as unknown) as typeof db.projectDoc.findMany
  ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => null) as unknown) as typeof db.userSettings.findUnique
}

function mockTransaction(tx: unknown) {
  ;(db as unknown as { $transaction: unknown }).$transaction = (async <T>(
    fn: (transactionClient: unknown) => Promise<T>
  ) => fn(tx)) as typeof db.$transaction
}

test("GET /workspace/export denies unauthenticated requests", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    mockEmptyWorkspaceExport()

    const request = new NextRequest("http://localhost/api/workspace/export?workspaceId=workspace-1")

    const response = await exportWorkspace(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Authentication required")
  })
})

test("GET /workspace/export ignores client userId and does not export user settings", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")

    mockEmptyWorkspaceExport()
    let settingsLoaded = false
    ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => {
      settingsLoaded = true
      return {
        userId: "other-1",
        theme: "dark",
        density: "compact",
        accent: "blue",
        notifications: null,
      }
    }) as unknown) as typeof db.userSettings.findUnique

    const request = new NextRequest(
      "http://localhost/api/workspace/export?workspaceId=workspace-1&userId=other-1",
      {
        headers: { "x-flowboard-user-id": "actor-1" },
      }
    )

    const response = await exportWorkspace(request)
    const payload = (await response.json()) as {
      settings?: unknown
      workspace?: { id?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(settingsLoaded, false)
    assert.equal(payload.workspace?.id, "workspace-1")
    assert.equal(payload.settings, undefined)
  })
})

test("GET /workspace/export is workspace scoped and includes expected safe data", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    const createdAt = new Date("2026-06-10T08:00:00.000Z")
    const updatedAt = new Date("2026-06-10T09:00:00.000Z")

    ;(db.project as typeof db.project).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown }).where, { workspaceId: "workspace-1" })
      return [
        {
          id: "project-1",
          workspaceId: "workspace-1",
          name: "Launch",
          slug: "launch",
          description: "Ship it",
          status: "ACTIVE",
          mode: "STANDARD",
          featureFlags: { comments: true },
          color: "zinc",
          startDate: null,
          dueDate: new Date("2026-06-30T00:00:00.000Z"),
          archivedAt: null,
          createdAt,
          updatedAt,
          oauthToken: "do-not-export",
        },
      ]
    }) as unknown) as typeof db.project.findMany

    ;(db.workItem as typeof db.workItem).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown }).where, { workspaceId: "workspace-1" })
      return [
        {
          id: "task-1",
          workspaceId: "workspace-1",
          title: "Draft launch plan",
          description: "Plan",
          checklist: [{ id: "check-1", text: "Review", done: false }],
          noteIds: ["note-1"],
          status: "TODO",
          priority: "HIGH",
          startDate: null,
          dueDate: new Date("2026-06-20T00:00:00.000Z"),
          completedAt: null,
          sortOrder: 1,
          position: 1,
          projectId: "project-1",
          assigneeId: "actor-1",
          parentId: null,
          createdAt,
          updatedAt,
          sessionToken: "do-not-export",
          labels: [
            {
              labelId: "label-1",
              createdAt,
              label: { id: "label-1", name: "Planning", color: "zinc" },
            },
          ],
        },
        {
          id: "inbox-1",
          workspaceId: "workspace-1",
          title: "Captured idea",
          description: null,
          checklist: null,
          noteIds: null,
          status: "BACKLOG",
          priority: "MEDIUM",
          startDate: null,
          dueDate: null,
          completedAt: null,
          sortOrder: 2,
          position: 2,
          projectId: null,
          assigneeId: null,
          parentId: null,
          createdAt,
          updatedAt,
          password: "do-not-export",
          labels: [],
        },
      ]
    }) as unknown) as typeof db.workItem.findMany

    ;(db.note as typeof db.note).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown }).where, {
        workspaceId: "workspace-1",
        OR: [
          { visibility: "WORKSPACE" },
          { visibility: "PRIVATE", createdById: "actor-1" },
        ],
      })
      return [
        {
          id: "note-1",
          workspaceId: "workspace-1",
          projectId: "project-1",
          title: "Launch context",
          body: "Notes are the project context surface.",
          visibility: "WORKSPACE",
          pinned: true,
          tags: ["launch"],
          createdAt,
          updatedAt,
          refreshToken: "do-not-export",
        },
      ]
    }) as unknown) as typeof db.note.findMany

    ;(db.label as typeof db.label).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown }).where, { workspaceId: "workspace-1" })
      return [
        {
          id: "label-1",
          workspaceId: "workspace-1",
          name: "Planning",
          color: "zinc",
          createdAt,
          updatedAt,
          authSecret: "do-not-export",
        },
      ]
    }) as unknown) as typeof db.label.findMany
    ;(db.projectDoc as typeof db.projectDoc).findMany = ((async () => []) as unknown) as typeof db.projectDoc.findMany

    const request = new NextRequest("http://localhost/api/workspace/export?workspaceId=workspace-1", {
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await exportWorkspace(request)
    const payload = (await response.json()) as {
      exportedAt?: string
      workspace?: { id?: string; slug?: string; name?: string }
      projects?: Array<{ id: string; workspaceId?: string }>
      tasks?: Array<{ id: string; labelIds?: string[] }>
      inboxItems?: Array<{ id: string }>
      notes?: Array<{ id: string; body?: string }>
      labels?: Array<{ id: string }>
      taskLabels?: Array<{ taskId: string; labelId: string }>
      data?: { workItems?: Array<{ id: string }> }
      counts?: { tasks?: number; inboxItems?: number; labels?: number; taskLabels?: number }
    }
    const serialized = JSON.stringify(payload)

    assert.equal(response.status, 200)
    assert.match(payload.exportedAt ?? "", /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(payload.workspace?.id, "workspace-1")
    assert.equal(payload.workspace?.slug, "acme")
    assert.equal(payload.projects?.[0].id, "project-1")
    assert.equal(payload.projects?.[0].workspaceId, undefined)
    assert.equal(payload.tasks?.[0].id, "task-1")
    assert.deepEqual(payload.tasks?.[0].labelIds, ["label-1"])
    assert.equal(payload.inboxItems?.[0].id, "inbox-1")
    assert.equal(payload.notes?.[0].body, "Notes are the project context surface.")
    assert.equal(payload.labels?.[0].id, "label-1")
    assert.deepEqual(payload.taskLabels?.[0], {
      taskId: "task-1",
      labelId: "label-1",
      createdAt: "2026-06-10T08:00:00.000Z",
    })
    assert.equal(payload.data?.workItems?.length, 2)
    assert.equal(payload.counts?.tasks, 1)
    assert.equal(payload.counts?.inboxItems, 1)
    assert.equal(payload.counts?.labels, 1)
    assert.equal(payload.counts?.taskLabels, 1)
    assert.doesNotMatch(serialized, /password|token|secret|session|oauth/i)
  })
})

test("GET /workspace/export includes legacy project docs and archived state", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("MEMBER")
    mockEmptyWorkspaceExport()

    const archivedAt = new Date("2026-06-06T10:00:00.000Z")
    ;(db.projectDoc as typeof db.projectDoc).findMany = ((async (args: unknown) => {
      assert.deepEqual((args as { where: unknown }).where, { workspaceId: "workspace-1" })
      return [
        {
          id: "doc-1",
          workspaceId: "workspace-1",
          projectId: "project-1",
          title: "Launch runbook",
          body: "Steps",
          status: "ARCHIVED",
          archivedAt,
          createdById: "actor-1",
          updatedById: "actor-1",
          createdAt: new Date("2026-06-06T09:00:00.000Z"),
          updatedAt: archivedAt,
        },
      ]
    }) as unknown) as typeof db.projectDoc.findMany

    const request = new NextRequest("http://localhost/api/workspace/export?workspaceId=workspace-1", {
      headers: { "x-flowboard-user-id": "actor-1" },
    })

    const response = await exportWorkspace(request)
    const payload = (await response.json()) as {
      legacyDocs?: Array<{
        id: string
        projectId?: string
        title: string
        body: string
        status: string
        archivedAt?: string
      }>
      data?: {
        projectDocs?: Array<{
          id: string
          project?: string
          title: string
          body: string
          status: string
          archivedAt?: string
        }>
      }
      counts?: { legacyDocs?: number; projectDocs?: number }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.counts?.legacyDocs, 1)
    assert.equal(payload.counts?.projectDocs, 1)
    assert.deepEqual(payload.legacyDocs?.[0], {
      id: "doc-1",
      projectId: "project-1",
      title: "Launch runbook",
      body: "Steps",
      status: "ARCHIVED",
      archivedAt: "2026-06-06T10:00:00.000Z",
      createdAt: "2026-06-06T09:00:00.000Z",
      updatedAt: "2026-06-06T10:00:00.000Z",
    })
    assert.deepEqual(payload.data?.projectDocs?.[0], {
      id: "doc-1",
      project: "project-1",
      title: "Launch runbook",
      body: "Steps",
      status: "ARCHIVED",
      archivedAt: "2026-06-06T10:00:00.000Z",
    })
  })
})

test("POST /workspace/import-local creates project docs with imported project association", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")

    let createdDocData: unknown
    mockTransaction({
      workspaceMember: { findMany: async () => [{ userId: "actor-1" }] },
      project: {
        upsert: async () => ({ id: "project-real-1" }),
      },
      workItem: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      note: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      projectDoc: {
        findFirst: async () => null,
        create: async (args: unknown) => {
          createdDocData = (args as { data: unknown }).data
          return { id: "doc-real-1" }
        },
        deleteMany: async () => ({}),
      },
    })

    const request = new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        projects: [{ id: "project-import-1", name: "Launch", status: "ACTIVE" }],
        projectDocs: [
          {
            id: "doc-import-1",
            project: "project-import-1",
            title: "Launch runbook",
            body: "Steps",
            status: "ACTIVE",
          },
        ],
      }),
    })

    const response = await importWorkspace(request)
    const payload = (await response.json()) as {
      imported?: { projectDocs?: number }
      warnings?: { projectDocsMissingProjects?: number }
    }

    assert.equal(response.status, 201)
    assert.equal(payload.imported?.projectDocs, 1)
    assert.equal(payload.warnings?.projectDocsMissingProjects, 0)
    assert.deepEqual(createdDocData, {
      workspaceId: "workspace-1",
      projectId: "project-real-1",
      title: "Launch runbook",
      body: "Steps",
      status: "ACTIVE",
      archivedAt: undefined,
      createdById: "actor-1",
      updatedById: "actor-1",
    })
  })
})

test("POST /workspace/import-local imports archived docs and handles missing project links safely", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")

    const createdDocs: unknown[] = []
    mockTransaction({
      workspaceMember: { findMany: async () => [{ userId: "actor-1" }] },
      project: {
        upsert: async () => ({ id: "project-real-1" }),
      },
      workItem: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      note: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      projectDoc: {
        findFirst: async () => null,
        create: async (args: unknown) => {
          createdDocs.push((args as { data: unknown }).data)
          return { id: `doc-real-${createdDocs.length}` }
        },
        deleteMany: async () => ({}),
      },
    })

    const request = new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        projectDocs: [
          {
            id: "doc-import-1",
            project: "missing-project",
            title: "Old runbook",
            body: "Archive",
            status: "ARCHIVED",
            archivedAt: "2026-06-06T10:00:00.000Z",
          },
        ],
      }),
    })

    const response = await importWorkspace(request)
    const payload = (await response.json()) as {
      imported?: { projectDocs?: number }
      warnings?: { projectDocsMissingProjects?: number }
    }
    const createdDoc = createdDocs[0] as { projectId?: string; status?: string; archivedAt?: Date }

    assert.equal(response.status, 201)
    assert.equal(payload.imported?.projectDocs, 1)
    assert.equal(payload.warnings?.projectDocsMissingProjects, 1)
    assert.equal(createdDoc.projectId, undefined)
    assert.equal(createdDoc.status, "ARCHIVED")
    assert.equal(createdDoc.archivedAt?.toISOString(), "2026-06-06T10:00:00.000Z")
  })
})

test("POST /workspace/import-local ignores spoofed project doc workspace and user fields", async () => {
  await runWithMocks(async () => {
    mockWorkspaceAccess("ADMIN")

    let createdDocData: Record<string, unknown> | undefined
    mockTransaction({
      workspaceMember: { findMany: async () => [{ userId: "actor-1" }] },
      project: {
        upsert: async () => ({ id: "project-real-1" }),
      },
      workItem: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      note: {
        findFirst: async () => null,
        create: async () => ({}),
        deleteMany: async () => ({}),
      },
      projectDoc: {
        findFirst: async () => null,
        create: async (args: unknown) => {
          createdDocData = (args as { data: Record<string, unknown> }).data
          return { id: "doc-real-1" }
        },
        deleteMany: async () => ({}),
      },
    })

    const request = new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        projectDocs: [
          {
            id: "doc-import-1",
            workspaceId: "workspace-evil",
            createdById: "user-evil",
            updatedById: "user-evil",
            title: "Spoof attempt",
            status: "ACTIVE",
          },
        ],
      }),
    })

    const response = await importWorkspace(request)

    assert.equal(response.status, 201)
    assert.equal(createdDocData?.workspaceId, "workspace-1")
    assert.equal(createdDocData?.createdById, "actor-1")
    assert.equal(createdDocData?.updatedById, "actor-1")
  })
})
