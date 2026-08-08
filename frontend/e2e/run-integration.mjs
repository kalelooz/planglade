import { spawn, execFile as execFileCallback } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'

const execFile = promisify(execFileCallback)
const appDirectory = path.resolve(import.meta.dirname, '..')
const backendDirectory = process.env.PLANGLADE_E2E_BACKEND_DIR ?? path.resolve(appDirectory, '..', '..', 'planglade-vite-backend-current-validation')
const resultDirectory = path.join(appDirectory, 'test-results', 'vite-integration')
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'planglade-vite-e2e-'))
const databasePath = path.join(temporaryDirectory, 'integration.db')
const runtimeFile = path.join(temporaryDirectory, 'runtime.json')
const storageState = path.join(temporaryDirectory, 'storage-state.json')
const runId = randomBytes(8).toString('hex')
const children = []
const logs = []

function fileUrl(filePath) {
  return `file:${filePath.replaceAll('\\', '/')}`
}

async function portOwner(port) {
  const { stdout } = await execFile('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true })
  const line = stdout.split(/\r?\n/).find((entry) => entry.includes(`:${port}`) && entry.includes('LISTENING'))
  return line?.trim().split(/\s+/).at(-1) ?? null
}

async function assertPortAvailable(port) {
  const owner = await portOwner(port)
  if (owner) throw new Error(`Port ${port} is already occupied by PID ${owner}. Stop that process before running this harness.`)
}

async function applyMigrations() {
  const migrationsDirectory = path.join(backendDirectory, 'prisma', 'migrations')
  const database = new DatabaseSync(databasePath)
  try {
    const migrations = (await readdir(migrationsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    for (const migration of migrations) database.exec(await readFile(path.join(migrationsDirectory, migration, 'migration.sql'), 'utf8'))
  } finally {
    database.close()
  }
}

function start(name, command, args, options) {
  const child = spawn(command, args, { ...options, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  children.push(child)
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => logs.push(`[${name}] ${chunk}`))
  }
  return child
}

async function waitForServer(url, name) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status < 500 && response.status !== 404) return
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${name} did not become ready at ${url}`)
}

async function stopChildren() {
  await Promise.all(children.map(async (child) => {
    if (!child.pid || child.exitCode !== null) return
    try {
      await execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    } catch {
      // A child may already have exited while its parent is being stopped.
    }
  }))
}

async function assertPortsReleased() {
  for (const port of [3000, 5173]) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!(await portOwner(port))) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const owner = await portOwner(port)
    if (owner) throw new Error(`Harness cleanup left port ${port} occupied by PID ${owner}`)
  }
}

let exitCode = 1
try {
  await assertPortAvailable(3000)
  await assertPortAvailable(5173)
  await applyMigrations()
  const secret = randomBytes(32).toString('base64url')
  const harnessEnvironment = {
    ...process.env,
    DATABASE_URL: fileUrl(databasePath),
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: 'http://127.0.0.1:5173',
    PLANGLADE_AUTH_MODE: 'nextauth',
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: 'nextauth',
    PLANGLADE_LOCAL_AUTH_ENABLED: 'true',
    PLANGLADE_SETUP_TOKEN: randomBytes(32).toString('hex'),
    PLANGLADE_STORAGE_PROVIDER: 'local',
    PLANGLADE_STORAGE_SIGNING_SECRET: randomBytes(32).toString('base64url'),
    PLANGLADE_LOCAL_STORAGE_DIR: path.join(temporaryDirectory, 'attachments'),
    PLANGLADE_EMAIL_PROVIDER: 'disabled',
  }
  await mkdir(harnessEnvironment.PLANGLADE_LOCAL_STORAGE_DIR, { recursive: true })
  start('backend', process.execPath, [path.join(backendDirectory, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', '3000'], {
    cwd: backendDirectory,
    env: harnessEnvironment,
  })
  await waitForServer('http://127.0.0.1:3000/api/auth/session', 'Backend')
  await waitForServer('http://127.0.0.1:3000/api/auth/setup/claim', 'Backend setup route')
  start('vite', process.execPath, [path.join(appDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'api', '--host', '127.0.0.1'], {
    cwd: appDirectory,
    env: { ...process.env, PLANGLADE_DEV_BACKEND_ORIGIN: 'http://127.0.0.1:3000' },
  })
  await waitForServer('http://127.0.0.1:5173/', 'Vite')
  const test = start('playwright', process.execPath, [
    path.join(appDirectory, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '--config',
    'playwright.integration.config.ts',
    ...(process.env.PLANGLADE_E2E_GREP ? ['--grep', process.env.PLANGLADE_E2E_GREP] : []),
  ], {
    cwd: appDirectory,
    env: {
      ...process.env,
      PLANGLADE_E2E_EMAIL: `integration-${runId}@example.test`,
      PLANGLADE_E2E_PASSWORD: randomBytes(24).toString('base64url'),
      PLANGLADE_E2E_RUN_ID: runId,
      PLANGLADE_E2E_RUNTIME_FILE: runtimeFile,
      PLANGLADE_E2E_SETUP_TOKEN: harnessEnvironment.PLANGLADE_SETUP_TOKEN,
      PLANGLADE_E2E_STORAGE_STATE: storageState,
    },
  })
  exitCode = await new Promise((resolve) => test.once('exit', (code) => resolve(code ?? 1)))
  if (exitCode !== 0) throw new Error(`Playwright integration smoke failed with exit code ${exitCode}`)
} catch (error) {
  await mkdir(resultDirectory, { recursive: true })
  await writeFile(path.join(resultDirectory, 'server.log'), logs.join(''), 'utf8')
  throw error
} finally {
  await stopChildren()
  await assertPortsReleased()
  await rm(temporaryDirectory, { recursive: true, force: true })
  if (exitCode === 0) await rm(resultDirectory, { recursive: true, force: true })
}
