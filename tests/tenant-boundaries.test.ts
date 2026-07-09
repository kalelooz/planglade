import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { GET as listLabels } from "../src/app/api/labels/route"
import { GET as listSavedViews, POST as createSavedView } from "../src/app/api/saved-views/route"
import { PATCH as updateWorkItem } from "../src/app/api/work-items/[workItemId]/route"
import { POST as createWorkItem } from "../src/app/api/work-items/route"
import { db } from "../src/lib/db"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originals = {
  workspaceFindUnique: db.workspace.findUnique,
  memberFindUnique: db.workspaceMember.findUnique,
  labelFindMany: db.label.findMany,
  labelCount: db.label.count,
  savedViewFindMany: db.savedView.findMany,
  savedViewCreate: db.savedView.create,
  projectFindFirst: db.project.findFirst,
  workItemFindUnique: db.workItem.findUnique,
  transaction: db.$transaction,
}

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "ws-1",
    ownerId: "owner-1",
  })) as unknown) as typeof db.workspace.findUnique

  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originals.workspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originals.memberFindUnique
    ;(db.label as typeof db.label).findMany = originals.labelFindMany
    ;(db.label as typeof db.label).count = originals.labelCount
    ;(db.savedView as typeof db.savedView).findMany = originals.savedViewFindMany
    ;(db.savedView as typeof db.savedView).create = originals.savedViewCreate
    ;(db.project as typeof db.project).findFirst = originals.projectFindFirst
    ;(db.workItem as typeof db.workItem).findUnique = originals.workItemFindUnique
    ;(db as typeof db).$transaction = originals.transaction
  }
}

function allowViewer(userId = "viewer-1") {
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId,
    role: "VIEWER",
  })) as unknown) as typeof db.workspaceMember.findUnique
}

test("labels GET rejects anonymous callers before loading data", async () => {
  await runWithMocks(async () => {
    let loaded = false
    ;(db.label as typeof db.label).findMany = ((async () => {
      loaded = true
      return []
    }) as unknown) as typeof db.label.findMany

    const response = await listLabels(
      new NextRequest("http://localhost/api/labels?workspaceId=ws-1")
    )

    assert.equal(response.status, 403)
    assert.equal(loaded, false)
  })
})

test("labels GET allows a workspace viewer", async () => {
  await runWithMocks(async () => {
    allowViewer()
    ;(db.label as typeof db.label).findMany = ((async () => []) as unknown) as typeof db.label.findMany

    const response = await listLabels(
      new NextRequest("http://localhost/api/labels?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "viewer-1" },
      })
    )

    assert.equal(response.status, 200)
  })
})

test("labels GET rejects an authenticated non-member", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => null) as unknown) as typeof db.workspaceMember.findUnique
    const response = await listLabels(
      new NextRequest("http://localhost/api/labels?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "outsider-1" },
      })
    )
    assert.equal(response.status, 403)
  })
})

test("saved views GET rejects a non-member before loading data", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => null) as unknown) as typeof db.workspaceMember.findUnique
    let loaded = false
    ;(db.savedView as typeof db.savedView).findMany = ((async () => {
      loaded = true
      return []
    }) as unknown) as typeof db.savedView.findMany

    const response = await listSavedViews(
      new NextRequest("http://localhost/api/saved-views?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "outsider-1" },
      })
    )

    assert.equal(response.status, 403)
    assert.equal(loaded, false)
  })
})

test("saved views GET allows a workspace viewer", async () => {
  await runWithMocks(async () => {
    allowViewer()
    ;(db.savedView as typeof db.savedView).findMany = ((async () => []) as unknown) as typeof db.savedView.findMany

    const response = await listSavedViews(
      new NextRequest("http://localhost/api/saved-views?workspaceId=ws-1", {
        headers: { "x-flowboard-user-id": "viewer-1" },
      })
    )

    assert.equal(response.status, 200)
  })
})

test("saved views GET rejects anonymous callers", async () => {
  await runWithMocks(async () => {
    const response = await listSavedViews(
      new NextRequest("http://localhost/api/saved-views?workspaceId=ws-1")
    )
    assert.equal(response.status, 403)
  })
})

test("work-item creation rejects mixed same-workspace and foreign labels", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.label as typeof db.label).count = ((async () => 1) as unknown) as typeof db.label.count

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("mutation must not start")
    }) as typeof db.$transaction

    const response = await createWorkItem(
      new NextRequest("http://localhost/api/work-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          title: "Task",
          labelIds: ["local-label", "foreign-label"],
        }),
      })
    )

    assert.equal(response.status, 400)
    assert.equal(transactionCalled, false)
  })
})

test("failed work-item label update preserves existing relations", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.label as typeof db.label).count = ((async () => 0) as unknown) as typeof db.label.count
    ;(db.workItem as typeof db.workItem).findUnique = ((async () => ({
      id: "task-1",
      workspaceId: "ws-1",
      title: "Task",
      status: "TODO",
      assigneeId: null,
      projectId: null,
      parentId: null,
    })) as unknown) as typeof db.workItem.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("existing labels must not be deleted")
    }) as typeof db.$transaction

    const response = await updateWorkItem(
      new NextRequest("http://localhost/api/work-items/task-1?workspaceId=ws-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({ labelIds: ["foreign-label"] }),
      }),
      { params: Promise.resolve({ workItemId: "task-1" }) }
    )

    assert.equal(response.status, 400)
    assert.equal(transactionCalled, false)
  })
})

test("valid label IDs are deduplicated before join writes", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.label as typeof db.label).count = ((async () => 1) as unknown) as typeof db.label.count

    let joined: Array<{ workItemId: string; labelId: string }> = []
    ;(db as typeof db).$transaction = (async (callback: unknown) => {
      const tx = {
        workItem: {
          create: async () => ({
            id: "task-1",
            title: "Task",
            status: "BACKLOG",
            priority: "MEDIUM",
            projectId: null,
            assigneeId: null,
          }),
          findUnique: async () => ({ id: "task-1", labels: [] }),
        },
        workItemLabel: {
          createMany: async (args: { data: typeof joined }) => {
            joined = args.data
            return { count: args.data.length }
          },
        },
        activityEvent: { create: async () => ({}) },
      }
      return (callback as (client: typeof tx) => Promise<unknown>)(tx)
    }) as typeof db.$transaction

    const response = await createWorkItem(
      new NextRequest("http://localhost/api/work-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          title: "Task",
          labelIds: ["label-1", "label-1"],
        }),
      })
    )

    assert.equal(response.status, 201)
    assert.deepEqual(joined, [{ workItemId: "task-1", labelId: "label-1" }])
  })
})

test("saved-view creation rejects a foreign project reference", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.project as typeof db.project).findFirst = ((async () => null) as unknown) as typeof db.project.findFirst

    let createCalled = false
    ;(db.savedView as typeof db.savedView).create = ((async () => {
      createCalled = true
      return {} as never
    }) as unknown) as typeof db.savedView.create

    const response = await createSavedView(
      new NextRequest("http://localhost/api/saved-views", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          projectId: "foreign-project",
          name: "View",
          layout: "list",
        }),
      })
    )

    assert.equal(response.status, 400)
    assert.equal(createCalled, false)
  })
})

test("work-item creation rejects a foreign project reference", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "member-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique
    ;(db.project as typeof db.project).findFirst = ((async () => null) as unknown) as typeof db.project.findFirst

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("mutation must not start")
    }) as typeof db.$transaction

    const response = await createWorkItem(
      new NextRequest("http://localhost/api/work-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({
          workspaceId: "ws-1",
          projectId: "foreign-project",
          title: "Task",
        }),
      })
    )

    assert.equal(response.status, 400)
    assert.equal(transactionCalled, false)
  })
})

test("work-item update rejects an assignee outside the workspace", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async (args: unknown) => {
      const userId = (args as { where: { workspaceId_userId: { userId: string } } }).where
        .workspaceId_userId.userId
      return userId === "member-1" ? ({ userId: "member-1", role: "MEMBER" } as never) : null
    }) as unknown) as typeof db.workspaceMember.findUnique

    let transactionCalled = false
    ;(db as typeof db).$transaction = (async () => {
      transactionCalled = true
      throw new Error("mutation must not start")
    }) as typeof db.$transaction

    const response = await updateWorkItem(
      new NextRequest("http://localhost/api/work-items/task-1?workspaceId=ws-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "member-1",
        },
        body: JSON.stringify({ assigneeId: "outsider-1" }),
      }),
      { params: Promise.resolve({ workItemId: "task-1" }) }
    )

    assert.equal(response.status, 400)
    assert.equal(transactionCalled, false)
  })
})
