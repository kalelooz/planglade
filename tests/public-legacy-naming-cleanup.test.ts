import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

async function fileExists(filePath: string) {
  try {
    await access(path.join(root, filePath))
    return true
  } catch {
    return false
  }
}

test("PUBLIC-LEGACY-NAMING-PUBLIC-PORT-006: README uses PlanGlade env names in public setup", async () => {
  const readme = await readProjectFile("README.md")

  assert.match(readme, /PLANGLADE_AUTH_MODE="dev"/)
  assert.match(readme, /NEXT_PUBLIC_PLANGLADE_AUTH_MODE="dev"/)
  assert.match(readme, /PLANGLADE_STORAGE_PROVIDER="local"/)
  assert.match(readme, /PLANGLADE_LOCAL_STORAGE_DIR="storage\/local-attachments"/)
  assert.match(readme, /PLANGLADE_STORAGE_SIGNING_SECRET=/)
  assert.doesNotMatch(readme, /FLOWBOARD_/)
})

test("PUBLIC-LEGACY-NAMING-PUBLIC-PORT-006: .env.example uses PlanGlade env names", async () => {
  const envExample = await readProjectFile(".env.example")

  for (const key of [
    "PLANGLADE_AUTH_MODE",
    "NEXT_PUBLIC_PLANGLADE_AUTH_MODE",
    "PLANGLADE_STORAGE_PROVIDER",
    "PLANGLADE_LOCAL_STORAGE_DIR",
    "PLANGLADE_STORAGE_SIGNING_SECRET",
    "PLANGLADE_WORKSPACE_SLUG",
    "PLANGLADE_WORKSPACE_NAME",
    "PLANGLADE_EMAIL_PROVIDER",
    "PLANGLADE_EMAIL_FROM",
    "PLANGLADE_MAINTENANCE_TOKEN",
  ]) {
    assert.match(envExample, new RegExp(key))
  }

  assert.doesNotMatch(envExample, /FLOWBOARD_/)
})

test("PUBLIC-LEGACY-NAMING-PUBLIC-PORT-006: README local markdown links resolve", async () => {
  const readme = await readProjectFile("README.md")
  const links = [...readme.matchAll(/\]\((\.\/[^)#\s]+\.md)(?:#[^)]+)?\)/g)].map(
    (match) => match[1].replace(/^\.\//, "")
  )

  assert.ok(links.length > 0, "README should contain local markdown links")

  for (const link of links) {
    assert.equal(await fileExists(link), true, `${link} should exist`)
  }
})
