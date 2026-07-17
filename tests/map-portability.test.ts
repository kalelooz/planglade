import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let exportWorkspace: typeof import("../src/app/api/workspace/export/route").GET
let importWorkspace: typeof import("../src/app/api/workspace/import-local/route").POST
const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE

before(async () => {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  ;({ db } = await import("../src/lib/db"))
  ;({ GET: exportWorkspace } = await import("../src/app/api/workspace/export/route"))
  ;({ POST: importWorkspace } = await import("../src/app/api/workspace/import-local/route"))

  await db.user.create({
    data: { id: "portable-owner", email: "portable-owner@example.test" },
  })
  await db.workspace.createMany({
    data: [
      {
        id: "portable-source",
        slug: "portable-source",
        name: "Portable source",
        ownerId: "portable-owner",
      },
      {
        id: "portable-target",
        slug: "portable-target",
        name: "Portable target",
        ownerId: "portable-owner",
      },
    ],
  })
  await db.workspaceMember.createMany({
    data: [
      {
        id: "portable-source-member",
        workspaceId: "portable-source",
        userId: "portable-owner",
        role: "OWNER",
      },
      {
        id: "portable-target-member",
        workspaceId: "portable-target",
        userId: "portable-owner",
        role: "OWNER",
      },
    ],
  })
  await db.project.create({
    data: {
      id: "portable-project",
      workspaceId: "portable-source",
      name: "Portable project",
      slug: "portable-project",
      createdById: "portable-owner",
    },
  })
  await db.workItem.create({
    data: {
      id: "portable-task",
      workspaceId: "portable-source",
      projectId: "portable-project",
      title: "Portable task",
      createdById: "portable-owner",
    },
  })
  const scope = await db.mapScope.create({
    data: {
      id: "portable-scope",
      workspaceId: "portable-source",
      scopeType: "WORKSPACE",
      scopeKey: "workspace",
      schemaVersion: 1,
      revision: 4,
    },
  })
  await db.mapSection.create({
    data: {
      id: "portable-section",
      mapScopeId: scope.id,
      name: "Now",
      sortOrder: 0,
      x: 0,
      y: 0,
      width: 600,
      height: 400,
    },
  })
  await db.mapTaskPlacement.create({
    data: {
      mapScopeId: scope.id,
      workItemId: "portable-task",
      sectionId: "portable-section",
      x: 12,
      y: 24,
    },
  })
  await db.mapProjectPlacement.create({
    data: {
      mapScopeId: scope.id,
      containerKey: "project:portable-project",
      projectId: "portable-project",
      x: 48,
      y: 96,
    },
  })
  await db.mapPreference.create({
    data: {
      mapScopeId: scope.id,
      userId: "portable-owner",
      viewportX: 100,
      viewportY: 200,
      viewportZoom: 0.75,
    },
  })
})

after(async () => {
  process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

function authHeaders() {
  return { "x-flowboard-user-id": "portable-owner" }
}

test("workspace export/import remaps shared Map IDs and preserves revision integrity", async () => {
  const exported = await exportWorkspace(
    new NextRequest(
      "http://localhost/api/workspace/export?workspaceId=portable-source",
      { headers: authHeaders() },
    ),
  )
  assert.equal(exported.status, 200)
  const snapshot = (await exported.json()) as {
    data: {
      projects: unknown[]
      workItems: unknown[]
      notes: unknown[]
      projectDocs: unknown[]
      mapLayouts: Array<{
        schemaVersion: number
        revision: number
        taskPlacements: Array<{ workItemId: string; sectionId: string | null }>
      }>
    }
  }
  assert.equal(snapshot.data.mapLayouts.length, 1)
  assert.equal(snapshot.data.mapLayouts[0]?.revision, 4)
  assert.equal(JSON.stringify(snapshot).includes("viewportX"), false)

  const imported = await importWorkspace(
    new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "portable-target",
        mode: "replace",
        ...snapshot.data,
      }),
    }),
  )
  assert.equal(imported.status, 201)

  const targetScope = await db.mapScope.findUnique({
    where: {
      workspaceId_scopeKey: {
        workspaceId: "portable-target",
        scopeKey: "workspace",
      },
    },
    include: {
      sections: true,
      taskPlacements: true,
      projectPlacements: true,
      preferences: true,
    },
  })
  assert.equal(targetScope?.revision, 4)
  assert.equal(targetScope?.schemaVersion, 1)
  assert.equal(targetScope?.sections.length, 1)
  assert.equal(targetScope?.taskPlacements.length, 1)
  assert.equal(targetScope?.projectPlacements.length, 1)
  assert.equal(targetScope?.preferences.length, 0)
  assert.notEqual(targetScope?.taskPlacements[0]?.workItemId, "portable-task")
  assert.notEqual(targetScope?.projectPlacements[0]?.projectId, "portable-project")
  assert.equal(
    targetScope?.taskPlacements[0]?.sectionId,
    targetScope?.sections[0]?.id,
  )

  const importedTask = await db.workItem.findUnique({
    where: { id: targetScope?.taskPlacements[0]?.workItemId },
    select: { workspaceId: true, projectId: true },
  })
  assert.equal(importedTask?.workspaceId, "portable-target")
  assert.equal(importedTask?.projectId, targetScope?.projectPlacements[0]?.projectId)
})

test("workspace import fails safely on future Map schema versions", async () => {
  const response = await importWorkspace(
    new NextRequest("http://localhost/api/workspace/import-local", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "portable-target",
        mode: "append",
        mapLayouts: [
          {
            schemaVersion: 2,
            scopeType: "WORKSPACE",
            revision: 0,
            taskPlacements: [],
            projectPlacements: [],
            sections: [],
          },
        ],
      }),
    }),
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "Unsupported Map schema version" })
})
