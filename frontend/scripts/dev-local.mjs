import { spawn, execFile as execFileCallback } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const appDirectory = path.resolve(import.meta.dirname, '..')
const backendDirectory = process.env.PLANGLADE_BACKEND_DIR ?? path.resolve(appDirectory, '..', 'backend')
const runtimeDirectory = process.env.PLANGLADE_RUNTIME_DIR ?? path.resolve(appDirectory, '..', '.runtime')
const databasePath = process.env.PLANGLADE_LOCAL_DATABASE_PATH ?? path.join(runtimeDirectory, 'planglade-dev.db')
const children = []

function databaseUrl(filePath) {
  return `file:${filePath.replaceAll('\\', '/')}`
}

async function portOwner(port) {
  const { stdout } = await execFile('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true })
  const match = stdout.split(/\r?\n/).find((line) => {
    const fields = line.trim().split(/\s+/)
    return fields[1]?.endsWith(`:${port}`) && fields.includes('LISTENING')
  })
  return match?.trim().split(/\s+/).at(-1) ?? null
}

async function assertPortAvailable(port) {
  const owner = await portOwner(port)
  if (owner) throw new Error(`Port ${port} is already occupied by PID ${owner}. Stop that process yourself, then run npm run dev:local again.`)
}

function start(name, command, args, options) {
  const child = spawn(command, args, { ...options, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  children.push(child)
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  }
  child.once('exit', (code) => {
    if (!stopping && code !== 0) void stop(code ?? 1)
  })
  return child
}

async function waitForServer(url, name) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status < 500 && response.status !== 404) return
    } catch {
      // The owned child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${name} did not become ready at ${url}`)
}

let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  await Promise.all(children.map(async (child) => {
    if (!child.pid || child.exitCode !== null) return
    try {
      await execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    } catch {
      // The process may have exited while shutdown was requested.
    }
  }))
  process.exitCode = code
}

process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())

try {
  if (!existsSync(path.join(backendDirectory, 'package.json'))) {
    throw new Error(`Backend directory was not found at ${backendDirectory}. Set PLANGLADE_BACKEND_DIR to the backend worktree.`)
  }
  await assertPortAvailable(3000)
  await assertPortAvailable(5173)
  await mkdir(runtimeDirectory, { recursive: true })
  const environment = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? databaseUrl(databasePath),
    PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE ?? 'dev',
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE ?? 'dev',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3000',
  }
  start('backend', process.execPath, [path.join(backendDirectory, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', '3000'], { cwd: backendDirectory, env: environment })
  await waitForServer('http://127.0.0.1:3000/api/auth/session', 'Backend')
  start('frontend', process.execPath, [path.join(appDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'api', '--host', '127.0.0.1'], {
    cwd: appDirectory,
    env: { ...environment, PLANGLADE_DEV_BACKEND_ORIGIN: 'http://127.0.0.1:3000' },
  })
  await waitForServer('http://127.0.0.1:5173/', 'Frontend')
  process.stdout.write('[local] PlanGlade is ready at http://127.0.0.1:5173\n')
} catch (error) {
  process.stderr.write(`[local] ${error instanceof Error ? error.message : String(error)}\n`)
  await stop(1)
}
