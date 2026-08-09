import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'integration.pw.ts',
  globalSetup: './e2e/integration.setup.ts',
  outputDir: 'test-results/vite-integration',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLANGLADE_E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    browserName: 'chromium',
    storageState: process.env.PLANGLADE_E2E_STORAGE_STATE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
