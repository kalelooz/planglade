import { defineConfig } from "@playwright/test"

const baseURL = "https://127.0.0.1:3100"

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run build && node tests/browser/https-proxy.mjs",
    url: `${baseURL}/`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...process.env,
      PORT: "3100",
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: "file:../test-results/browser-smoke.db",
      PLANGLADE_AUTH_MODE: "nextauth",
      NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
      NEXTAUTH_SECRET: "browser-smoke-only-secret-not-for-production",
      NEXTAUTH_URL: baseURL,
      PLANGLADE_STORAGE_PROVIDER: "local",
      PLANGLADE_STORAGE_SIGNING_SECRET: "browser-smoke-storage-secret-not-for-production",
      PLANGLADE_LOCAL_STORAGE_DIR: "test-results/browser-smoke-attachments",
      PLANGLADE_EMAIL_PROVIDER: "disabled",
    },
  },
})
