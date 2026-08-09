import { randomBytes } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const templatePath = path.join(root, '.env.example')
const targetPath = process.env.PLANGLADE_SETUP_ENV_FILE
  ? path.resolve(process.env.PLANGLADE_SETUP_ENV_FILE)
  : path.join(root, '.env')

function readValue(source, key) {
  return source.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]
}

function setValue(source, key, value) {
  const pattern = new RegExp(`^#?\\s*${key}=.*$`, 'm')
  return pattern.test(source)
    ? source.replace(pattern, `${key}=${value}`)
    : `${source.trimEnd()}\n${key}=${value}\n`
}

function commentPlaceholder(source, key) {
  return source.replace(
    new RegExp(`^${key}=(replace-[^\\r\\n]*)$`, 'm'),
    `# ${key}=$1`,
  )
}

function needsGeneratedSecret(value) {
  return !value || value.startsWith('replace-')
}

let source
let created = false
try {
  source = await readFile(targetPath, 'utf8')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  source = await readFile(templatePath, 'utf8')
  created = true
}

source = setValue(source, 'PLANGLADE_LOCAL_AUTH_ENABLED', 'true')

if (needsGeneratedSecret(readValue(source, 'NEXTAUTH_SECRET'))) {
  source = setValue(source, 'NEXTAUTH_SECRET', randomBytes(48).toString('base64url'))
}

let setupToken = readValue(source, 'PLANGLADE_SETUP_TOKEN')
if (!setupToken || !/^[0-9a-f]{64}$/i.test(setupToken)) {
  setupToken = randomBytes(32).toString('hex')
  source = setValue(source, 'PLANGLADE_SETUP_TOKEN', setupToken)
}

for (const key of [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'PLANGLADE_STORAGE_SIGNING_SECRET',
  'PLANGLADE_MAINTENANCE_TOKEN',
]) {
  source = commentPlaceholder(source, key)
}

await writeFile(targetPath, source.endsWith('\n') ? source : `${source}\n`, {
  encoding: 'utf8',
  mode: 0o600,
})
await chmod(targetPath, 0o600)

process.stdout.write(`[setup] ${created ? 'Created' : 'Updated'} ${path.basename(targetPath)}\n`)
process.stdout.write(`[setup] Setup token: ${setupToken}\n`)
process.stdout.write('[setup] Start PlanGlade, open /setup, and enter this token.\n')
