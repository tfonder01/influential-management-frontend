import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { rootRouteDecision } from "../lib/auth-navigation.ts"

const rootSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
const loginSource = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8")

test("anonymous production visitors are routed to the polished login entry", () => {
  assert.equal(rootRouteDecision(true, "anonymous"), "login")
  assert.match(rootSource, /router\.replace\("\/login"\)/)
  assert.match(loginSource, /Compliance Records/)
  assert.match(loginSource, /Maintenance & Supplies/)
  assert.match(loginSource, /Multi-Location Visibility/)
})

test("authenticated and demo root visits preserve dashboard entry behavior", () => {
  assert.equal(rootRouteDecision(true, "loading"), "loading")
  assert.equal(rootRouteDecision(true, "authenticated"), "dashboard")
  assert.equal(rootRouteDecision(false, "authenticated"), "dashboard")
  assert.match(rootSource, /router\.replace\("\/dashboard"\)/)
})

test("login retains submission, recovery, branding, and one support contact", () => {
  assert.match(loginSource, /onSubmit=\{submit\}/)
  assert.match(loginSource, /await login\(email, password\)/)
  assert.match(loginSource, /href="\/forgot-password"/)
  assert.match(loginSource, /AuthBranding/)
  assert.equal(loginSource.match(/mailto:support@sentrypointsystems\.com/g)?.length, 1)
})
