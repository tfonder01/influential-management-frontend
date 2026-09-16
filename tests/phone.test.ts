import test from "node:test"
import assert from "node:assert/strict"
import { formatUsPhoneNumber, normalizeUsPhoneNumber } from "../lib/phone.ts"

test("formats a 10-digit US phone number", () => {
  assert.equal(formatUsPhoneNumber("4075550142"), "(407) 555-0142")
})

test("normalizes and formats pasted US phone numbers", () => {
  for (const value of ["407-555-0142", "(407)555-0142", "407 555 0142"]) {
    assert.equal(normalizeUsPhoneNumber(value), "4075550142")
    assert.equal(formatUsPhoneNumber(value), "(407) 555-0142")
  }
})

test("formats partial typing progressively", () => {
  assert.deepEqual(
    ["4", "40", "407", "4075", "407555", "4075550"].map(formatUsPhoneNumber),
    ["4", "40", "(407)", "(407) 5", "(407) 555", "(407) 555-0"]
  )
})

test("a fully formatted number backspaces continuously to empty", () => {
  const values = ["(898) 555-0142"]
  while (values.at(-1)) {
    const current = values.at(-1) ?? ""
    const next = formatUsPhoneNumber(current.slice(0, -1))
    assert.notEqual(next, current)
    values.push(next)
  }

  assert.deepEqual(values.slice(-5), ["(898)", "898", "89", "8", ""])
})

test("the area code can be deleted one digit at a time", () => {
  assert.equal(formatUsPhoneNumber("(898"), "898")
  assert.equal(formatUsPhoneNumber("89"), "89")
  assert.equal(formatUsPhoneNumber("8"), "8")
  assert.equal(formatUsPhoneNumber(""), "")
})

test("keeps an empty value empty", () => {
  assert.equal(formatUsPhoneNumber(""), "")
  assert.equal(normalizeUsPhoneNumber(""), "")
})

test("formats existing stored raw digits and normalizes a US country code", () => {
  assert.equal(formatUsPhoneNumber("4075550142"), "(407) 555-0142")
  assert.equal(formatUsPhoneNumber("1 (407) 555-0142"), "(407) 555-0142")
  assert.equal(normalizeUsPhoneNumber("1 (407) 555-0142"), "4075550142")
})

test("preserves unsupported legacy and excessive values without truncation", () => {
  assert.equal(formatUsPhoneNumber("sales@example.com"), "sales@example.com")
  assert.equal(normalizeUsPhoneNumber(" sales@example.com "), "sales@example.com")
  assert.equal(formatUsPhoneNumber("4075550142123"), "4075550142123")
  assert.equal(normalizeUsPhoneNumber("4075550142123"), "4075550142123")
})
