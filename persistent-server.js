/* eslint-disable @typescript-eslint/no-require-imports */
// FlowBoard persistent server launcher
// Uses detached child process to survive session cleanup

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const SERVER_DIR = path.join(__dirname, '.next', 'standalone');
const PORT = 3000;
const HEALTH_CHECK_INTERVAL = 5000;
const RESTART_DELAY = 3000;

let child = null;
let restartCount = 0;

function startServer() {
  console.log(`[FlowBoard] Starting server (attempt ${++restartCount})...`);
  
  child = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code, signal) => {
    console.log(`[FlowBoard] Server exited with code=${code} signal=${signal}`);
    child = null;
    setTimeout(startServer, RESTART_DELAY);
  });

  child.unref();
  console.log(`[FlowBoard] Server PID: ${child.pid}`);
}

function healthCheck() {
  const req = http.get(`http://localhost:${PORT}/favicon.ico`, (res) => {
    res.resume();
  });
  req.on('error', () => {
    // Server might be down, the exit handler will restart
  });
  req.setTimeout(3000, () => {
    req.destroy();
  });
}

// Start the server
startServer();

// Health check loop
setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

// Keep this process alive
process.on('SIGTERM', () => {
  console.log('[FlowBoard] Received SIGTERM, shutting down...');
  if (child) {
    try { process.kill(child.pid); } catch(e) {}
  }
  process.exit(0);
});

console.log('[FlowBoard] Server manager running');
