import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { decodeRequestPath } from './request-path.mjs'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(websiteRoot, 'dist')
const portFlag = process.argv.indexOf('--port')
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 5173

if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('Use an available port between 1024 and 65535.')
}

await stat(path.join(outputRoot, 'index.html')).catch(() => {
  throw new Error('website/dist is missing. Run npm run build:site before starting the website server.')
})

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

async function resolveFile(requestPath) {
  const decoded = decodeRequestPath(requestPath)
  if (decoded === null) return { file: null, malformed: true }

  const relative = decoded.replace(/^\/+/, '')
  const candidate = path.resolve(outputRoot, relative)
  if (candidate !== outputRoot && !candidate.startsWith(`${outputRoot}${path.sep}`)) {
    return { file: null, malformed: false }
  }

  const candidates = [candidate]
  if (path.extname(candidate) === '') candidates.unshift(path.join(candidate, 'index.html'))
  if (decoded === '/demo' || decoded.startsWith('/demo/')) candidates.push(path.join(outputRoot, 'demo', 'index.html'))
  candidates.push(path.join(outputRoot, '404.html'))

  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return { file, malformed: false }
    } catch {
      // Try the next safe candidate.
    }
  }
  return { file: null, malformed: false }
}

const server = createServer(async (request, response) => {
  const { file, malformed } = await resolveFile(request.url ?? '/')
  if (malformed) {
    response.writeHead(400).end('Bad request')
    return
  }
  if (!file) {
    response.writeHead(404).end('Not found')
    return
  }
  const notFound = file.endsWith(`${path.sep}404.html`)
  response.writeHead(notFound ? 404 : 200, {
    'Cache-Control': 'no-store',
    'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(file).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`PlanGlade website ready at http://127.0.0.1:${port}/`)
})
