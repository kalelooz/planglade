import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions, hasAuthProviders } from "@/lib/auth-options"
import { getAuthConfigErrors } from "@/lib/auth-config"
import { db } from "@/lib/db"
import { readPlanGladeEnv } from "@/lib/env-config"
import { verifyFirebaseIdToken } from "@/lib/firebase-admin"
import { DEFAULT_PRIORITY_DISPLAY_STYLE, resolvePriorityDisplayStyle } from "@/lib/appearance-defaults"

const DEV_USER = {
  email: "alex.morgan@flowboard.dev",
  name: "Alex Morgan",
}

const DEV_WORKSPACE = {
  slug: "planglade",
  name: "PlanGlade Workspace",
}

export async function GET(request: Request) {
  try {
    const authConfig = getAuthConfigErrors({ includeProductionDevBlock: true })
    if (authConfig.mode === "invalid") {
      return NextResponse.json(
        {
          error: authConfig.errors[0] ?? "Invalid PLANGLADE_AUTH_MODE.",
        },
        { status: 500 }
      )
    }

    const blockingConfigErrors = authConfig.errors
    if (blockingConfigErrors.length > 0) {
      return NextResponse.json(
        {
          error: blockingConfigErrors[0],
          errors: blockingConfigErrors,
        },
        { status: 500 }
      )
    }

    const requestedMode = authConfig.mode

    const useFirebaseAuth = requestedMode === "firebase"
    const nextAuthEnabled = hasAuthProviders()
    const shouldUseNextAuth = requestedMode === "nextauth" && nextAuthEnabled

    if (requestedMode === "nextauth" && !nextAuthEnabled) {
      return NextResponse.json(
        {
          error:
            "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider (Google or GitHub).",
        },
        { status: 500 }
      )
    }

    let userIdentity = DEV_USER
    let authMode = "dev-session-scaffold"

    if (useFirebaseAuth) {
      const tokenFromHeader = request.headers.get("authorization")
      const tokenFromCustomHeader = request.headers.get("x-flowboard-firebase-id-token")
      const authToken =
        tokenFromHeader?.startsWith("Bearer ")
          ? tokenFromHeader.slice("Bearer ".length).trim()
          : tokenFromCustomHeader?.trim() || null
      if (!authToken) {
        return NextResponse.json(
          { error: "No Firebase ID token provided" },
          { status: 401 }
        )
      }

      const verified = await verifyFirebaseIdToken(authToken)
      userIdentity = {
        email: verified.email,
        name: verified.name ?? verified.email.split("@")[0],
      }
      authMode = "firebase"
    } else if (shouldUseNextAuth) {
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

    let workspace: { id: string; slug: string; name: string; taskPriorityDisplayStyle: string } | null = null

    if (authMode === "dev-session-scaffold") {
      const workspaceSlug = readPlanGladeEnv("WORKSPACE_SLUG") ?? DEV_WORKSPACE.slug
      const workspaceName = readPlanGladeEnv("WORKSPACE_NAME") ?? DEV_WORKSPACE.name
      const devWorkspace = await db.workspace.upsert({
        where: { slug: workspaceSlug },
        update: {
          name: workspaceName,
          ownerId: user.id,
        },
        create: {
          slug: workspaceSlug,
          name: workspaceName,
          ownerId: user.id,
          taskPriorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          taskPriorityDisplayStyle: true,
        },
      })
      workspace = devWorkspace

      await db.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: devWorkspace.id,
            userId: user.id,
          },
        },
        update: { role: "OWNER" },
        create: {
          workspaceId: devWorkspace.id,
          userId: user.id,
          role: "OWNER",
        },
      })
    } else {
      const firstMembership = await db.workspaceMember.findFirst({
        where: { userId: user.id },
        include: {
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
              taskPriorityDisplayStyle: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      })

      if (!firstMembership) {
        return NextResponse.json(
          {
            error: "Onboarding required",
            code: "ONBOARDING_REQUIRED",
          },
          { status: 409 }
        )
      }

      workspace = firstMembership.workspace
    }

    if (!workspace) {
      return NextResponse.json(
        { error: "Failed to resolve workspace session scope" },
        { status: 500 }
      )
    }

    const members = await db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    })

    const workspacePayload = {
      ...workspace,
      taskPriorityDisplayStyle: resolvePriorityDisplayStyle(workspace.taskPriorityDisplayStyle),
    }

    return NextResponse.json({
      user,
      workspace: workspacePayload,
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
