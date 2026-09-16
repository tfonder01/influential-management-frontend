import assert from "node:assert/strict"
import test from "node:test"
import {
  authenticatedDestination,
  loginHrefFor,
  protectedRouteDecision,
  safeInternalReturnTo,
} from "../lib/auth-navigation.ts"

test("protected navigation waits while session restoration is pending", () => {
  assert.equal(protectedRouteDecision(true, "loading"), "loading")
})

test("successful restoration keeps authenticated users on protected dynamic routes", () => {
  assert.equal(protectedRouteDecision(true, "authenticated"), "allow")
  assert.equal(safeInternalReturnTo("/maintenance/maintenance-id"), "/maintenance/maintenance-id")
  assert.equal(
    safeInternalReturnTo("/supply-requests/supply-id?tab=history"),
    "/supply-requests/supply-id?tab=history"
  )
})

test("failed restoration redirects to login with the requested protected route", () => {
  assert.equal(protectedRouteDecision(true, "anonymous"), "redirect")
  assert.equal(
    loginHrefFor("/records/record-id?tab=activity"),
    "/login?returnTo=%2Frecords%2Frecord-id%3Ftab%3Dactivity"
  )
})

test("successful login returns to a safe internal deep link", () => {
  assert.equal(
    authenticatedDestination("?returnTo=%2Fmaintenance%2Fmaintenance-id%3Ftab%3Dhistory"),
    "/maintenance/maintenance-id?tab=history"
  )
})

test("external and malformed return destinations are rejected", () => {
  for (const candidate of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\\\evil.example/steal",
    "/%2F%2Fevil.example/steal",
    "/%5C%5Cevil.example/steal",
    "javascript:alert(1)",
    "/login?returnTo=/maintenance/id",
  ]) {
    assert.equal(safeInternalReturnTo(candidate), null)
  }
  assert.equal(authenticatedDestination("?returnTo=https%3A%2F%2Fevil.example%2Fsteal"), "/dashboard")
})
