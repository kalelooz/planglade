// Minimal FlowBoard server with built-in keep-alive
const { createServer } = require('http')
const { join } = require('path')

// Serve the Next.js standalone server as a child process
const { spawn } = require('child_process')

const SERVER_DIR = join(__dirname, '.next', 'standalone')
const PORT = 3000

let child = null
let alive = true

function startServer() {
  console.log(`[FlowBoard] Starting server...`)
  child = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), NODE_OPTIONS: '--max-old-space-size=256' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.on('data', (d) => process.stdout.write(d))
  child.stderr.on('data', (d) => process.stderr.write(d))

  child.on('exit', (code) => {
    console.log(`[FlowBoard] Server exited code=${code}`)
    child = null
    if (alive) {
      setTimeout(startServer, 2000)
    }
  })
}

function healthCheck() {
  const req = require('http').get(`http://localhost:${PORT}/favicon.ico`, (res) => {
    res.resume()
  })
  req.on('error', () => {})
  req.setTimeout(5000, () => req.destroy())
}

startServer()

// Keep-alive every 3 seconds
setInterval(healthCheck, 3000)

// Graceful shutdown
process.on('SIGTERM', () => {
  alive = false
  if (child) child.kill()
  process.exit(0)
})
process.on('SIGINT', () => {
  alive = false
  if (child) child.kill()
  process.exit(0)
})

console.log('[FlowBoard] Server manager running on port ' + PORT)
