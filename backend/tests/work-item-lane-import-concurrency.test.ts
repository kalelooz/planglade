import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

test("an import and reorder cannot silently share one lane version", async () => {
  const isolated = createIsolatedTestDatabase()
  const previousAuthMode = process.env.PLANGLADE_AUTH_MODE
  const previousPublicAuthMode = process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"
  const { PrismaClient } = await import("@prisma/client")
  const { db } = await import("../src/lib/db")
  const { POST: importWorkspace } = await import("../src/app/api/workspace/import-local/route")
  const { buildWorkspaceImportPlan } = await import("../src/lib/workspace-import-plan")
  const {
    claimWorkItemLaneVersions,
    runSerializableWorkItemTransaction,
    StaleWorkItemLaneMutationError,
  } = await import("../src/lib/work-item-lane-versions")
  const inspectingClient = new PrismaClient()
  const reorderingClient = new PrismaClient()

  try {
    await inspectingClient.user.create({
      data: {
        id: "user-1",
        email: "alex.morgan@planglade.dev",
        normalizedEmail: "alex.morgan@planglade.dev",
      },
    })
    await inspectingClient.workspace.create({
      data: {
        id: "workspace-1",
        slug: "workspace-1",
        name: "Workspace",
        ownerId: "user-1",
        memberships: { create: { userId: "user-1", role: "OWNER" } },
      },
    })
    for (const [index, id] of ["task-1", "task-2", "task-3"].entries()) {
      await inspectingClient.workItem.create({
        data: {
          id,
          workspaceId: "workspace-1",
          title: id,
          status: "TODO",
          position: (index + 1) * 1024,
          createdById: "user-1",
        },
      })
    }

    const snapshot = {
      version: 2,
      data: {
        projects: [],
        workItems: [{ id: "imported-task", title: "Imported task", status: "TODO", priority: "MEDIUM" }],
        notes: [],
        projectDocs: [],
        savedViews: [],
      },
    }
    const expectedSourceChecksum = buildWorkspaceImportPlan(snapshot).contract.sourceChecksum
    const importRequest = new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace-1", mode: "append", expectedSourceChecksum, snapshot }),
    })

    const [importResult, reorderResult] = await Promise.allSettled([
      importWorkspace(importRequest),
      runSerializableWorkItemTransaction(reorderingClient, async (tx) => {
        await claimWorkItemLaneVersions(tx, "workspace-1", { TODO: 0 })
        const ids = (await tx.workItem.findMany({
          where: { workspaceId: "workspace-1", status: "TODO", isInbox: false },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        })).map((item) => item.id)
        const moved = ids.filter((id) => id !== "task-3")
        moved.unshift("task-3")
        for (const [index, id] of moved.entries()) {
          await tx.workItem.update({ where: { id }, data: { position: (index + 1) * 1024 } })
        }
      }),
    ])

    assert.equal(importResult.status, "fulfilled")
    if (importResult.status === "fulfilled") assert.equal(importResult.value.status, 201)
    if (reorderResult.status === "rejected") {
      assert.ok(reorderResult.reason instanceof StaleWorkItemLaneMutationError)
    }
    assert.equal(await inspectingClient.workItem.count({ where: { title: "Imported task" } }), 1)
    const lane = await inspectingClient.workItemLaneVersion.findUniqueOrThrow({
      where: { workspaceId_status: { workspaceId: "workspace-1", status: "TODO" } },
    })
    assert.equal(lane.version, reorderResult.status === "fulfilled" ? 2 : 1)
  } finally {
    await Promise.allSettled([db.$disconnect(), inspectingClient.$disconnect(), reorderingClient.$disconnect()])
    if (previousAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
    else process.env.PLANGLADE_AUTH_MODE = previousAuthMode
    if (previousPublicAuthMode === undefined) delete process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
    else process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = previousPublicAuthMode
    await isolated.cleanup()
  }
})
