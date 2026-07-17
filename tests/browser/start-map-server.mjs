import { createRequire } from "node:module"

await import("./prepare-map-db.mjs")

process.argv = [process.execPath, "next", "dev", "-H", "127.0.0.1", "-p", "3200"]
createRequire(import.meta.url)("next/dist/bin/next")
