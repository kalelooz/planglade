import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import { badRequest, parseJsonBody, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { DEFAULT_PRIORITY_DISPLAY_STYLE } from "@/lib/appearance-defaults"
import { onboardingWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

function slugifyWorkspaceName(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base.length >= 2 ? base.slice(0, 50) : "workspace"
}

async function resolveUniqueWorkspaceSlug(preferred: string) {
  const normalized = slugifyWorkspaceName(preferred)

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`
    const maxBaseLength = 50 - suffix.length
    const candidate = `${normalized.slice(0, maxBaseLength)}${suffix}`
    const exists = await db.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }

  return `${normalized.slice(0, 40)}-${Date.now().toString(36)}`.slice(0, 50)
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, onboardingWorkspaceSchema)
  if (!parsed.ok) return parsed.response

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    if (!actorUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const existingMembership = await db.workspaceMember.findFirst({
      where: { userId: actorUserId },
      select: {
        workspace: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    })
    if (existingMembership) {
      return NextResponse.json(
        {
          error: "User already belongs to a workspace",
          workspace: existingMembership.workspace,
        },
        { status: 409 }
      )
    }

    const slug = await resolveUniqueWorkspaceSlug(parsed.data.slug ?? parsed.data.name)
    const workspaceName = parsed.data.name.trim()

    const workspace = await db.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          slug,
          name: workspaceName,
          ownerId: actorUserId,
          taskPriorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          taskPriorityDisplayStyle: true,
        },
      })

      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id,
          userId: actorUserId,
          role: "OWNER",
        },
      })

      await logActivityEvent(tx, {
        workspaceId: created.id,
        actorId: actorUserId,
        action: "CREATED",
        entityType: "WORKSPACE",
        entityId: created.id,
        summary: `Created workspace ${created.name}`,
        metadata: {
          slug: created.slug,
        },
      })

      return created
    })

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error) {
    const message = String(error)
    if (message.includes("Unique constraint")) {
      return badRequest("Workspace slug already exists")
    }
    return serverError("Failed to create workspace onboarding", message)
  }
}
