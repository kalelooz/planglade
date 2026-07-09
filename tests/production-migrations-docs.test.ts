import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("DEPLOY-MIGRATIONS-001: production migration docs avoid Netlify ephemeral migrations", async () => {
  const [docs, netlifyPreview, netlifyConfig, packageJson] = await Promise.all([
    readProjectFile("docs/PRODUCTION_MIGRATIONS.md"),
    readProjectFile("docs/NETLIFY_PREVIEW.md"),
    readProjectFile("netlify.toml"),
    readProjectFile("package.json"),
  ])
  const scripts = JSON.parse(packageJson).scripts

  assert.match(docs, /file:\/tmp\/planglade\.db/)
  assert.match(docs, /ephemeral/)
  assert.match(docs, /Do not add `prisma migrate deploy` to the Netlify build command/)
  assert.match(docs, /npm run db:check:attachment-storage-keys/)
  assert.match(docs, /npm run db:migrate:deploy/)
  assert.match(docs, /npm run db:migrate:status/)
  assert.match(docs, /does not print `DATABASE_URL` or storage keys/)
  assert.match(docs, /restore from the backup/)
  assert.match(netlifyPreview, /Production migration steps live in `docs\/PRODUCTION_MIGRATIONS\.md`/)
  assert.doesNotMatch(netlifyConfig, /migrate deploy/)
  assert.equal(scripts["db:migrate:deploy"], "prisma migrate deploy")
  assert.equal(scripts["db:migrate:status"], "prisma migrate status")
  assert.equal(
    scripts["db:check:attachment-storage-keys"],
    "node scripts/check-attachment-storage-key-duplicates.mjs"
  )
})
