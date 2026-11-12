import { defineConfig, devices } from "@playwright/test"

// Isolated local UI regression suite. Every /api request is fulfilled by test fixtures.
export default defineConfig({
  testDir: "./e2e/local", fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 10_000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], channel: "chrome", baseURL: "http://127.0.0.1:3018", headless: true,
    screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3018",
    url: "http://127.0.0.1:3018/login", reuseExistingServer: false, timeout: 120_000,
    env: { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_APP_MODE: "production", NEXT_PUBLIC_API_URL: "http://127.0.0.1:3018" },
  },
})
