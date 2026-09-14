import assert from "node:assert/strict"
import test from "node:test"
import { PASSWORD_RESET_SUCCESS, validateNewPassword } from "../lib/password-recovery.ts"

test("uses the generic non-enumerating password reset confirmation", () => {
  assert.equal(
    PASSWORD_RESET_SUCCESS,
    "If an account exists for that email, a password reset link has been sent."
  )
})

test("enforces the shared password policy and confirmation", () => {
  assert.equal(validateNewPassword("short", "short"), "Password must be at least 12 characters.")
  assert.equal(validateNewPassword("            ", "            "), "Password cannot be blank or only spaces.")
  assert.equal(validateNewPassword("A-long-new-password!", "Different-password!"), "Passwords do not match.")
  assert.equal(validateNewPassword("A-long-new-password!", "A-long-new-password!"), null)
})
