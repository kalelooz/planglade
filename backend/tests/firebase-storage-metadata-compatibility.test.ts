import assert from "node:assert/strict"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import test from "node:test"

test("Firebase Storage accepts valid Cloud Run metadata headers", async () => {
  const require = createRequire(import.meta.url)
  const storageRequire = createRequire(require.resolve("@google-cloud/storage"))
  const storageAuthRequire = createRequire(storageRequire.resolve("google-auth-library"))
  const metadata = require(storageAuthRequire.resolve("gcp-metadata")) as {
    instance: (property: string) => Promise<string>
    resetIsAvailableCache: () => void
  }
  const server = createServer((_request, response) => {
    response.setHeader("Metadata-Flavor", "Google")
    response.end("storage-signer@example.invalid")
  })
  const previousHost = process.env.GCE_METADATA_HOST

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })

  try {
    const address = server.address()
    assert(address && typeof address === "object")
    process.env.GCE_METADATA_HOST = `127.0.0.1:${address.port}`
    metadata.resetIsAvailableCache()

    assert.equal(
      await metadata.instance("service-accounts/default/email"),
      "storage-signer@example.invalid",
    )
  } finally {
    if (previousHost === undefined) delete process.env.GCE_METADATA_HOST
    else process.env.GCE_METADATA_HOST = previousHost
    metadata.resetIsAvailableCache()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
