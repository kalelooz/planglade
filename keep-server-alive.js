/* eslint-disable @typescript-eslint/no-require-imports */
// Single-process FlowBoard server with self-keep-alive
// Runs the Next.js standalone server as a child and pings it periodically

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const SERVER_DIR = path.join(__dirname, '.next', 'standalone')
const PORT = 3000

let serverProcess = null
let restartCount = 0

function startServer() {
  restartCount++
  console.log(`[FlowBoard] Starting server (attempt ${restartCount})...`)

  serverProcess = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      NODE_OPTIONS: '--max-old-space-size=256',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', (data) => process.stdout.write(data))
  serverProcess.stderr.on('data', (data) => process.stderr.write(data))

  serverProcess.on('exit', (code, signal) => {
    console.log(`[FlowBoard] Server exited (code=${code}, signal=${signal})`)
    serverProcess = null
    // Restart after a short delay
    setTimeout(startServer, 2000)
  })
}

function keepAlive() {
  if (!serverProcess) return

  const req = http.get(`http://localhost:${PORT}/favicon.ico`, (res) => {
    res.resume() // Drain the response
  })

  req.on('error', () => {
    // Server might be down, the exit handler will restart
  })

  req.setTimeout(5000, () => {
    req.destroy()
  })
}

// Start the server
startServer()

// Self keep-alive every 3 seconds
setInterval(keepAlive, 3000)

// Prevent this process from exiting
process.stdin.resume()

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('[FlowBoard] SIGTERM received')
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[FlowBoard] SIGINT received')
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})

console.log('[FlowBoard] Manager process running')
