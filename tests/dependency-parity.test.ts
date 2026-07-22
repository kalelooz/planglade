import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")

async function json(relativePath: string) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8")) as Record<string, any>
}

test("React and React DOM stay on one exact installed version", async () => {
  const [manifest, lockfile, reactPackage, reactDomPackage] = await Promise.all([
    json("package.json"),
    json("package-lock.json"),
    json("node_modules/react/package.json"),
    json("node_modules/react-dom/package.json"),
  ])
  const declaredReact = manifest.dependencies.react
  const declaredReactDom = manifest.dependencies["react-dom"]
  const lockedReact = lockfile.packages["node_modules/react"].version
  const lockedReactDom = lockfile.packages["node_modules/react-dom"].version

  assert.equal(typeof declaredReact, "string")
  assert.equal(typeof declaredReactDom, "string")
  assert.match(declaredReact, /^\d+\.\d+\.\d+$/)
  assert.equal(declaredReactDom, declaredReact)
  assert.equal(lockedReact, declaredReact)
  assert.equal(lockedReactDom, declaredReact)
  assert.equal(reactPackage.version, declaredReact)
  assert.equal(reactDomPackage.version, declaredReact)
})
