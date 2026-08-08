import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { updateWorkItemSchema } from "@/lib/contracts"
import { toUiWorkItem } from "@/lib/server-ui-mappers"

test("task placement accepts an explicit destination sibling and keeps its server position", () => {
  assert.deepEqual(updateWorkItemSchema.parse({ status: "TODO", beforeId: "task-2" }), {
    status: "TODO",
    beforeId: "task-2",
  })
  assert.equal(toUiWorkItem({
    id: "task-1",
    title: "Ordered task",
    status: "TODO",
    priority: "MEDIUM",
    assigneeId: null,
    projectId: "project-1",
    parentId: null,
    startDate: null,
    dueDate: null,
    description: null,
    labels: [],
    position: 2048,
  }, "user-1").position, 2048)
})

test("task APIs order by position and reindex a placement inside the server transaction", async () => {
  const [listRoute, patchRoute, contracts] = await Promise.all([
    readFile(path.join(process.cwd(), "src/app/api/work-items/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/api/work-items/[workItemId]/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src/lib/contracts.ts"), "utf8"),
  ])

  assert.match(listRoute, /orderBy: \[\{ position: "asc" \}/)
  assert.match(contracts, /beforeId: z\.string\(\)\.min\(1\)\.nullable\(\)\.optional\(\)/)
  assert.match(patchRoute, /Placement target not found in the destination status/)
  assert.doesNotMatch(patchRoute, /before\.projectId !== effectiveProjectId/)
  assert.match(patchRoute, /orderBy: \[\{ position: "asc" \}, \{ createdAt: "asc" \}\]/)
  assert.match(patchRoute, /data: \{ position: \(index \+ 1\) \* 1024 \}/)
})
