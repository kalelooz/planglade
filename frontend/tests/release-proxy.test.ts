import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("release proxy resource boundaries", () => {
  it("caps ordinary JSON, permits bounded imports, and streams only binary uploads", async () => {
    const nginx = await readFile(
      path.join(process.cwd(), "deploy/default.conf.template"),
      "utf8"
    )

    expect(nginx).toMatch(/location = \/api\/attachments\/upload-binary\s*\{[\s\S]*?client_max_body_size 52m;[\s\S]*?proxy_request_buffering off;/)
    expect(nginx).toMatch(/location ~ \^\/api\/workspace\/import-\(local\|preview\)\$\s*\{[\s\S]*?client_max_body_size 8m;/)
    expect(nginx).toMatch(/location \/api\/\s*\{[\s\S]*?client_max_body_size 2m;/)
    expect(nginx.match(/proxy_request_buffering off;/g)).toHaveLength(1)
  })

  it("routes legacy /plans through the SPA for canonicalization", async () => {
    const nginx = await readFile(
      path.join(process.cwd(), "deploy/default.conf.template"),
      "utf8"
    )
    const spaLocation = nginx.match(/location ~ (\^\/\(\?:[^\n]+\)\$) \{([\s\S]*?)\n {2}\}/)

    expect(spaLocation).not.toBeNull()
    expect(new RegExp(spaLocation![1]).test("/plans")).toBe(true)
    expect(new RegExp(spaLocation![1]).test("/plans/extra")).toBe(false)
    expect(spaLocation![2]).toContain("try_files $uri /index.html;")
  })
})
