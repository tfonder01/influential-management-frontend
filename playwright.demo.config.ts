import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e/demo",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3017",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3017",
    url: "http://127.0.0.1:3017/dashboard",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_MODE: "demo",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:8080",
    },
  },
})
