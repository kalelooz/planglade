import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let mapRoute: typeof import("../src/app/api/map/route")
let mapService: typeof import("../src/lib/map-service")

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE

before(async () => {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  ;({ db } = await import("../src/lib/db"))
  mapRoute = await import("../src/app/api/map/route")
  mapService = await import("../src/lib/map-service")

  await db.user.createMany({
    data: [
      { id: "owner-a", email: "owner-a@example.test" },
      { id: "member-a", email: "member-a@example.test" },
      { id: "viewer-a", email: "viewer-a@example.test" },
      { id: "member-b", email: "member-b@example.test" },
    ],
  })
  await db.workspace.createMany({
    data: [
      { id: "workspace-a", slug: "workspace-a", name: "Workspace A", ownerId: "owner-a" },
      { id: "workspace-b", slug: "workspace-b", name: "Workspace B", ownerId: "member-b" },
    ],
  })
  await db.workspaceMember.createMany({
    data: [
      { id: "membership-owner-a", workspaceId: "workspace-a", userId: "owner-a", role: "OWNER" },
      { id: "membership-member-a", workspaceId: "workspace-a", userId: "member-a", role: "MEMBER" },
      { id: "membership-viewer-a", workspaceId: "workspace-a", userId: "viewer-a", role: "VIEWER" },
      { id: "membership-member-b", workspaceId: "workspace-b", userId: "member-b", role: "MEMBER" },
    ],
  })
  await db.project.createMany({
    data: [
      {
        id: "project-a",
        workspaceId: "workspace-a",
        name: "Project A",
        slug: "project-a",
        createdById: "owner-a",
      },
      {
        id: "project-b",
        workspaceId: "workspace-b",
        name: "Project B",
        slug: "project-b",
        createdById: "member-b",
      },
    ],
  })
  await db.workItem.createMany({
    data: [
      {
        id: "task-a",
        workspaceId: "workspace-a",
        projectId: "project-a",
        title: "Task A",
        createdById: "owner-a",
      },
      {
        id: "task-no-project",
        workspaceId: "workspace-a",
        title: "No project",
        createdById: "owner-a",
      },
      {
        id: "task-b",
        workspaceId: "workspace-b",
        projectId: "project-b",
        title: "Task B",
        createdById: "member-b",
      },
    ],
  })
})

after(async () => {
  process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

function request(
  method: "GET" | "PUT" | "PATCH",
  userId: string,
  body?: unknown,
  suffix = "",
) {
  return new NextRequest(
    `http://localhost/api/map?workspaceId=workspace-a${suffix}`,
    {
      method,
      headers: {
        "x-flowboard-user-id": userId,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  )
}

const sharedLayout = {
  schemaVersion: 1 as const,
  revision: 0,
  taskPlacements: [{ workItemId: "task-a", x: 42, y: 84 }],
  projectPlacements: [{ projectId: "project-a", x: 10, y: 20 }],
}

test("Map scope rejects cross-workspace projects", async () => {
  assert.equal(
    await mapService.resolveMapDescriptor({
      workspaceId: "workspace-a",
      projectId: "project-b",
    }),
    null,
  )
})

test("members save shared placements and stale revisions return MAP_LAYOUT_CONFLICT", async () => {
  const first = await mapRoute.PUT(request("PUT", "member-a", sharedLayout))
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), { revision: 1 })

  const state = await mapRoute.GET(request("GET", "member-a"))
  assert.equal(state.status, 200)
  const payload = (await state.json()) as {
    revision: number
    taskPlacements: unknown[]
    projectPlacements: unknown[]
  }
  assert.equal(payload.revision, 1)
  assert.deepEqual(payload.taskPlacements, [
    { workItemId: "task-a", sectionId: null, x: 42, y: 84 },
  ])
  assert.deepEqual(payload.projectPlacements, [
    { projectId: "project-a", x: 10, y: 20 },
  ])

  const stale = await mapRoute.PUT(request("PUT", "owner-a", sharedLayout))
  assert.equal(stale.status, 409)
  assert.deepEqual(await stale.json(), {
    error: "Map layout changed since it was loaded",
    code: "MAP_LAYOUT_CONFLICT",
    revision: 1,
  })
})

test("viewers read shared state and save only their own preferences", async () => {
  const denied = await mapRoute.PUT(
    request("PUT", "viewer-a", { ...sharedLayout, revision: 1 }),
  )
  assert.equal(denied.status, 403)

  const saved = await mapRoute.PATCH(
    request("PATCH", "viewer-a", {
      schemaVersion: 1,
      viewport: { x: 12, y: 34, zoom: 0.8 },
      statusFilter: "completed",
      trayOpen: true,
      collapsedProjectIds: ["project-a"],
      collapsedSectionIds: [],
    }),
  )
  assert.equal(saved.status, 200)

  const viewerState = await mapRoute.GET(request("GET", "viewer-a"))
  const viewerPayload = (await viewerState.json()) as {
    canEditSharedLayout: boolean
    preferences: unknown
  }
  assert.equal(viewerPayload.canEditSharedLayout, false)
  assert.deepEqual(viewerPayload.preferences, {
    viewport: { x: 12, y: 34, zoom: 0.8 },
    statusFilter: "completed",
    trayOpen: true,
    collapsedProjectIds: ["project-a"],
    collapsedSectionIds: [],
  })

  const memberState = await mapRoute.GET(request("GET", "member-a"))
  const memberPayload = (await memberState.json()) as { preferences: unknown }
  assert.deepEqual(memberPayload.preferences, {
    viewport: { x: 0, y: 0, zoom: 1 },
    statusFilter: "open",
    trayOpen: false,
    collapsedProjectIds: [],
    collapsedSectionIds: [],
  })
})

test("shared writes reject cross-workspace task IDs before role authorization", async () => {
  const response = await mapRoute.PUT(
    request("PUT", "viewer-a", {
      schemaVersion: 1,
      revision: 1,
      taskPlacements: [{ workItemId: "task-b", x: 0, y: 0 }],
    }),
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: "Task is outside the requested Map scope",
  })
})

test("project Map remains scope-locked and deletion cascades remove placements", async () => {
  const projectWrite = await mapRoute.PUT(
    request(
      "PUT",
      "owner-a",
      {
        schemaVersion: 1,
        revision: 0,
        taskPlacements: [{ workItemId: "task-no-project", x: 0, y: 0 }],
      },
      "&projectId=project-a",
    ),
  )
  assert.equal(projectWrite.status, 400)

  await db.workItem.delete({ where: { id: "task-a" } })
  const state = await mapRoute.GET(request("GET", "owner-a"))
  const payload = (await state.json()) as { taskPlacements: unknown[] }
  assert.deepEqual(payload.taskPlacements, [])

  await db.project.delete({ where: { id: "project-a" } })
  const workspaceState = await mapRoute.GET(request("GET", "owner-a"))
  const workspacePayload = (await workspaceState.json()) as {
    projectPlacements: unknown[]
    preferences: { collapsedProjectIds: string[] }
  }
  assert.deepEqual(workspacePayload.projectPlacements, [])
  assert.deepEqual(workspacePayload.preferences.collapsedProjectIds, [])
})
