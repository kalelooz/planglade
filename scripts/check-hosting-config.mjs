import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const frontendPackage = JSON.parse(await readFile(new URL('../frontend/package.json', import.meta.url), 'utf8'))
const netlify = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8')

assert.equal(rootPackage.scripts['check:hosting'], 'node scripts/check-hosting-config.mjs')
assert.equal(frontendPackage.scripts['build:reference'], 'tsc -b && vite build --mode reference')

for (const required of [
  'base = "frontend"',
  'command = "npm run build:reference"',
  'publish = "dist"',
  'from = "/*"',
  'to = "/index.html"',
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
]) {
  assert.ok(netlify.includes(required), `netlify.toml is missing ${required}`)
}

console.log('Netlify is pinned to the new reference frontend with SPA routing and security headers.')
