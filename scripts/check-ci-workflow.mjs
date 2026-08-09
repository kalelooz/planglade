import { readFile } from 'node:fs/promises'

const workflowPath = new URL('../.github/workflows/ci.yml', import.meta.url)
const workflow = await readFile(workflowPath, 'utf8')

const requiredCommands = [
  'npm run check:public',
  'npm run check:ci',
  'npm run check:docs',
  'npm run check:hosting',
  'npm run check:release',
  'npm run check:backend-surface --prefix backend',
  'npm run lint',
  'npm run typecheck',
  'npm run db:migrate:deploy --prefix backend',
  'npm run test:release',
  'npm test',
  'npm run build',
  'npm exec --prefix backend -- prisma validate --schema backend/prisma/schema.prisma',
  'npm run test:e2e:integration --prefix frontend',
]

for (const command of requiredCommands) {
  if (!workflow.includes(command)) throw new Error(`CI workflow is missing required command: ${command}`)
}

if (!/^permissions:\s*\n\s+contents: read$/m.test(workflow)) {
  throw new Error('CI workflow must declare read-only repository contents permission')
}
if (/pull_request_target:/.test(workflow)) {
  throw new Error('CI workflow must not execute pull_request_target code')
}

const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1])
if (actionReferences.length === 0) throw new Error('CI workflow must use pinned GitHub Actions')
for (const reference of actionReferences) {
  if (!/@[0-9a-f]{40}$/.test(reference)) {
    throw new Error(`GitHub Action must be pinned to a full commit SHA: ${reference}`)
  }
}

console.log(`CI workflow verified with ${requiredCommands.length} required commands and ${actionReferences.length} pinned action references.`)
