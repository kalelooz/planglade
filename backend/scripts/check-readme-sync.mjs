import { execSync } from "node:child_process"

function run(command) {
  return execSync(command, { encoding: "utf8" }).trim()
}

function getChangedFiles(baseRef, headRef) {
  const output = run(`git diff --name-only ${baseRef} ${headRef}`)
  if (!output) return []
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function isAllZeros(value) {
  return /^0+$/.test(value)
}

const baseRef = process.env.README_BASE_REF
const headRef = process.env.README_HEAD_REF || "HEAD"

if (!baseRef) {
  console.error("README sync check skipped: README_BASE_REF is missing.")
  process.exit(0)
}

if (isAllZeros(baseRef)) {
  console.error("README sync check skipped: base ref is an all-zero SHA (new branch push event).")
  process.exit(0)
}

let changedFiles = []
try {
  changedFiles = getChangedFiles(baseRef, headRef)
} catch (error) {
  console.error(`README sync check failed to compute git diff: ${String(error)}`)
  process.exit(1)
}

if (changedFiles.length === 0) {
  process.exit(0)
}

const readmeChanged = changedFiles.includes("README.md")

const pathsThatRequireReadmeUpdate = [
  "src/",
  "prisma/",
  "package.json",
  "apphosting.yaml",
  "next.config.ts",
  ".github/workflows/",
]

const touchedTrackedSurface = changedFiles.some((file) =>
  pathsThatRequireReadmeUpdate.some((path) => file === path || file.startsWith(path))
)

if (touchedTrackedSurface && !readmeChanged) {
  console.error("README freshness gate failed.")
  console.error("You changed product/runtime surface files but did not update README.md.")
  console.error("Changed files:")
  for (const file of changedFiles) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}

process.exit(0)
