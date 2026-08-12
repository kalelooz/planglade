import assert from 'node:assert/strict'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { pages } from '../src/pages.mjs'
import { renderPage } from '../src/shell.mjs'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(websiteRoot, '..')
const outputRoot = path.join(websiteRoot, 'dist')
const demoSource = path.join(repositoryRoot, 'frontend', 'dist-demo')

await readFile(path.join(demoSource, 'index.html'), 'utf8').catch(() => {
  throw new Error('frontend/dist-demo is missing. Run npm run build:demo --prefix frontend first.')
})

await rm(outputRoot, { recursive: true, force: true })
await mkdir(path.join(outputRoot, 'assets'), { recursive: true })

for (const page of pages) {
  const target = path.join(outputRoot, page.output)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, renderPage(page), 'utf8')
}

await Promise.all([
  cp(path.join(websiteRoot, 'public'), path.join(outputRoot, 'assets'), { recursive: true }),
  cp(demoSource, path.join(outputRoot, 'demo'), { recursive: true }),
  cp(path.join(websiteRoot, 'src', 'styles.css'), path.join(outputRoot, 'assets', 'styles.css')),
  cp(path.join(websiteRoot, 'src', 'theme.js'), path.join(outputRoot, 'assets', 'theme.js')),
  cp(path.join(websiteRoot, 'src', 'site.js'), path.join(outputRoot, 'assets', 'site.js')),
])

const publicPaths = pages
  .filter((page) => page.robots !== 'noindex, follow')
  .map((page) => page.path)
const lastModified = new Date().toISOString().slice(0, 10)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPaths.map((pagePath) => `  <url><loc>https://planglade.com${pagePath}</loc><lastmod>${lastModified}</lastmod></url>`).join('\n')}
</urlset>
`

await writeFile(path.join(outputRoot, 'sitemap.xml'), sitemap, 'utf8')
await writeFile(path.join(outputRoot, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /demo/\nSitemap: https://planglade.com/sitemap.xml\n', 'utf8')

const demoHtml = await readFile(path.join(outputRoot, 'demo', 'index.html'), 'utf8')
assert.match(demoHtml, /(?:src|href)="\/demo\//, 'demo assets must be rooted below /demo/')
assert.doesNotMatch(demoHtml, /(?:src|href)="\/assets\//, 'demo assets must not use the marketing asset root')

console.log(`Built ${pages.length} website pages and mounted the core demo at website/dist/demo.`)
