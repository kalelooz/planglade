import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_ATTACHMENT_BYTES,
  createAttachmentSchema,
  createAttachmentUploadUrlSchema,
  updateAttachmentSchema,
} from "../src/lib/contracts"

test("attachment upload URL schema allows supported MIME types", () => {
  const parsed = createAttachmentUploadUrlSchema.safeParse({
    workspaceId: "workspace-1",
    workItemId: "task-1",
    name: "brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
  })

  assert.equal(parsed.success, true)
})

test("attachment schemas reject unsupported MIME types", () => {
  const createResult = createAttachmentSchema.safeParse({
    workspaceId: "workspace-1",
    workItemId: "task-1",
    name: "installer.exe",
    storageKey: "workspace-1/2026/06/installer.exe",
    mimeType: "application/x-msdownload",
    sizeBytes: 1024,
  })

  const uploadResult = createAttachmentUploadUrlSchema.safeParse({
    workspaceId: "workspace-1",
    workItemId: "task-1",
    name: "installer.exe",
    mimeType: "application/x-msdownload",
    sizeBytes: 1024,
  })

  assert.equal(createResult.success, false)
  assert.equal(uploadResult.success, false)
})

test("attachment schemas reject files over the size limit", () => {
  const tooLarge = MAX_ATTACHMENT_BYTES + 1

  const uploadResult = createAttachmentUploadUrlSchema.safeParse({
    workspaceId: "workspace-1",
    workItemId: "task-1",
    name: "large.pdf",
    mimeType: "application/pdf",
    sizeBytes: tooLarge,
  })

  const updateResult = updateAttachmentSchema.safeParse({
    sizeBytes: tooLarge,
  })

  assert.equal(uploadResult.success, false)
  assert.equal(updateResult.success, false)
})
