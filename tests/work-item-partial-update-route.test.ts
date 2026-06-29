import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { PATCH as updateWorkItem } from "../src/app/api/work-items/[workItemId]/route"
import { createWorkItemSchema, updateWorkItemSchema } from "../src/lib/contracts"
import { db } from "../src/lib/db"

const originalEnv = {
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE,
}

const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalWorkItemFindUnique = db.workItem.findUnique
const originalTransaction = db.$transaction

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function runWithUpdateRouteMocks(fn: () => Promise<void>) {
  restoreEnv()
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "dev"

  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-1",
    ownerId: "user-1",
  })) as unknown) as typeof db.workspace.findUnique

  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "user-1",
    role: "MEMBER",
  })) as unknown) as typeof db.workspaceMember.findUnique

  ;(db.workItem as typeof db.workItem).findUnique = ((async () => ({
    id: "task-1",
    workspaceId: "workspace-1",
    title: "Original title",
    status: "IN_PROGRESS",
    assigneeId: "user-2",
    projectId: "project-1",
    parentId: null,
  })) as unknown) as typeof db.workItem.findUnique

  try {
    await fn()
  } finally {
    restoreEnv()
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.workItem as typeof db.workItem).findUnique = originalWorkItemFindUnique
    ;(db as unknown as { $transaction: unknown }).$transaction = originalTransaction
  }
}

test("TASK-UPDATE-PARTIAL-PATCH-001: title-only update sends only title to the database", async () => {
  await runWithUpdateRouteMocks(async () => {
    let updateData: Record<string, unknown> | undefined

    ;(db as unknown as { $transaction: unknown }).$transaction = (async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workItem: {
          update: async (args: { data: Record<string, unknown> }) => {
            updateData = args.data
            return {
              id: "task-1",
              projectId: "project-1",
              updatedAt: new Date("2026-06-29T10:00:00.000Z"),
            }
          },
          findUnique: async () => ({
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Renamed title",
            status: "IN_PROGRESS",
            priority: "HIGH",
            projectId: "project-1",
            dueDate: new Date("2026-07-15T00:00:00.000Z"),
            startDate: new Date("2026-07-01T00:00:00.000Z"),
            description: "Keep this description",
            assigneeId: "user-2",
            parentId: null,
            labels: [],
          }),
        },
        project: {
          findUnique: async () => ({ featureFlags: {} }),
        },
        workItemLabel: {
          deleteMany: async () => ({}),
          createMany: async () => ({}),
        },
        activityEvent: {
          create: async () => ({}),
        },
        notification: {
          create: async () => ({}),
          upsert: async () => ({}),
        },
      }

      return callback(tx)
    }) as unknown as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/work-items/task-1?workspaceId=workspace-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "user-1",
      },
      body: JSON.stringify({ title: "Renamed title" }),
    })

    const response = await updateWorkItem(request, {
      params: Promise.resolve({ workItemId: "task-1" }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(updateData, { title: "Renamed title" })
    assert.ok(!("status" in updateData!), "title-only updates must preserve status")
    assert.ok(!("priority" in updateData!), "title-only updates must preserve priority")
    assert.ok(!("projectId" in updateData!), "title-only updates must preserve project")
    assert.ok(!("dueDate" in updateData!), "title-only updates must preserve due date")
    assert.ok(!("startDate" in updateData!), "title-only updates must preserve start date")
    assert.ok(!("description" in updateData!), "title-only updates must preserve description")
    assert.ok(!("assigneeId" in updateData!), "title-only updates must preserve assignee")
  })
})

test("TASK-UPDATE-PARTIAL-PATCH-001: update schema has no create defaults", () => {
  const parsed = updateWorkItemSchema.parse({ title: "Renamed title" })

  assert.deepEqual(parsed, { title: "Renamed title" })
})

test("TASK-UPDATE-PARTIAL-PATCH-001: create schema still applies intended task defaults", () => {
  const parsed = createWorkItemSchema.parse({
    workspaceId: "workspace-1",
    title: "New task",
  })

  assert.equal(parsed.status, "BACKLOG")
  assert.equal(parsed.priority, "MEDIUM")
})
