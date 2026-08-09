import { execFile as execFileCallback } from 'node:child_process'
import { createServer } from 'node:net'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

export function parsePort(value, name, fallback) {
  const raw = value ?? String(fallback)
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer between 1 and 65535`)
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`)
  }
  return port
}

export async function portAvailable(port) {
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

export async function assertPortAvailable(port) {
  if (!(await portAvailable(port))) {
    throw new Error(`Port ${port} is already occupied. Stop that process before running this harness.`)
  }
}

export async function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try {
      await execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    } catch {
      // A child may already have exited while its parent is being stopped.
    }
    return
  }

  const exited = new Promise((resolve) => child.once('exit', resolve))
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))])
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
  }
}
