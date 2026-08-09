import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = path.resolve(import.meta.dirname, '..')
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'planglade-setup-'))
const target = path.join(temporaryDirectory, '.env')

try {
  const environment = { ...process.env, PLANGLADE_SETUP_ENV_FILE: target }
  await run(process.execPath, [path.join(root, 'scripts/setup-local.mjs')], {
    cwd: root,
    env: environment,
  })
  const first = await readFile(target, 'utf8')
  await run(process.execPath, [path.join(root, 'scripts/setup-local.mjs')], {
    cwd: root,
    env: environment,
  })
  const second = await readFile(target, 'utf8')

  assert.equal(first, second)
  assert.match(first, /^PLANGLADE_LOCAL_AUTH_ENABLED=true$/m)
  assert.match(first, /^NEXTAUTH_SECRET=[A-Za-z0-9_-]{64}$/m)
  assert.match(first, /^PLANGLADE_SETUP_TOKEN=[0-9a-f]{64}$/m)
  assert.doesNotMatch(first, /^GOOGLE_CLIENT_SECRET=/m)
  process.stdout.write('Local setup generation is idempotent and uses generated secrets.\n')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
