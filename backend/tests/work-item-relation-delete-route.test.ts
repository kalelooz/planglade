import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const DEV_EMAIL = "alex.morgan@planglade.dev"

test("workspace members can remove task relations while viewers remain read-only", async () => {
  const isolated = createIsolatedTestDatabase()
  const previousAuthMode = process.env.PLANGLADE_AUTH_MODE
  const previousPublicAuthMode = process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
  process.env.PLANGLADE_AUTH_MODE = "dev"
  process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "dev"

  const { db } = await import("../src/lib/db")
  const { DELETE } = await import("../src/app/api/work-item-relations/[relationId]/route")

  try {
    const owner = await db.user.create({
      data: { id: "owner-1", email: "owner@example.test", normalizedEmail: "owner@example.test", name: "Owner" },
    })
    const member = await db.user.create({
      data: { id: "member-1", email: DEV_EMAIL, normalizedEmail: DEV_EMAIL, name: "Member" },
    })
    await db.workspace.create({
      data: {
        id: "workspace-1",
        slug: "workspace-1",
        name: "Workspace",
        ownerId: owner.id,
        memberships: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    })
    const [source, target] = await Promise.all([
      db.workItem.create({ data: { id: "source-1", workspaceId: "workspace-1", title: "Source", createdById: owner.id } }),
      db.workItem.create({ data: { id: "target-1", workspaceId: "workspace-1", title: "Target", createdById: owner.id } }),
    ])
    const createRelation = (id: string) => db.workItemRelation.create({
      data: { id, workspaceId: "workspace-1", sourceId: source.id, targetId: target.id, relationType: "BLOCKS" },
    })

    const memberRelation = await createRelation("relation-member")
    const memberResponse = await DELETE(new NextRequest(
      "http://localhost/api/work-item-relations/relation-member?workspaceId=workspace-1",
      { method: "DELETE" },
    ), { params: Promise.resolve({ relationId: memberRelation.id }) })
    assert.equal(memberResponse.status, 200)
    assert.equal(await db.workItemRelation.findUnique({ where: { id: memberRelation.id } }), null)

    await db.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: "workspace-1", userId: member.id } },
      data: { role: "VIEWER" },
    })
    const viewerRelation = await createRelation("relation-viewer")
    const viewerResponse = await DELETE(new NextRequest(
      "http://localhost/api/work-item-relations/relation-viewer?workspaceId=workspace-1",
      { method: "DELETE" },
    ), { params: Promise.resolve({ relationId: viewerRelation.id }) })
    assert.equal(viewerResponse.status, 403)
    assert.ok(await db.workItemRelation.findUnique({ where: { id: viewerRelation.id } }))
  } finally {
    await db.$disconnect()
    if (previousAuthMode === undefined) delete process.env.PLANGLADE_AUTH_MODE
    else process.env.PLANGLADE_AUTH_MODE = previousAuthMode
    if (previousPublicAuthMode === undefined) delete process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE
    else process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = previousPublicAuthMode
    await isolated.cleanup()
  }
})
