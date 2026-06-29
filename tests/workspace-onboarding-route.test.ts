import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { POST as createOnboardingWorkspace } from "../src/app/api/workspace/onboarding/route"

const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalMembershipFindFirst = db.workspaceMember.findFirst
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalTransaction = db.$transaction

async function runWithMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspaceMember as typeof db.workspaceMember).findFirst = originalMembershipFindFirst
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db as typeof db).$transaction = originalTransaction
  }
}

test("POST /workspace/onboarding creates workspace for first-time user", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findFirst = ((async () => null) as unknown) as typeof db.workspaceMember.findFirst
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => null) as unknown) as typeof db.workspace.findUnique

    let createdWorkspaceData: Record<string, unknown> | undefined
    ;(db as typeof db).$transaction = (async (callback: unknown) => {
      const tx = {
        workspace: {
          create: async (args: unknown) => {
            createdWorkspaceData = (args as { data: Record<string, unknown> }).data
            return {
              id: "ws-1",
              slug: "acme-team",
              name: "Acme Team",
              taskPriorityDisplayStyle: createdWorkspaceData.taskPriorityDisplayStyle,
            }
          },
        },
        workspaceMember: {
          create: async () => ({
            id: "wm-1",
          }),
        },
        activityEvent: {
          create: async () => ({}),
        },
      }
      return (callback as (client: typeof tx) => Promise<unknown>)(tx)
    }) as typeof db.$transaction

    const request = new NextRequest("http://localhost/api/workspace/onboarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "user-1",
      },
      body: JSON.stringify({
        name: "Acme Team",
        slug: "acme-team",
      }),
    })

    const response = await createOnboardingWorkspace(request)
    const payload = (await response.json()) as {
      workspace?: { id: string; slug: string; name: string; taskPriorityDisplayStyle?: string }
    }

    assert.equal(response.status, 201)
    assert.equal(payload.workspace?.id, "ws-1")
    assert.equal(payload.workspace?.slug, "acme-team")
    assert.equal(payload.workspace?.name, "Acme Team")
    assert.equal(createdWorkspaceData?.taskPriorityDisplayStyle, "badge")
    assert.equal(payload.workspace?.taskPriorityDisplayStyle, "badge")
  })
})

test("POST /workspace/onboarding returns conflict if user already has workspace", async () => {
  await runWithMocks(async () => {
    ;(db.workspaceMember as typeof db.workspaceMember).findFirst = ((async () => ({
      workspace: {
        id: "ws-existing",
        slug: "existing",
        name: "Existing Workspace",
      },
    })) as unknown) as typeof db.workspaceMember.findFirst

    const request = new NextRequest("http://localhost/api/workspace/onboarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "user-1",
      },
      body: JSON.stringify({
        name: "Another Workspace",
      }),
    })

    const response = await createOnboardingWorkspace(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 409)
    assert.equal(payload.error, "User already belongs to a workspace")
  })
})

test("POST /workspace/onboarding requires authenticated actor", async () => {
  await runWithMocks(async () => {
    const request = new NextRequest("http://localhost/api/workspace/onboarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Acme Team",
      }),
    })

    const response = await createOnboardingWorkspace(request)
    const payload = (await response.json()) as { error?: string }

    assert.equal(response.status, 401)
    assert.equal(payload.error, "Authentication required")
  })
})
