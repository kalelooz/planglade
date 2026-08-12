import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const frontendPackage = JSON.parse(await readFile(new URL('../frontend/package.json', import.meta.url), 'utf8'))
const netlify = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8')
const expectedCsp = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'"

function arrayTableBlocks(source, name) {
  return source
    .split(/(?=^\s*\[\[[^\]]+\]\]\s*$)/m)
    .filter((block) => new RegExp(`^\\s*\\[\\[${name}\\]\\]\\s*$`, 'm').test(block))
}

function tableBlock(source, name) {
  return source
    .split(/(?=^\s*\[(?!\[)[^\]]+\]\s*$)/m)
    .find((block) => new RegExp(`^\\s*\\[${name}\\]\\s*$`, 'm').test(block))
}

function assignment(block, key) {
  const match = block?.match(new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"]*)"|(\\d+))\\s*$`, 'm'))
  return match?.[1] ?? match?.[2]
}

function hasRedirect(source, from, to, status) {
  return arrayTableBlocks(source, 'redirects').some((block) =>
    assignment(block, 'from') === from
    && assignment(block, 'to') === to
    && assignment(block, 'status') === String(status)
  )
}

function validateNetlifyRules(source) {
  const build = tableBlock(source, 'build')
  assert.ok(build, 'netlify.toml must contain a build table')
  assert.equal(
    assignment(build, 'command'),
    'npm ci --prefix frontend && npm run check:site && npm run build:site && npm run check:site-output',
  )
  assert.equal(assignment(build, 'publish'), 'website/dist')
  assert.equal(assignment(build, 'base'), undefined, 'Netlify must build from the repository root')

  assert.ok(hasRedirect(source, '/landing', '/', 301), 'legacy /landing must redirect to the site root')
  assert.ok(hasRedirect(source, '/demo', '/demo/', 301), '/demo must use its mounted directory')
  assert.ok(hasRedirect(source, '/demo/*', '/demo/index.html', 200), 'demo routes must stay inside the demo artifact')
  assert.equal(hasRedirect(source, '/*', '/index.html', 200), false, 'the core SPA must never own the site root')

  const headers = arrayTableBlocks(source, 'headers').find((block) => assignment(block, 'for') === '/*')
  assert.ok(headers, 'netlify.toml must contain a /* response-header rule')
  assert.equal(assignment(headers, 'Content-Security-Policy'), expectedCsp)
  assert.equal(assignment(headers, 'X-Content-Type-Options'), 'nosniff')
  assert.equal(assignment(headers, 'X-Frame-Options'), 'DENY')

  const demoHeaders = arrayTableBlocks(source, 'headers').find((block) => assignment(block, 'for') === '/demo/*')
  assert.ok(demoHeaders, 'netlify.toml must mark the demo as noindex')
  assert.equal(assignment(demoHeaders, 'X-Robots-Tag'), 'noindex, nofollow')
}

assert.equal(rootPackage.scripts['check:hosting'], 'node scripts/check-hosting-config.mjs')
assert.equal(rootPackage.scripts['build:site'], 'npm run build:demo --prefix frontend && npm run build:website')
assert.equal(frontendPackage.scripts['build:reference'], 'tsc -b && vite build --mode reference')
assert.equal(frontendPackage.scripts['build:demo'], 'tsc -b && vite build --mode reference --base /demo/ --outDir dist-demo')

validateNetlifyRules(netlify)
assert.throws(() => validateNetlifyRules(netlify.replace('publish = "website/dist"', 'publish = "frontend/dist"')))
assert.throws(() => validateNetlifyRules(netlify.replace('from = "/demo/*"', 'from = "/*"')))
assert.throws(() => validateNetlifyRules(netlify.replace('X-Content-Type-Options = "nosniff"', 'X-Content-Type-Options = "sniff"')))

console.log('Netlify publishes the marketing site root and mounts the separately compiled demo at /demo.')
