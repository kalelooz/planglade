import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertPortAvailable, parsePort, stopProcessTree } from './harness-utils.mjs'

const appDirectory = path.resolve(import.meta.dirname, '..')
const resultDirectory = path.join(appDirectory, 'test-results', 'vite-reference')
const referencePort = parsePort(process.env.PLANGLADE_E2E_REFERENCE_PORT, 'PLANGLADE_E2E_REFERENCE_PORT', 5173)
const referenceOrigin = `http://127.0.0.1:${referencePort}`
const logs = []

async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${referenceOrigin}/`)).ok) return
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Reference Vite server did not become ready')
}

let vite
let exitCode = 1
try {
  await assertPortAvailable(referencePort)
  vite = spawn(process.execPath, [path.join(appDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'reference', '--host', '127.0.0.1', '--port', String(referencePort)], {
    cwd: appDirectory,
    detached: process.platform !== 'win32',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  for (const stream of [vite.stdout, vite.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => logs.push(chunk))
  }
  await waitForServer()
  const test = spawn(process.execPath, [path.join(appDirectory, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config', 'playwright.reference.config.ts'], {
    cwd: appDirectory,
    shell: false,
    stdio: 'inherit',
    env: { ...process.env, PLANGLADE_E2E_BASE_URL: referenceOrigin },
    windowsHide: true,
  })
  exitCode = await new Promise((resolve) => test.once('exit', (code) => resolve(code ?? 1)))
  if (exitCode !== 0) throw new Error(`Playwright reference smoke failed with exit code ${exitCode}`)
} catch (error) {
  await mkdir(resultDirectory, { recursive: true })
  await writeFile(path.join(resultDirectory, 'server.log'), logs.join(''), 'utf8')
  throw error
} finally {
  await stopProcessTree(vite)
  if (exitCode === 0) await rm(resultDirectory, { recursive: true, force: true })
}
