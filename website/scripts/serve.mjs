import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveRequest } from './request-path.mjs'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(websiteRoot, 'dist')
const portFlag = process.argv.indexOf('--port')
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 5173

if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('Use an available port between 1024 and 65535.')
}

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

async function loadStaticFiles(directory) {
  const files = new Map()

  async function visit(currentDirectory, urlDirectory = '/') {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name)
      const urlPath = path.posix.join(urlDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(entryPath, urlPath)
      } else if (entry.isFile()) {
        files.set(urlPath, {
          body: await readFile(entryPath),
          type: types[path.extname(entry.name)] ?? 'application/octet-stream',
        })
      }
    }
  }

  await visit(directory)
  return files
}

const staticFiles = await loadStaticFiles(outputRoot).catch(() => {
  throw new Error('website/dist is missing. Run npm run build:site before starting the website server.')
})

if (!staticFiles.has('/index.html')) {
  throw new Error('website/dist is incomplete. Run npm run build:site before starting the website server.')
}

const server = createServer((request, response) => {
  const { asset, malformed, status } = resolveRequest(staticFiles, request.url ?? '/')
  if (malformed) {
    response.writeHead(400).end('Bad request')
    return
  }
  if (!asset) {
    response.writeHead(404).end('Not found')
    return
  }
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': asset.type,
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(asset.body)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`PlanGlade website ready at http://127.0.0.1:${port}/`)
})
