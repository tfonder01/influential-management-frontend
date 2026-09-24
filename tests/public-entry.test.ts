import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { rootRouteDecision } from "../lib/auth-navigation.ts"

const rootSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")
const loginSource = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8")

test("anonymous production visitors see the branded portal entry", () => {
  assert.equal(rootRouteDecision(true, "anonymous"), "public")
  assert.match(rootSource, /AuthBranding/)
  assert.match(rootSource, /Sign In/)
  assert.match(rootSource, /href="\/login"/)
  assert.match(rootSource, /mailto:support@sentrypointsystems\.com/)
  assert.match(rootSource, />\s*support@sentrypointsystems\.com\s*</)
})

test("authenticated and demo root visits preserve dashboard entry behavior", () => {
  assert.equal(rootRouteDecision(true, "loading"), "loading")
  assert.equal(rootRouteDecision(true, "authenticated"), "redirect")
  assert.equal(rootRouteDecision(false, "authenticated"), "redirect")
  assert.match(rootSource, /router\.replace\("\/dashboard"\)/)
})

test("login retains submission, recovery, and branding without duplicate support contact", () => {
  assert.match(loginSource, /onSubmit=\{submit\}/)
  assert.match(loginSource, /await login\(email, password\)/)
  assert.match(loginSource, /href="\/forgot-password"/)
  assert.match(loginSource, /AuthBranding/)
  assert.doesNotMatch(loginSource, /support@sentrypointsystems\.com|Contact support|Need help signing in/)
})
