import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import type { BrowserContext, Route } from "@playwright/test"
import { stagingBackendUrl, stagingBaseUrl, stagingMailMode } from "../e2e/support/env.ts"
import { guardStagingContext } from "../e2e/support/staging-guard.ts"

const frontend = "https://portal-stg.example.test"
const backend = "https://approved-api.example.test"

function withOrigins(t: TestContext) {
  const variables = {
    PLAYWRIGHT_BASE_URL: frontend,
    PLAYWRIGHT_BACKEND_URL: backend,
    PLAYWRIGHT_APPROVED_STAGING_ORIGINS: `${frontend},${backend}`,
  }
  for (const [key, value] of Object.entries(variables)) {
    const previous = process.env[key]
    process.env[key] = value
    t.after(() => {
      if (previous === undefined) delete process.env[key]
      else process.env[key] = previous
    })
  }
}

test("staging mail defaults to direct setup links and accepts explicit capture", (t) => {
  const key = "PLAYWRIGHT_STAGING_MAIL_MODE"
  const previous = process.env[key]
  t.after(() => {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  })

  delete process.env[key]
  assert.equal(stagingMailMode(), "disabled")
  process.env[key] = "capture"
  assert.equal(stagingMailMode(), "capture")
  process.env[key] = "unknown"
  assert.throws(stagingMailMode)
})

test("staging config pins both exact origins", (t) => {
  withOrigins(t)
  assert.equal(stagingBaseUrl(), frontend)
  assert.equal(stagingBackendUrl(), backend)
  for (const url of ["https://production.example.test", backend + "/api", backend + "?token=value", "http://approved-api.example.test"]) {
    process.env.PLAYWRIGHT_BACKEND_URL = url
    assert.throws(stagingBackendUrl)
  }
})

test("browser guard blocks credentials to other origins and aborts API redirects", async (t) => {
  withOrigins(t)
  let handler!: (route: Route) => Promise<void>
  const context = { route: async (_glob: string, callback: typeof handler) => { handler = callback } } as unknown as BrowserContext
  await guardStagingContext(context)
  for (const [url, status, expected] of [
    ["https://production.example.test/api/auth/login", 200, ["abort"]],
    [backend + "/api/auth/login", 302, ["fetch", "abort", "dispose"]],
    [backend + "/api/auth/me", 200, ["fetch", "fulfill", "dispose"]],
  ] as const) {
    const calls: string[] = []
    const route = {
      request: () => ({ url: () => url, headers: () => ({}) }),
      abort: async () => { calls.push("abort") },
      fetch: async (options: { maxRedirects: number }) => {
        assert.equal(options.maxRedirects, 0)
        calls.push("fetch")
        return {
          status: () => status,
          headers: () => status === 302 ? { location: "https://production.example.test" } : {},
          dispose: async () => { calls.push("dispose") },
        }
      },
      fulfill: async () => { calls.push("fulfill") },
    } as unknown as Route
    await handler(route)
    assert.deepEqual(calls, expected)
  }
})
