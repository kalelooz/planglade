import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const publishableFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(existsSync)

const forbidden = [
  /(^|\/)(AGENTS|CLAUDE)\.md$/i,
  /(^|\/)(\.agents|\.codex|\.opencode|\.zscripts|\.playwright-mcp)(\/|$)/i,
  /(^|\/)(ROADMAP\.md|PRODUCT\.md)$/i,
  /(^|\/)(Reddit|artifacts)(\/|$)/i,
  /(^|\/)docs\/(Sources|audits|archive|superpowers|slices)(\/|$)/i,
  /(^|\/)(planglade-collaboration-foundation-plan\.md|planglade-marketing\.html)$/i,
  /(^|\/)Caddyfile$/i,
]

const exposed = publishableFiles.filter((file) => forbidden.some((pattern) => pattern.test(file)))
if (exposed.length > 0) {
  throw new Error(`Private or future-planning files are tracked:\n${exposed.join('\n')}`)
}

console.log(`Public boundary verified across ${publishableFiles.length} publishable files.`)
