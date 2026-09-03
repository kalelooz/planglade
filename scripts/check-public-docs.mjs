import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const files = Object.fromEntries(await Promise.all([
  'README.md',
  'CONTRIBUTING.md',
  'backend/docs/SELF_HOSTING.md',
  'backend/docs/PRODUCTION_MIGRATIONS.md',
  'backend/docs/BACKUP_RESTORE.md',
  'docs/SUPPORT.md',
  'docs/PERMISSIONS.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
].map(async (file) => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])))

assert.equal(rootPackage.scripts['setup:local'], 'node scripts/setup-local.mjs')
assert.equal(rootPackage.scripts.dev, 'npm run dev --prefix frontend')

for (const command of ['npm run install:all', 'npm run dev']) {
  assert.ok(files['CONTRIBUTING.md'].includes(command), `Contributing guide is missing ${command}`)
}
assert.match(files['CONTRIBUTING.md'], /127\.0\.0\.1:5173/)
assert.match(files['CONTRIBUTING.md'], /commercial hosted superset/)
assert.match(files['CONTRIBUTING.md'], /does not automatically belong here merely because it could be provider-neutral/)
assert.match(files['CONTRIBUTING.md'], /Publish public corrections promptly for security/)
assert.match(files['CONTRIBUTING.md'], /fixes to functionality\s+already advertised by the Community Edition/)
assert.match(files['CONTRIBUTING.md'], /30–90 days/)
assert.match(files['CONTRIBUTING.md'], /security and integrity fixes must not be intentionally\s+delayed/)
assert.match(files['CONTRIBUTING.md'], /Do not publish Cloud billing/)
assert.match(files['CONTRIBUTING.md'], /public MIT license remains\s+unchanged/)
assert.doesNotMatch(files['CONTRIBUTING.md'], /Open `http:\/\/localhost:3000`|npm run db:push|^\s*npm install\s*$/m)

const selfHosting = files['backend/docs/SELF_HOSTING.md']
for (const expected of ['frontend', 'backend', 'migrate', 'http://localhost:8080/setup', 'npm run setup:local']) {
  assert.ok(selfHosting.includes(expected), `Self-hosting guide is missing ${expected}`)
}
assert.match(selfHosting, /OAuth, Firebase, and an email provider are optional/)
assert.match(selfHosting, /POST` to `\/api\/attachments\/reap-expired`/)
assert.match(selfHosting, /PLANGLADE_MAINTENANCE_TOKEN/)
assert.doesNotMatch(selfHosting, /one standalone Next\.js app|Open `http:\/\/localhost:3000`|docker compose stop app/)

for (const file of ['README.md', 'docs/SUPPORT.md']) {
  assert.match(files[file], /issues\/new\?template=bug_report\.yml/)
}
assert.match(files['SECURITY.md'], /Private Vulnerability Reporting/)
assert.match(files['CODE_OF_CONDUCT.md'], /Security or conduct contact request/)

const permissions = files['docs/PERMISSIONS.md']
for (const expected of [
  'Viewer',
  'Member',
  'Admin',
  'Owner',
  'creates imported projects with unique destination slugs',
  'Members may create and remove task relationships',
  'Every completed source checksum retains its committed result',
  'activity log',
]) {
  assert.ok(permissions.includes(expected), `Permissions guide is missing ${expected}`)
}
assert.match(files['README.md'], /docs\/PERMISSIONS\.md/)

const migrationDocs = files['backend/docs/PRODUCTION_MIGRATIONS.md']
assert.match(migrationDocs, /docker compose -f compose\.yml/)
assert.doesNotMatch(migrationDocs, /docker-compose\.yml|file:\/tmp/)

console.log('Public setup, contributor, self-hosting, migration, support, and reporting docs are aligned.')
