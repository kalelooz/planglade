import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdir, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import path from "node:path"

const standaloneDirectory = path.resolve(".next/standalone")
const probeName = `image-optimizer-probe-${process.pid}.png`
const probePath = path.join(standaloneDirectory, "public", probeName)
const probe = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

async function availablePort() {
  const server = net.createServer()
  server.unref()
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address === "object")
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return address.port
}

async function waitForResponse(url, child, output) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Standalone server exited before the optimizer probe.\n${output.join("")}`)
    }
    try {
      return await fetch(url)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`Standalone server did not accept the optimizer probe.\n${output.join("")}`)
}

await mkdir(path.dirname(probePath), { recursive: true })
await writeFile(probePath, probe)

const port = await availablePort()
const output = []
const child = spawn(process.execPath, ["server.js"], {
  cwd: standaloneDirectory,
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
})
child.stdout.on("data", (chunk) => output.push(chunk.toString()))
child.stderr.on("data", (chunk) => output.push(chunk.toString()))

try {
  const probeUrl = new URL(`http://127.0.0.1:${port}/_next/image`)
  probeUrl.searchParams.set("url", `/${probeName}`)
  probeUrl.searchParams.set("w", "64")
  probeUrl.searchParams.set("q", "75")

  const response = await waitForResponse(probeUrl, child, output)
  assert.equal(response.status, 404, "The disabled Image Optimization API must be unavailable")
  console.log(`Image Optimization API disabled (HTTP ${response.status}).`)
} finally {
  child.kill()
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))])
  await rm(probePath, { force: true })
}
