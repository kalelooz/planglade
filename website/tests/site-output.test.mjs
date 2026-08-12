import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(websiteRoot, 'dist')
const readOutput = (file) => readFile(path.join(outputRoot, file), 'utf8')

test('built site contains public pages and distinct website assets', async () => {
  for (const file of [
    'index.html',
    'product/index.html',
    'self-host/index.html',
    'docs/index.html',
    'about/index.html',
    'privacy/index.html',
    'terms/index.html',
    'security/index.html',
    'contact/index.html',
    '404.html',
    'assets/styles.css',
    'assets/theme.js',
    'assets/site.js',
    'assets/editorial-clearing-v1.jpg',
    'assets/product/home.png',
  ]) await access(path.join(outputRoot, file))

  const home = await readOutput('index.html')
  assert.match(home, /<title>PlanGlade \| A quieter place for project work<\/title>/)
  assert.match(home, /Try the browser-local demo/)
  assert.match(home, /<main id="main">/)
  assert.match(home, /data-theme-toggle/)
})

test('built demo is a separate base-routed application artifact', async () => {
  const [site, demo] = await Promise.all([
    readOutput('index.html'),
    readOutput('demo/index.html'),
  ])

  assert.notEqual(site, demo)
  assert.match(demo, /(?:src|href)="\/demo\//)
  assert.doesNotMatch(demo, /Make room for work that matters/)
  assert.doesNotMatch(site, /id="root"/)
})

test('robots and sitemap keep sample demo content out of search', async () => {
  const [robots, sitemap] = await Promise.all([
    readOutput('robots.txt'),
    readOutput('sitemap.xml'),
  ])
  assert.match(robots, /Disallow: \/demo\//)
  assert.doesNotMatch(sitemap, /\/demo\/?<\/loc>/)
  assert.doesNotMatch(sitemap, /\/404\/<\/loc>/)
  assert.match(sitemap, /https:\/\/planglade\.com\/product\//)
})
