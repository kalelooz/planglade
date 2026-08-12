import assert from "node:assert/strict"
import test from "node:test"
import { z } from "zod"

import { parseJsonBody } from "../src/lib/api-utils"
import {
  IMPORT_LIMITS,
  importLocalWorkspaceSchema,
  importPreviewWorkspaceSnapshotSchema,
} from "../src/lib/contracts"
import { tryAcquireWorkspaceImport } from "../src/lib/workspace-import-lock"

const tinySchema = z.object({ value: z.string() })

test("JSON parsing rejects a declared body larger than its byte budget", async () => {
  const result = await parseJsonBody(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-length": "101", "content-type": "application/json" },
      body: JSON.stringify({ value: "ok" }),
    }),
    tinySchema,
    { maxBytes: 100 }
  )
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 413)
})

test("JSON parsing stops an unbounded stream once the byte budget is exceeded", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'))
      controller.enqueue(new Uint8Array(128).fill(97))
      controller.enqueue(new TextEncoder().encode('"}'))
      controller.close()
    },
  })
  const result = await parseJsonBody(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    tinySchema,
    { maxBytes: 100 }
  )
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 413)
})

test("JSON parsing rejects excessive nesting before schema validation", async () => {
  let nested = '"leaf"'
  for (let depth = 0; depth < 12; depth += 1) nested = `{"value":${nested}}`
  const result = await parseJsonBody(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: nested,
    }),
    z.unknown(),
    { maxDepth: 10 }
  )
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 400)
})

test("import contracts bound per-entity and aggregate record work", () => {
  const project = { id: "p", name: "Project", status: "ACTIVE" }
  assert.equal(
    importLocalWorkspaceSchema.safeParse({
      workspaceId: "ws-1",
      projects: Array.from({ length: IMPORT_LIMITS.projects + 1 }, (_, index) => ({
        ...project,
        id: `p-${index}`,
      })),
    }).success,
    false
  )

  const tooManyTotal = importPreviewWorkspaceSnapshotSchema.safeParse({
    data: {
      projects: Array.from({ length: IMPORT_LIMITS.projects }, (_, index) => ({
        ...project,
        id: `p-${index}`,
      })),
      workItems: Array.from({ length: IMPORT_LIMITS.workItems }, (_, index) => ({
        id: `w-${index}`,
        title: "Task",
        status: "TODO",
        priority: "MEDIUM",
      })),
      notes: Array.from({ length: 251 }, (_, index) => ({ id: `n-${index}`, title: "Note" })),
    },
  })
  assert.equal(tooManyTotal.success, false)

  const replaceImport = importLocalWorkspaceSchema.safeParse({
    workspaceId: "ws-1",
    mode: "replace",
  })
  assert.equal(replaceImport.success, false)
})

test("only one import can run per workspace at a time", () => {
  const release = tryAcquireWorkspaceImport("ws-1")
  assert.equal(typeof release, "function")
  assert.equal(tryAcquireWorkspaceImport("ws-1"), null)
  release?.()
  const reacquired = tryAcquireWorkspaceImport("ws-1")
  assert.equal(typeof reacquired, "function")
  reacquired?.()
})
