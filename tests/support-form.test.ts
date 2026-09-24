import assert from "node:assert/strict"
import test from "node:test"
import {
  inferSupportLocationId,
  initialSupportFormState,
  supportFormReducer,
  supportMessageError,
} from "../lib/support-form.ts"

test("support dialog opens, closes, and changes submission type", () => {
  const opened = supportFormReducer(initialSupportFormState, { type: "OPEN" })
  assert.equal(opened.open, true)

  const feature = supportFormReducer(opened, {
    type: "SET_SUBMISSION_TYPE",
    value: "FEATURE_SUGGESTION",
  })
  assert.equal(feature.type, "FEATURE_SUGGESTION")

  assert.deepEqual(supportFormReducer(feature, { type: "CLOSE" }), initialSupportFormState)
})

test("message validation rejects blank and oversized submissions", () => {
  assert.equal(supportMessageError("   "), "Tell us how we can help.")
  assert.equal(supportMessageError("x".repeat(5001)), "Keep your message under 5,000 characters.")
  assert.equal(supportMessageError("A useful description"), null)
})

test("message validation accepts normal, long, unbroken, and maximum-length content", () => {
  const normalSentence = "The save button did not respond after I updated the maintenance request."
  const longProse = "The portal should keep this normal prose wrapped within the support dialog. ".repeat(9)
  const unbroken = "x".repeat(500)
  const maximum = "m".repeat(5000)

  assert.equal(supportMessageError(normalSentence), null)
  assert.ok(longProse.length > 500)
  assert.equal(supportMessageError(longProse), null)
  assert.equal(supportMessageError(unbroken), null)
  assert.equal(supportMessageError(maximum), null)
})

test("failed submission retains the typed message and permits retry", () => {
  const typed = supportFormReducer(
    supportFormReducer(initialSupportFormState, { type: "OPEN" }),
    { type: "SET_MESSAGE", value: "Please keep this message" }
  )
  const submitting = supportFormReducer(typed, { type: "SUBMIT_START" })
  const failed = supportFormReducer(submitting, {
    type: "SUBMIT_FAILURE",
    error: "Please try again.",
  })

  assert.equal(failed.message, "Please keep this message")
  assert.equal(failed.status, "idle")
  assert.equal(failed.error, "Please try again.")
  assert.equal(supportFormReducer(failed, { type: "SUBMIT_START" }).status, "submitting")
})

test("successful submission enters the confirmation state", () => {
  const submitting = supportFormReducer(
    { ...initialSupportFormState, open: true, message: "An idea", status: "submitting" },
    { type: "SUBMIT_SUCCESS" }
  )
  assert.equal(submitting.status, "success")
  assert.equal(submitting.open, true)
})

test("location context is sent only when a single accessible location is unambiguous", () => {
  assert.equal(inferSupportLocationId([{ id: "one" }]), "one")
  assert.equal(inferSupportLocationId([]), undefined)
  assert.equal(inferSupportLocationId([{ id: "one" }, { id: "two" }]), undefined)
})
