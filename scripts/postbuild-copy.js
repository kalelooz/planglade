/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")

function copyDir(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source directory: ${source}`)
  }
  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(source, destination, { recursive: true, force: true })
}

const root = process.cwd()
const staticSource = path.join(root, ".next", "static")
const staticDest = path.join(root, ".next", "standalone", ".next", "static")
const publicSource = path.join(root, "public")
const publicDest = path.join(root, ".next", "standalone", "public")

copyDir(staticSource, staticDest)
if (fs.existsSync(publicSource)) {
  copyDir(publicSource, publicDest)
}
