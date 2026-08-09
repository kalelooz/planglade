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

function assignment(block, key) {
  const match = block.match(new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"]*)"|(\\d+))\\s*$`, 'm'))
  return match?.[1] ?? match?.[2]
}

function validateNetlifyRules(source) {
  const redirect = arrayTableBlocks(source, 'redirects').find((block) =>
    assignment(block, 'from') === '/*'
    && assignment(block, 'to') === '/index.html'
    && assignment(block, 'status') === '200'
  )
  assert.ok(redirect, 'netlify.toml must contain one SPA redirect from /* to /index.html with status 200')

  const headers = arrayTableBlocks(source, 'headers').find((block) => assignment(block, 'for') === '/*')
  assert.ok(headers, 'netlify.toml must contain a /* response-header rule')
  assert.equal(assignment(headers, 'Content-Security-Policy'), expectedCsp)
  assert.equal(assignment(headers, 'X-Content-Type-Options'), 'nosniff')
  assert.equal(assignment(headers, 'X-Frame-Options'), 'DENY')
}

assert.equal(rootPackage.scripts['check:hosting'], 'node scripts/check-hosting-config.mjs')
assert.equal(frontendPackage.scripts['build:reference'], 'tsc -b && vite build --mode reference')

for (const required of [
  'base = "frontend"',
  'command = "npm run build:reference"',
  'publish = "dist"',
]) {
  assert.ok(netlify.includes(required), `netlify.toml is missing ${required}`)
}
validateNetlifyRules(netlify)
assert.throws(() => validateNetlifyRules(netlify.replace('status = 200', 'status = 301')))
assert.throws(() => validateNetlifyRules(netlify.replace('X-Content-Type-Options = "nosniff"', 'X-Content-Type-Options = "sniff"')))

console.log('Netlify is pinned to the new reference frontend with SPA routing and security headers.')
