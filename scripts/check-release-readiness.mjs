import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFile(path.join(root, file), 'utf8')
const readJson = async (file) => JSON.parse(await read(file))

const packages = await Promise.all([
  readJson('package.json'),
  readJson('backend/package.json'),
  readJson('frontend/package.json'),
])
const [version] = packages.map(({ version }) => version)

assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Root package has an invalid release version')
assert.deepEqual(new Set(packages.map(({ version: packageVersion }) => packageVersion)), new Set([version]), 'Root, backend, and frontend versions must match')

for (const lockPath of ['backend/package-lock.json', 'frontend/package-lock.json']) {
  const lock = await readJson(lockPath)
  assert.equal(lock.version, version, `${lockPath} version must match ${version}`)
  assert.equal(lock.packages[''].version, version, `${lockPath} root package version must match ${version}`)
}

const changelog = await read('CHANGELOG.md')
assert.ok(changelog.includes(`## [${version}]`), `CHANGELOG.md is missing ${version}`)

const releaseNotesPath = `docs/releases/${version}.md`
const releaseNotes = await read(releaseNotesPath)
for (const heading of ['Upgrade path', 'Migrations', 'Backup and restore', 'Rollback']) {
  assert.ok(releaseNotes.includes(`## ${heading}`), `${releaseNotesPath} is missing the ${heading} section`)
}

const migrationRoot = path.join(root, 'backend/prisma/migrations')
const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
assert.ok(migrations.length > 0, 'At least one checked-in migration is required')
for (const migration of migrations) {
  assert.ok((await read(`backend/prisma/migrations/${migration}/migration.sql`)).trim(), `${migration} has an empty migration.sql`)
}

const workflow = await read('.github/workflows/release.yml')
for (const required of [
  'verification.verified',
  'persist-credentials: false',
  'git fetch --no-tags origin main',
  'git merge-base --is-ancestor "$tag_commit" origin/main',
  'npm run check:release',
  'npm run test:release',
  'npm sbom',
  'sha256sum',
  'gh release create',
]) {
  assert.ok(workflow.includes(required), `Release workflow is missing ${required}`)
}
for (const reference of [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1])) {
  assert.match(reference, /@[0-9a-f]{40}$/, `Release action must be pinned to a full commit SHA: ${reference}`)
}

if (process.env.PLANGLADE_RELEASE_TAG) {
  assert.equal(process.env.PLANGLADE_RELEASE_TAG, `v${version}`, 'Release tag must match the package version')
}

const mojibake = /â(?:€¦|€“|€”|€™)|Â·|Ã./
for (const directory of ['frontend/src', 'docs', 'backend/docs']) {
  const pending = [path.join(root, directory)]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(target)
      else if (/\.(?:css|md|ts|tsx)$/.test(entry.name)) assert.doesNotMatch(await readFile(target, 'utf8'), mojibake, `Mojibake found in ${path.relative(root, target)}`)
    }
  }
}

console.log(`Release ${version} is documented with ${migrations.length} migration(s), matching lockfiles, a pinned workflow, and clean user-facing text.`)
