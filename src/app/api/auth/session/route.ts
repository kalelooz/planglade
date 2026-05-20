import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions, hasAuthProviders } from "@/lib/auth-options"
import { db } from "@/lib/db"

const DEV_USER = {
  email: "alex.morgan@flowboard.dev",
  name: "Alex Morgan",
}

const DEV_WORKSPACE = {
  slug: "flowboard",
  name: "FlowBoard Workspace",
}

export async function GET() {
  try {
    const requestedMode = process.env.FLOWBOARD_AUTH_MODE?.toLowerCase()
    const nextAuthEnabled = hasAuthProviders()
    const shouldUseNextAuth = requestedMode === "nextauth" && nextAuthEnabled

    let userIdentity = DEV_USER
    let authMode = "dev-session-scaffold"

    if (shouldUseNextAuth) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "No authenticated session" },
          { status: 401 }
        )
      }
      userIdentity = {
        email: session.user.email,
        name: session.user.name ?? session.user.email.split("@")[0],
      }
      authMode = "nextauth"
    }

    const user = await db.user.upsert({
      where: { email: userIdentity.email },
      update: { name: userIdentity.name },
      create: {
        email: userIdentity.email,
        name: userIdentity.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

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
