import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, sep } from "node:path"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const runtimeDependencies = [
  "@prisma/client",
  "firebase-admin",
  "next",
  "next-auth",
  "react",
  "react-dom",
  "sharp",
  "zod",
]

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : []
  })
}

function resolveLocalImport(from, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null
  const base = specifier.startsWith("@/")
    ? join(root, "src", specifier.slice(2))
    : join(dirname(from), specifier)
  for (const candidate of [base, ...[".ts", ".tsx", ".mts", ".mjs", ".js"].map((extension) => `${base}${extension}`)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  for (const extension of [".ts", ".tsx", ".mts", ".mjs", ".js"]) {
    const candidate = join(base, `index${extension}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

assert.deepEqual(Object.keys(packageJson.dependencies).sort(), runtimeDependencies)
assert.equal(packageJson.dependencies.next, packageJson.devDependencies["eslint-config-next"])
assert.equal(packageJson.dependencies.react, packageJson.dependencies["react-dom"])
assert.equal(packageJson.engines.node, ">=20.9.0")
assert.equal(packageJson.packageManager, "npm@11.6.2")

assert.deepEqual(readdirSync(join(root, "src", "app")).sort(), ["api", "layout.tsx"])
for (const retiredPath of ["src/components", "src/hooks", "public", "Caddyfile"]) {
  assert.equal(existsSync(join(root, retiredPath)), false, `${retiredPath} must stay out of the API backend`)
}

const sources = sourceFiles(join(root, "src")).filter((path) => !/\.d\.[cm]?ts$/.test(path))
const roots = sources.filter((path) => {
  const repositoryPath = relative(root, path).split(sep).join("/")
  return repositoryPath.startsWith("src/app/") || repositoryPath === "src/proxy.ts"
})
const reachable = new Set(roots)
const pending = [...roots]
const importPattern = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g
while (pending.length > 0) {
  const file = pending.pop()
  for (const match of readFileSync(file, "utf8").matchAll(importPattern)) {
    const dependency = resolveLocalImport(file, match[1])
    if (dependency && !reachable.has(dependency)) {
      reachable.add(dependency)
      pending.push(dependency)
    }
  }
}
const orphanedSources = sources.filter((path) => !reachable.has(path)).map((path) => path.slice(root.length + 1))
assert.deepEqual(orphanedSources, [], `Unreachable backend source files: ${orphanedSources.join(", ")}`)

console.log("Backend dependency and API-only surface check passed.")
