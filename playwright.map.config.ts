import { defineConfig } from "@playwright/test"
import path from "node:path"

process.env.PLANGLADE_BROWSER_MAP_UI = "true"

const baseURL = "http://127.0.0.1:3200"
const databaseUrl = `file:${path.resolve("test-results", "browser-map.db").replaceAll("\\", "/")}`

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "map-production.spec.ts",
  outputDir: "test-results/playwright-map",
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "node tests/browser/start-map-server.mjs",
    url: `${baseURL}/api/auth/session`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PLANGLADE_AUTH_MODE: "dev",
      NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "dev",
      PLANGLADE_STORAGE_PROVIDER: "local",
      PLANGLADE_STORAGE_SIGNING_SECRET: "browser-map-storage-secret-not-for-production",
      PLANGLADE_LOCAL_STORAGE_DIR: "test-results/browser-map-attachments",
      PLANGLADE_EMAIL_PROVIDER: "disabled",
    },
  },
})
