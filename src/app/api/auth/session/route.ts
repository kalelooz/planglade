import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { resolveAuthenticatedUser } from "@/lib/permissions/session"

const DEV_WORKSPACE = {
  slug: "planglade",
  name: "PlanGlade Workspace",
}

export async function GET(request: Request) {
  try {
    const session = await resolveAuthenticatedUser(request)
    if (!session.ok) {
      return NextResponse.json(
        { error: session.message, details: session.details },
        { status: session.status }
      )
    }

    const { user, authMode } = session

    const workspace = await db.workspace.upsert({
      where: { slug: process.env.FLOWBOARD_WORKSPACE_SLUG ?? DEV_WORKSPACE.slug },
      update: {
        name: process.env.FLOWBOARD_WORKSPACE_NAME ?? DEV_WORKSPACE.name,
        ownerId: user.id,
      },
      create: {
        slug: process.env.FLOWBOARD_WORKSPACE_SLUG ?? DEV_WORKSPACE.slug,
        name: process.env.FLOWBOARD_WORKSPACE_NAME ?? DEV_WORKSPACE.name,
        ownerId: user.id,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })

    await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
    })

    const members = await db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    })

    return NextResponse.json({
      user,
      workspace,
      members: members.map((member) => ({
        id: member.user.id,
        name: member.user.name ?? member.user.email,
        email: member.user.email,
        role: member.role,
      })),
      authMode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to resolve session", details: String(error) },
      { status: 500 }
    )
  }
}
