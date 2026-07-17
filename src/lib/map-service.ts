import type { Prisma, WorkspaceRole } from "@prisma/client"

import { db } from "@/lib/db"
import {
  MAP_SCHEMA_VERSION,
  type MapQuery,
  type SaveMapPreferencesInput,
  type SaveMapSharedLayoutInput,
} from "@/lib/map-contracts"

export class MapLayoutConflictError extends Error {
  constructor(readonly revision: number) {
    super("Map layout changed")
  }
}

export class MapReferenceError extends Error {}

export function canEditSharedMap(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER"
}

export async function resolveMapDescriptor(query: MapQuery) {
  if (query.projectId) {
    const project = await db.project.findFirst({
      where: { id: query.projectId, workspaceId: query.workspaceId },
      select: { id: true },
    })
    if (!project) return null
    return {
      scopeType: "PROJECT" as const,
      scopeKey: `project:${project.id}`,
      projectId: project.id,
    }
  }

  return {
    scopeType: "WORKSPACE" as const,
    scopeKey: "workspace",
    projectId: null,
  }
}

type MapDescriptor = NonNullable<Awaited<ReturnType<typeof resolveMapDescriptor>>>

function emptyPreferences() {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    statusFilter: "open",
    trayOpen: false,
    collapsedProjectIds: [] as string[],
    collapsedSectionIds: [] as string[],
  }
}

export async function readMapState(input: {
  workspaceId: string
  actorUserId: string
  actorRole: WorkspaceRole
  descriptor: MapDescriptor
}) {
  const scope = await db.mapScope.findUnique({
    where: {
      workspaceId_scopeKey: {
        workspaceId: input.workspaceId,
        scopeKey: input.descriptor.scopeKey,
      },
    },
    include: {
      taskPlacements: { orderBy: { workItemId: "asc" } },
      projectPlacements: { orderBy: { containerKey: "asc" } },
      sections: { orderBy: { sortOrder: "asc" } },
      preferences: {
        where: { userId: input.actorUserId },
        include: {
          collapsedProjects: { orderBy: { projectId: "asc" } },
          collapsedSections: { orderBy: { sectionId: "asc" } },
        },
      },
    },
  })

  const preference = scope?.preferences[0]
  return {
    schemaVersion: MAP_SCHEMA_VERSION,
    scope: {
      type: input.descriptor.scopeType,
      projectId: input.descriptor.projectId,
    },
    revision: scope?.revision ?? 0,
    canEditSharedLayout: canEditSharedMap(input.actorRole),
    taskPlacements:
      scope?.taskPlacements.map(({ workItemId, sectionId, x, y }) => ({
        workItemId,
        sectionId,
        x,
        y,
      })) ?? [],
    projectPlacements:
      scope?.projectPlacements.map(({ projectId, x, y }) => ({
        projectId,
        x,
        y,
      })) ?? [],
    sections:
      scope?.sections.map(({ id, name, sortOrder, x, y, width, height, color }) => ({
        id,
        name,
        sortOrder,
        x,
        y,
        width,
        height,
        color,
      })) ?? [],
    preferences: preference
      ? {
          viewport: {
            x: preference.viewportX,
            y: preference.viewportY,
            zoom: preference.viewportZoom,
          },
          statusFilter: preference.statusFilter,
          trayOpen: preference.trayOpen,
          collapsedProjectIds: preference.collapsedProjects.map(({ projectId }) => projectId),
          collapsedSectionIds: preference.collapsedSections.map(({ sectionId }) => sectionId),
        }
      : emptyPreferences(),
  }
}

export async function validateSharedMapReferences(input: {
  workspaceId: string
  descriptor: MapDescriptor
  layout: SaveMapSharedLayoutInput
}) {
  const taskIds = input.layout.taskPlacements?.map(({ workItemId }) => workItemId) ?? []
  if (taskIds.length > 0) {
    const count = await db.workItem.count({
      where: {
        id: { in: taskIds },
        workspaceId: input.workspaceId,
        ...(input.descriptor.projectId ? { projectId: input.descriptor.projectId } : {}),
      },
    })
    if (count !== taskIds.length) throw new MapReferenceError("Task is outside the requested Map scope")
  }

  const projectIds =
    input.layout.projectPlacements
      ?.map(({ projectId }) => projectId)
      .filter((projectId): projectId is string => Boolean(projectId)) ?? []
  if (projectIds.length > 0) {
    const count = await db.project.count({
      where: {
        id: { in: projectIds },
        workspaceId: input.workspaceId,
        ...(input.descriptor.projectId ? { id: input.descriptor.projectId } : {}),
      },
    })
    if (count !== projectIds.length) throw new MapReferenceError("Project is outside the requested Map scope")
  }

  const referencedSectionIds = new Set(
    input.layout.taskPlacements
      ?.map(({ sectionId }) => sectionId)
      .filter((sectionId): sectionId is string => Boolean(sectionId)) ?? [],
  )
  if (referencedSectionIds.size === 0) return

  if (input.layout.sections) {
    const suppliedSectionIds = new Set(input.layout.sections.map(({ id }) => id))
    if ([...referencedSectionIds].some((id) => !suppliedSectionIds.has(id))) {
      throw new MapReferenceError("Section is outside the requested Map scope")
    }
    return
  }

  const scope = await db.mapScope.findUnique({
    where: {
      workspaceId_scopeKey: {
        workspaceId: input.workspaceId,
        scopeKey: input.descriptor.scopeKey,
      },
    },
    select: { id: true },
  })
  const count = scope
    ? await db.mapSection.count({
        where: { id: { in: [...referencedSectionIds] }, mapScopeId: scope.id },
      })
    : 0
  if (count !== referencedSectionIds.size) {
    throw new MapReferenceError("Section is outside the requested Map scope")
  }
}

async function ensureScope(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  descriptor: MapDescriptor,
) {
  return tx.mapScope.upsert({
    where: { workspaceId_scopeKey: { workspaceId, scopeKey: descriptor.scopeKey } },
    update: {},
    create: {
      workspaceId,
      scopeType: descriptor.scopeType,
      scopeKey: descriptor.scopeKey,
      projectId: descriptor.projectId,
      schemaVersion: MAP_SCHEMA_VERSION,
    },
    select: { id: true, revision: true },
  })
}

export async function saveSharedMapLayout(input: {
  workspaceId: string
  descriptor: MapDescriptor
  layout: SaveMapSharedLayoutInput
}) {
  return db.$transaction(async (tx) => {
    const scope = await ensureScope(tx, input.workspaceId, input.descriptor)
    const advanced = await tx.mapScope.updateMany({
      where: { id: scope.id, revision: input.layout.revision },
      data: {
        revision: { increment: 1 },
        schemaVersion: MAP_SCHEMA_VERSION,
      },
    })
    if (advanced.count !== 1) {
      const current = await tx.mapScope.findUnique({
        where: { id: scope.id },
        select: { revision: true },
      })
      throw new MapLayoutConflictError(current?.revision ?? scope.revision)
    }

    if (input.layout.sections) {
      await tx.mapSection.deleteMany({ where: { mapScopeId: scope.id } })
      if (input.layout.sections.length > 0) {
        await tx.mapSection.createMany({
          data: input.layout.sections.map((section) => ({
            id: section.id,
            mapScopeId: scope.id,
            name: section.name,
            sortOrder: section.sortOrder,
            x: section.x,
            y: section.y,
            width: section.width,
            height: section.height,
            color: section.color,
          })),
        })
      }
    }

    for (const placement of input.layout.projectPlacements ?? []) {
      const containerKey = placement.projectId ? `project:${placement.projectId}` : "no-project"
      await tx.mapProjectPlacement.upsert({
        where: {
          mapScopeId_containerKey: {
            mapScopeId: scope.id,
            containerKey,
          },
        },
        update: { x: placement.x, y: placement.y },
        create: { mapScopeId: scope.id, containerKey, ...placement },
      })
    }

    for (const placement of input.layout.taskPlacements ?? []) {
      await tx.mapTaskPlacement.upsert({
        where: {
          mapScopeId_workItemId: {
            mapScopeId: scope.id,
            workItemId: placement.workItemId,
          },
        },
        update: {
          x: placement.x,
          y: placement.y,
          sectionId: placement.sectionId ?? null,
        },
        create: {
          mapScopeId: scope.id,
          workItemId: placement.workItemId,
          x: placement.x,
          y: placement.y,
          sectionId: placement.sectionId ?? null,
        },
      })
    }

    return { revision: input.layout.revision + 1 }
  })
}

export async function validatePreferenceReferences(input: {
  workspaceId: string
  descriptor: MapDescriptor
  preferences: SaveMapPreferencesInput
}) {
  if (input.preferences.collapsedProjectIds.length > 0) {
    const count = await db.project.count({
      where: {
        id: { in: input.preferences.collapsedProjectIds },
        workspaceId: input.workspaceId,
        ...(input.descriptor.projectId ? { id: input.descriptor.projectId } : {}),
      },
    })
    if (count !== input.preferences.collapsedProjectIds.length) {
      throw new MapReferenceError("Collapsed project is outside the requested Map scope")
    }
  }

  if (input.preferences.collapsedSectionIds.length === 0) return
  const scope = await db.mapScope.findUnique({
    where: {
      workspaceId_scopeKey: {
        workspaceId: input.workspaceId,
        scopeKey: input.descriptor.scopeKey,
      },
    },
    select: { id: true },
  })
  const count = scope
    ? await db.mapSection.count({
        where: {
          id: { in: input.preferences.collapsedSectionIds },
          mapScopeId: scope.id,
        },
      })
    : 0
  if (count !== input.preferences.collapsedSectionIds.length) {
    throw new MapReferenceError("Collapsed section is outside the requested Map scope")
  }
}

export async function saveMapPreferences(input: {
  workspaceId: string
  actorUserId: string
  descriptor: MapDescriptor
  preferences: SaveMapPreferencesInput
}) {
  await db.$transaction(async (tx) => {
    const scope = await ensureScope(tx, input.workspaceId, input.descriptor)
    const preference = await tx.mapPreference.upsert({
      where: {
        mapScopeId_userId: {
          mapScopeId: scope.id,
          userId: input.actorUserId,
        },
      },
      update: {
        viewportX: input.preferences.viewport.x,
        viewportY: input.preferences.viewport.y,
        viewportZoom: input.preferences.viewport.zoom,
        statusFilter: input.preferences.statusFilter,
        trayOpen: input.preferences.trayOpen,
      },
      create: {
        mapScopeId: scope.id,
        userId: input.actorUserId,
        viewportX: input.preferences.viewport.x,
        viewportY: input.preferences.viewport.y,
        viewportZoom: input.preferences.viewport.zoom,
        statusFilter: input.preferences.statusFilter,
        trayOpen: input.preferences.trayOpen,
      },
      select: { id: true },
    })

    await tx.mapCollapsedProject.deleteMany({ where: { preferenceId: preference.id } })
    await tx.mapCollapsedSection.deleteMany({ where: { preferenceId: preference.id } })
    if (input.preferences.collapsedProjectIds.length > 0) {
      await tx.mapCollapsedProject.createMany({
        data: input.preferences.collapsedProjectIds.map((projectId) => ({
          preferenceId: preference.id,
          projectId,
        })),
      })
    }
    if (input.preferences.collapsedSectionIds.length > 0) {
      await tx.mapCollapsedSection.createMany({
        data: input.preferences.collapsedSectionIds.map((sectionId) => ({
          preferenceId: preference.id,
          sectionId,
        })),
      })
    }
  })
}
