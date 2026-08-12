import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = await readFile(path.join(websiteRoot, 'src', 'styles.css'), 'utf8')

function themeTokens(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1]
  assert.ok(body, `Missing ${selector} color tokens`)
  return Object.fromEntries(
    [...body.matchAll(/(--[a-z-]+):\s*(oklch\([^;]+\));/g)].map((match) => [match[1], match[2]]),
  )
}

function parseOklch(value) {
  const match = value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/)
  assert.ok(match, `Unsupported color: ${value}`)
  return match.slice(1).map(Number)
}

function luminance(value) {
  const [lightness, chroma, hue] = parseOklch(value)
  const radians = hue * Math.PI / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.max(0, Math.min(1, channel)))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

test('primary text, secondary text, and accent text meet AA in both appearances', () => {
  const themes = {
    light: themeTokens(':root'),
    dark: themeTokens('html[data-theme="dark"]'),
  }
  for (const [name, tokens] of Object.entries(themes)) {
    assert.ok(contrast(tokens['--ink'], tokens['--canvas']) >= 7, `${name} primary text must meet AAA`)
    assert.ok(contrast(tokens['--ink-soft'], tokens['--canvas']) >= 4.5, `${name} secondary text must meet AA`)
    assert.ok(contrast(tokens['--accent'], tokens['--canvas']) >= 4.5, `${name} accent text must meet AA`)
  }
})
