import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { pages } from '../src/pages.mjs'
import { renderPage } from '../src/shell.mjs'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(websiteRoot, '..')
const read = (file) => readFile(path.join(repositoryRoot, file), 'utf8')

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(target) : [target]
  }))).flat()
}

test('website source never imports application source', async () => {
  const sourceFiles = (await filesBelow(path.join(websiteRoot, 'src')))
    .filter((file) => /\.(?:js|mjs|css)$/.test(file))
  const source = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n')

  assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*(?:frontend|backend)\/src/)
  assert.doesNotMatch(source, /\.\.\/(?:frontend|backend)\//)
  assert.doesNotMatch(source, /Static mock|not real data|trusted by \d|active users|AI-powered/i)
  assert.match(source, /Hosted cloud is not available yet/)
  assert.match(source, /browser-local demo/i)
})

test('site build mounts a compiled demo artifact without copying core source', async () => {
  const build = await read('website/scripts/build.mjs')
  const rootPackage = JSON.parse(await read('package.json'))
  const frontendPackage = JSON.parse(await read('frontend/package.json'))

  assert.match(build, /frontend', 'dist-demo'/)
  assert.match(build, /outputRoot, 'demo'/)
  assert.doesNotMatch(build, /frontend', 'src'/)
  assert.equal(rootPackage.scripts['build:site'], 'npm run build:demo --prefix frontend && npm run build:website')
  assert.equal(frontendPackage.scripts['build:demo'], 'tsc -b && vite build --mode reference --base /demo/ --outDir dist-demo')
})

test('router and hosting contracts keep the demo below /demo', async () => {
  const [main, netlify] = await Promise.all([
    read('frontend/src/main.tsx'),
    read('netlify.toml'),
  ])

  assert.match(main, /<BrowserRouter basename=\{routerBase\}>/)
  assert.match(netlify, /publish = "website\/dist"/)
  assert.match(netlify, /from = "\/demo\/\*"[\s\S]*to = "\/demo\/index\.html"[\s\S]*status = 200/)
  assert.doesNotMatch(netlify, /from = "\/\*"[\s\S]*to = "\/index\.html"/)
})

test('every public page has a complete semantic and metadata shell', () => {
  for (const page of pages) {
    const html = renderPage(page)
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `${page.path} must contain one h1`)
    assert.equal((html.match(/<main[ >]/g) ?? []).length, 1, `${page.path} must contain one main landmark`)
    assert.match(html, /<a class="skip-link" href="#main">Skip to main content<\/a>/)
    assert.match(html, /<meta name="description" content="[^"]+">/)
    assert.match(html, /<link rel="canonical" href="https:\/\/planglade\.com\//)
    assert.doesNotMatch(html, /href="#"/)
    assert.doesNotMatch(html, /<img(?![^>]*\balt=)[^>]*>/)
    for (const externalLink of html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)) {
      assert.match(externalLink[0], /rel="noreferrer"/, `${page.path} external links must protect the opener`)
    }
  }
})
