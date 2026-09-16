import assert from "node:assert/strict"
import test from "node:test"
import { operationalEmailPreferencePayload } from "../lib/user-preferences.ts"

test("serializes only the authenticated user's operational email preference", () => {
  assert.deepEqual(operationalEmailPreferencePayload(false), {
    operationalEmailNotificationsEnabled: false,
  })
})
