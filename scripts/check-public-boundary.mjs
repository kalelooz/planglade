import { execFileSync } from 'node:child_process'

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const forbidden = [
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)(\.agents|\.codex|\.opencode|\.zscripts|\.playwright-mcp)(\/|$)/i,
  /(^|\/)(ROADMAP\.md|PRODUCT\.md)$/i,
  /(^|\/)(Reddit|artifacts)(\/|$)/i,
  /(^|\/)docs\/(Sources|audits|archive|superpowers|slices)(\/|$)/i,
  /(^|\/)(flowboard-collaboration-foundation-plan\.md|flowboard-marketing\.html)$/i,
]

const exposed = tracked.filter((file) => forbidden.some((pattern) => pattern.test(file)))
if (exposed.length > 0) {
  throw new Error(`Private or future-planning files are tracked:\n${exposed.join('\n')}`)
}

console.log(`Public boundary verified across ${tracked.length} tracked files.`)
