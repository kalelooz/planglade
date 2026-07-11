import { NextResponse } from "next/server"

import { getAuthConfigErrors } from "@/lib/auth-config"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { readPlanGladeEnv } from "@/lib/env-config"
import { resolveVerifiedApplicationUser } from "@/lib/local-auth-identity"
import { getVerifiedNextAuthUser } from "@/lib/local-auth-session"

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
    const authConfig = getAuthConfigErrors()
    if (authConfig.mode === "invalid") {
      return NextResponse.json({ error: authConfig.errors[0] ?? "Invalid PLANGLADE_AUTH_MODE." }, { status: 500 })
    }
    if (authConfig.errors.length > 0) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Authentication is not available." }
          : { error: authConfig.errors[0], errors: authConfig.errors },
        { status: 500 }
      )
    }

    const requestedMode = authConfig.mode
    const nextAuthEnabled = getProviderCapabilities().anyConfigured
    if (requestedMode === "nextauth" && !nextAuthEnabled) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Cloud login is not available yet." }
          : { error: "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider." },
        { status: process.env.NODE_ENV === "production" ? 401 : 500 }
      )
    }

    const { db } = await import("@/lib/db")
    const { DEFAULT_PRIORITY_DISPLAY_STYLE, resolvePriorityDisplayStyle } = await import(
      "@/lib/appearance-defaults"
    )
    let user: { id: string; email: string; name: string | null }
    let authMode = "dev-session-scaffold"

    if (requestedMode === "firebase") {
      const tokenFromHeader = request.headers.get("authorization")
      const tokenFromCustomHeader = request.headers.get("x-flowboard-firebase-id-token")
      const authToken = tokenFromHeader?.startsWith("Bearer ")
        ? tokenFromHeader.slice("Bearer ".length).trim()
        : tokenFromCustomHeader?.trim() || null
      if (!authToken) return NextResponse.json({ error: "No Firebase ID token provided" }, { status: 401 })

      const { verifyFirebaseIdToken } = await import("@/lib/firebase-admin")
      const verified = await verifyFirebaseIdToken(authToken)
      const resolved = await resolveVerifiedApplicationUser({
        email: verified.email,
        name: verified.name ?? verified.email.split("@")[0],
      })
      if (!resolved) return NextResponse.json({ error: "No authenticated session" }, { status: 401 })
      user = resolved
      authMode = "firebase"
    } else if (requestedMode === "nextauth") {
      const resolved = await getVerifiedNextAuthUser()
      if (!resolved) return NextResponse.json({ error: "No authenticated session" }, { status: 401 })
      user = resolved
      authMode = "nextauth"
    } else {
      const resolved = await resolveVerifiedApplicationUser(DEV_USER)
      if (!resolved) return NextResponse.json({ error: "Failed to resolve development identity" }, { status: 500 })
      user = resolved
    }

    let workspace: { id: string; slug: string; name: string; taskPriorityDisplayStyle: string } | null = null
    if (authMode === "dev-session-scaffold") {
      const workspaceSlug = readPlanGladeEnv("WORKSPACE_SLUG") ?? DEV_WORKSPACE.slug
      const workspaceName = readPlanGladeEnv("WORKSPACE_NAME") ?? DEV_WORKSPACE.name
      workspace = await db.workspace.upsert({
        where: { slug: workspaceSlug },
        update: { name: workspaceName, ownerId: user.id },
        create: {
          slug: workspaceSlug,
          name: workspaceName,
          ownerId: user.id,
          taskPriorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE,
        },
        select: { id: true, slug: true, name: true, taskPriorityDisplayStyle: true },
      })
      await db.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: { role: "OWNER" },
        create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
      })
    } else {
      const firstMembership = await db.workspaceMember.findFirst({
        where: { userId: user.id },
        include: {
          workspace: { select: { id: true, slug: true, name: true, taskPriorityDisplayStyle: true } },
        },
        orderBy: { joinedAt: "asc" },
      })
      if (!firstMembership) {
        return NextResponse.json({ error: "Onboarding required", code: "ONBOARDING_REQUIRED" }, { status: 409 })
      }
      workspace = firstMembership.workspace
    }

    if (!workspace) return NextResponse.json({ error: "Failed to resolve workspace session scope" }, { status: 500 })
    const members = await db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    })
    return NextResponse.json({
      user,
      workspace: {
        ...workspace,
        taskPriorityDisplayStyle: resolvePriorityDisplayStyle(workspace.taskPriorityDisplayStyle),
      },
      members: members.map((member) => ({
        id: member.user.id,
        name: member.user.name ?? member.user.email,
        email: member.user.email,
        role: member.role,
      })),
      authMode,
    })
  } catch (error) {
    console.error("Failed to resolve session", error)
    return NextResponse.json(
      process.env.NODE_ENV === "production"
        ? { error: "Failed to resolve session" }
        : { error: "Failed to resolve session", details: String(error) },
      { status: 500 }
    )
  }
}
