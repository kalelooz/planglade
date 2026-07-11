import { request as httpRequest } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"

const host = "127.0.0.1"
const proxyPort = 3100
const appPort = 3101
const runtimeDir = join(process.cwd(), "test-results", "browser-smoke-runtime")
const keyPath = join(runtimeDir, "localhost-key.pem")
const certificatePath = join(runtimeDir, "localhost-cert.pem")

function createCertificate() {
  const args = [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certificatePath,
    "-days",
    "1",
    "-subj",
    "/CN=127.0.0.1",
  ]
  const commands = process.platform === "win32"
    ? ["openssl.exe", "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"]
    : ["openssl"]

  for (const command of commands) {
    const result = spawnSync(command, args, { stdio: "inherit" })
    if (!result.error && result.status === 0) return
  }

  throw new Error("OpenSSL is required to create the local browser-smoke certificate.")
}

await mkdir(runtimeDir, { recursive: true })
createCertificate()

const app = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, HOSTNAME: host, PORT: String(appPort) },
  stdio: "inherit",
})

const proxy = createHttpsServer(
  { key: await readFile(keyPath), cert: await readFile(certificatePath) },
  (clientRequest, clientResponse) => {
    const upstreamRequest = httpRequest(
      {
        hostname: host,
        port: appPort,
        method: clientRequest.method,
        path: clientRequest.url,
        headers: {
          ...clientRequest.headers,
          "x-forwarded-proto": "https",
          "x-forwarded-host": clientRequest.headers.host ?? `${host}:${proxyPort}`,
        },
      },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
        upstreamResponse.pipe(clientResponse)
      }
    )

    upstreamRequest.on("error", () => {
      clientResponse.writeHead(502).end()
    })
    clientRequest.pipe(upstreamRequest)
  }
)

function shutdown() {
  app.kill()
  proxy.close(() => process.exit(0))
}

app.on("exit", (code) => {
  proxy.close(() => process.exit(code ?? 1))
})
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

proxy.listen(proxyPort, host)
