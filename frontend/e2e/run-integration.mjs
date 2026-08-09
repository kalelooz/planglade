import { spawn, execFile as execFileCallback } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'

const execFile = promisify(execFileCallback)
const appDirectory = path.resolve(import.meta.dirname, '..')
const backendDirectory = process.env.PLANGLADE_E2E_BACKEND_DIR ?? path.resolve(appDirectory, '..', 'backend')
const resultDirectory = path.join(appDirectory, 'test-results', 'vite-integration')
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'planglade-vite-e2e-'))
const databasePath = path.join(temporaryDirectory, 'integration.db')
const runtimeFile = path.join(temporaryDirectory, 'runtime.json')
const storageState = path.join(temporaryDirectory, 'storage-state.json')
const runId = randomBytes(8).toString('hex')
const backendPort = Number(process.env.PLANGLADE_E2E_BACKEND_PORT ?? 3000)
const frontendPort = Number(process.env.PLANGLADE_E2E_FRONTEND_PORT ?? 5173)
const backendOrigin = `http://127.0.0.1:${backendPort}`
const frontendOrigin = `http://127.0.0.1:${frontendPort}`
const children = []
const logs = []

function fileUrl(filePath) {
  return `file:${filePath.replaceAll('\\', '/')}`
}

async function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false)
      else reject(error)
    })
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve(true))
    })
  })
}

async function assertPortAvailable(port) {
  if (!(await portAvailable(port))) {
    throw new Error(`Port ${port} is already occupied. Stop that process before running this harness.`)
  }
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
    if (process.platform === 'win32') {
      try {
        await execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
      } catch {
        // A child may already have exited while its parent is being stopped.
      }
      return
    }

    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }))
}

async function assertPortsReleased() {
  for (const port of [backendPort, frontendPort]) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await portAvailable(port)) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!(await portAvailable(port))) throw new Error(`Harness cleanup left port ${port} occupied`)
  }
}

let exitCode = 1
try {
  await assertPortAvailable(backendPort)
  await assertPortAvailable(frontendPort)
  await applyMigrations()
  const secret = randomBytes(32).toString('base64url')
  const harnessEnvironment = {
    ...process.env,
    DATABASE_URL: fileUrl(databasePath),
    NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: frontendOrigin,
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
  start('backend', process.execPath, [path.join(backendDirectory, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(backendPort)], {
    cwd: backendDirectory,
    env: harnessEnvironment,
  })
  await waitForServer(`${backendOrigin}/api/auth/session`, 'Backend')
  await waitForServer(`${backendOrigin}/api/auth/setup/claim`, 'Backend setup route')
  start('vite', process.execPath, [path.join(appDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'api', '--host', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: appDirectory,
    env: { ...process.env, PLANGLADE_DEV_BACKEND_ORIGIN: backendOrigin },
  })
  await waitForServer(`${frontendOrigin}/`, 'Vite')
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
      PLANGLADE_E2E_BASE_URL: frontendOrigin,
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
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
  if (exitCode === 0) await rm(resultDirectory, { recursive: true, force: true })
}
