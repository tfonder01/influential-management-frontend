import assert from "node:assert/strict"
import test from "node:test"
import { resolveApiUrl } from "../lib/api-origin.ts"

test("preserves the configured production API origin on a different frontend hostname", () => {
  assert.equal(
    resolveApiUrl("https://influential-api.onrender.com", "influential-app.vercel.app"),
    "https://influential-api.onrender.com"
  )
})

test("reconciles only the supported local loopback hostnames", () => {
  assert.equal(resolveApiUrl("http://localhost:8080", "127.0.0.1"), "http://127.0.0.1:8080")
  assert.equal(resolveApiUrl("http://127.0.0.1:8080", "localhost"), "http://localhost:8080")
})
