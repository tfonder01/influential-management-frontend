import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { ONBOARDING_VERSIONS, onboardingAudienceFor, onboardingSteps, shouldAutoPrompt, shouldPersistOnboarding, tourTargetForHref } from "../lib/onboarding.ts"
import { isRectInsideViewport, TOUR_VIEWPORT_MARGIN } from "../lib/onboarding-positioning.ts"

test("automatic prompts and persistence are limited to authenticated mode", () => {
  assert.equal(shouldAutoPrompt(false, true), true)
  assert.equal(shouldAutoPrompt(false, false), false)
  assert.equal(shouldAutoPrompt(true, true), false)
  assert.equal(shouldPersistOnboarding(false), true)
  assert.equal(shouldPersistOnboarding(true), false)
})

test("role-aware tours expose the approved workspaces", () => {
  const prepare = async () => undefined
  assert.deepEqual(onboardingSteps("OWNER", prepare).map((step) => step.id), [
    "dashboard-overview", "needs-review-overview", "locations-overview", "users-overview", "settings-overview", "support-entry",
  ])
  assert.deepEqual(onboardingSteps("LOCATION_STAFF", prepare).map((step) => step.id), [
    "dashboard-overview", "compliance-overview", "operations-overview", "maintenance-overview", "supply-requests-overview", "activity-overview", "support-entry",
  ])
  assert.equal(onboardingAudienceFor("owner"), "OWNER")
  assert.equal(onboardingAudienceFor("director"), "LOCATION_STAFF")
  assert.equal(onboardingAudienceFor("assistant_director"), "LOCATION_STAFF")
  assert.equal(ONBOARDING_VERSIONS.OWNER, 1)
  assert.equal(ONBOARDING_VERSIONS.LOCATION_STAFF, 1)
})

test("every tour target is backed by a stable semantic hook", () => {
  assert.equal(tourTargetForHref("/dashboard"), "dashboard-overview")
  assert.equal(tourTargetForHref("/needs-review"), "needs-review-overview")
  assert.equal(tourTargetForHref("/locations"), "locations-overview")
  assert.equal(tourTargetForHref("/admin/users"), "users-overview")
  assert.equal(tourTargetForHref("/settings"), "settings-overview")
  assert.equal(tourTargetForHref("/records"), "compliance-overview")
  assert.equal(tourTargetForHref("/operations"), "operations-overview")
  assert.equal(tourTargetForHref("/maintenance"), "maintenance-overview")
  assert.equal(tourTargetForHref("/supply-requests"), "supply-requests-overview")
  assert.equal(tourTargetForHref("/activity"), "activity-overview")

  const topbarSource = readFileSync(new URL("../components/topbar.tsx", import.meta.url), "utf8")
  const sidebarSource = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
  assert.match(topbarSource, /data-tour=\{tourTargetForHref\(navigation\.activeHref\)\}/)
  assert.match(sidebarSource, /data-tour="support-entry"/)
})

test("workspace steps prefer bottom placement and viewport bounds retain a margin", () => {
  const steps = onboardingSteps("OWNER", async () => undefined)
  assert.deepEqual(steps.slice(0, -1).map((step) => step.placement), Array(5).fill("bottom"))
  assert.equal(steps.at(-1)?.placement, "right")

  const viewport = { width: 390, height: 844 }
  assert.equal(isRectInsideViewport({ top: 16, right: 374, bottom: 828, left: 16, width: 358, height: 812 }, viewport, TOUR_VIEWPORT_MARGIN), true)
  assert.equal(isRectInsideViewport({ top: -1, right: 374, bottom: 200, left: 16, width: 358, height: 201 }, viewport, TOUR_VIEWPORT_MARGIN), false)
  assert.equal(isRectInsideViewport({ top: 16, right: 391, bottom: 200, left: 16, width: 375, height: 184 }, viewport, TOUR_VIEWPORT_MARGIN), false)
})

test("demo preview is explicit and production persistence remains centralized", () => {
  const supportSource = readFileSync(new URL("../components/support-dialog.tsx", import.meta.url), "utf8")
  const providerSource = readFileSync(new URL("../components/onboarding-provider.tsx", import.meta.url), "utf8")
  assert.match(supportSource, /Preview walkthrough/)
  assert.match(supportSource, /Demo mode does not send support requests or save walkthrough progress/)
  assert.match(providerSource, /if \(!shouldPersistOnboarding\(isDemoMode\)\) return/)
  assert.doesNotMatch(providerSource, /localStorage|sessionStorage/)
})
