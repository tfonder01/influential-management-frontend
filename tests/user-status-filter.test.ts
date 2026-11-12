import test from "node:test"
import assert from "node:assert/strict"
import { USER_STATUS_FILTERS, statusesForFilter, matchesUserStatus, userStatusEmptyMessage } from "../lib/user-status-filter.ts"
test("status filters have the approved order and default excludes disabled", () => {
  assert.deepEqual(USER_STATUS_FILTERS.map((filter) => filter.label), ["Active & Invited", "All Users", "Active", "Invited", "Disabled"])
  assert.deepEqual(statusesForFilter("current"), ["ACTIVE", "INVITED"])
  assert(!matchesUserStatus("DISABLED", "current")); assert(matchesUserStatus("INVITED", "current"))
})
test("all and individual filters match only their intended statuses", () => {
  for (const status of ["ACTIVE", "INVITED", "DISABLED"] as const) {
    assert(matchesUserStatus(status, "all"))
    for (const filter of ["active", "invited", "disabled"] as const) assert.equal(matchesUserStatus(status, filter), status.toLowerCase() === filter)
  }
  assert.equal(userStatusEmptyMessage("disabled"), "No disabled users found")
})
