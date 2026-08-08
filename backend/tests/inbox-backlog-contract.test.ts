import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { createWorkItemSchema, workItemListQuerySchema } from "@/lib/contracts"

test("Inbox membership is independent from the Backlog workflow status", async () => {
  assert.equal(createWorkItemSchema.parse({ workspaceId: "workspace-1", title: "Board task", status: "BACKLOG" }).isInbox, false)
  assert.equal(createWorkItemSchema.parse({ workspaceId: "workspace-1", title: "Capture", isInbox: true }).isInbox, true)
  assert.equal(workItemListQuerySchema.parse({ workspaceId: "workspace-1", isInbox: "true" }).isInbox, true)

  const [listRoute, patchRoute, schema] = await Promise.all([
    readFile(path.join(process.cwd(), "src/app/api/work-items/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/api/work-items/[workItemId]/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "prisma/schema.prisma"), "utf8"),
  ])

  assert.match(listRoute, /query\.data\.isInbox !== undefined \? \{ isInbox: query\.data\.isInbox \}/)
  assert.match(patchRoute, /parsed\.data\.status !== undefined \? \{ isInbox: false \}/)
  assert.match(schema, /isInbox\s+Boolean\s+@default\(false\)/)
})
