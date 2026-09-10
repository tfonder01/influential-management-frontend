import assert from "node:assert/strict"
import test from "node:test"

import {
  sentryDataCollection,
  sentryEnvironment,
  sentryRelease,
  sentryTracesSampleRate,
} from "../lib/sentry.ts"

test.afterEach(() => {
  delete process.env.NEXT_PUBLIC_SENTRY_DSN
  delete process.env.SENTRY_ENVIRONMENT
  delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT
  delete process.env.NEXT_PUBLIC_SENTRY_RELEASE
  delete process.env.SENTRY_RELEASE
  delete process.env.VERCEL_GIT_COMMIT_SHA
  delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
})

test("accepts only supported sentry environments", () => {
  process.env.SENTRY_ENVIRONMENT = "stg"
  assert.equal(sentryEnvironment(), "stg")

  process.env.SENTRY_ENVIRONMENT = "prd"
  assert.equal(sentryEnvironment(), "prd")

  process.env.SENTRY_ENVIRONMENT = "production"
  assert.equal(sentryEnvironment(), undefined)
})

test("uses commit metadata for release when explicit value is absent", () => {
  delete process.env.NEXT_PUBLIC_SENTRY_RELEASE
  process.env.SENTRY_RELEASE = ""
  process.env.VERCEL_GIT_COMMIT_SHA = "abc123"
  assert.equal(sentryRelease(), "abc123")
})

test("keeps tracing conservative and privacy defaults disabled", () => {
  process.env.SENTRY_ENVIRONMENT = "stg"
  assert.equal(sentryTracesSampleRate(), 0.05)

  process.env.SENTRY_ENVIRONMENT = "prd"
  assert.equal(sentryTracesSampleRate(), 0.02)

  const dataCollection = sentryDataCollection()
  assert.equal(dataCollection.userInfo, false)
  assert.equal(dataCollection.cookies, false)
  assert.deepEqual(dataCollection.httpHeaders, { request: false, response: false })
  assert.deepEqual(dataCollection.httpBodies, [])
  assert.equal(dataCollection.urlQueryParams, false)
})
