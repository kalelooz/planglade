import { defineConfig } from "@playwright/test"
import path from "node:path"

process.env.PLANGLADE_BROWSER_SETUP_UI = "true"

const baseURL = "https://127.0.0.1:3100"
const databaseUrl = `file:${path.resolve("test-results", "browser-setup.db").replaceAll("\\", "/")}`

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "setup.spec.ts",
  outputDir: "test-results/playwright",
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/validate-auth-config.mjs && node tests/browser/prepare-setup-db.mjs && node node_modules/next/dist/bin/next build && node scripts/postbuild-copy.js && node tests/browser/https-proxy.mjs",
    url: `${baseURL}/`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      PORT: "3100",
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      PLANGLADE_AUTH_MODE: "nextauth",
      NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
      NEXTAUTH_SECRET: "browser-setup-only-secret-not-for-production",
      NEXTAUTH_URL: baseURL,
      PLANGLADE_LOCAL_AUTH_ENABLED: "true",
      PLANGLADE_SETUP_TOKEN: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      PLANGLADE_STORAGE_PROVIDER: "local",
      PLANGLADE_STORAGE_SIGNING_SECRET: "browser-setup-storage-secret-not-for-production",
      PLANGLADE_LOCAL_STORAGE_DIR: "test-results/browser-setup-attachments",
      PLANGLADE_EMAIL_PROVIDER: "disabled",
    },
  },
})
