import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { PATCH as updateWorkItem } from "../src/app/api/work-items/[workItemId]/route"
import { createWorkItemSchema, updateWorkItemSchema } from "../src/lib/contracts"
import { db } from "../src/lib/db"

const originalEnv = {
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE,
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
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

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
        "x-planglade-user-id": "user-1",
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
  assert.equal(parsed.isInbox, false)
})

test("task placement reindexes the workspace-wide destination status across projects", async () => {
  await runWithUpdateRouteMocks(async () => {
    const positionUpdates: Array<{ id: string; position: number }> = []
    let siblingWhere: Record<string, unknown> | undefined
    let statusPatch: Record<string, unknown> | undefined

    ;(db.workItem as typeof db.workItem).findUnique = ((async ({ where }: { where: { id: string } }) => {
      if (where.id === "task-2") {
        return { id: "task-2", workspaceId: "workspace-1", projectId: "project-2", status: "TODO" }
      }
      return {
        id: "task-1",
        workspaceId: "workspace-1",
        title: "Original title",
        status: "IN_PROGRESS",
        assigneeId: "user-2",
        projectId: "project-1",
        parentId: null,
        position: 1024,
      }
    }) as unknown) as typeof db.workItem.findUnique

    ;(db as unknown as { $transaction: unknown }).$transaction = (async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workItem: {
          update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            if (args.data.status) statusPatch = args.data
            if (typeof args.data.position === "number") {
              positionUpdates.push({ id: args.where.id, position: args.data.position })
            }
            return {
              id: "task-1",
              title: "Original title",
              assigneeId: "user-2",
              projectId: "project-1",
              updatedAt: new Date("2026-07-31T00:00:00.000Z"),
            }
          },
          findMany: async (args: { where: Record<string, unknown> }) => {
            siblingWhere = args.where
            return [{ id: "task-2" }, { id: "task-3" }, { id: "task-1" }]
          },
          findUnique: async () => ({
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Original title",
            status: "TODO",
            priority: "MEDIUM",
            projectId: "project-1",
            dueDate: null,
            startDate: null,
            description: null,
            assigneeId: "user-2",
            parentId: null,
            position: 1024,
            labels: [],
          }),
        },
        project: { findUnique: async () => ({ featureFlags: {} }) },
        workItemLabel: { deleteMany: async () => ({}), createMany: async () => ({}) },
        activityEvent: { create: async () => ({}) },
        notification: { create: async () => ({}), upsert: async () => ({}) },
      }
      return callback(tx)
    }) as unknown as typeof db.$transaction

    const response = await updateWorkItem(new NextRequest("http://localhost/api/work-items/task-1?workspaceId=workspace-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-planglade-user-id": "user-1" },
      body: JSON.stringify({ status: "TODO", beforeId: "task-2" }),
    }), { params: Promise.resolve({ workItemId: "task-1" }) })

    assert.equal(response.status, 200)
    assert.deepEqual(statusPatch, { status: "TODO", isInbox: false })
    assert.deepEqual(siblingWhere, { workspaceId: "workspace-1", status: "TODO" })
    assert.deepEqual(positionUpdates, [
      { id: "task-1", position: 1024 },
      { id: "task-2", position: 2048 },
      { id: "task-3", position: 3072 },
    ])
  })
})
