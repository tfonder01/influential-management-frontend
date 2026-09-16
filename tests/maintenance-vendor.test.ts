import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const pageSource = readFileSync(
  new URL("../app/(app)/maintenance/[id]/page.tsx", import.meta.url),
  "utf8"
)
const mockDataSource = readFileSync(new URL("../lib/mock-data.ts", import.meta.url), "utf8")

test("existing vendor and contact values load into always-visible text fields", () => {
  assert.match(pageSource, /setVendor\(request\.vendor \?\? ""\)/)
  assert.match(pageSource, /setVendorContact\(formatUsPhoneNumber\(request\.vendorContact\)\)/)
  assert.match(pageSource, /<Input id="vendor" value=\{vendor\} onChange=\{\(event\) => setVendor\(event\.target\.value\)\}/)
  assert.match(pageSource, /<Input id="vendor-contact" type="tel" inputMode="tel"[^>]*onChange=\{\(event\) => setVendorContact\(formatUsPhoneNumber\(event\.target\.value\)\)\}/)
})

test("vendor and contact edits, including blank values, stay in the existing save paths", () => {
  assert.match(pageSource, /vendor: vendor \|\| undefined/)
  assert.match(pageSource, /vendorName: vendor \|\| undefined/)
  assert.match(pageSource, /vendorContact: normalizeUsPhoneNumber\(vendorContact\) \|\| undefined/)
  assert.match(pageSource, /updateProductionMaintenanceRequest\(id, \{/)
})

test("fake vendor presets and prototype helper text no longer render", () => {
  assert.doesNotMatch(pageSource, /MAINTENANCE_VENDOR_PRESETS/)
  assert.doesNotMatch(pageSource, /Other \/ Custom Vendor/)
  assert.doesNotMatch(pageSource, /Temporary configured presets/)
  assert.doesNotMatch(mockDataSource, /export const MAINTENANCE_VENDOR_PRESETS/)
})

test("Assigned To remains editable while Submitted By remains display-only", () => {
  assert.match(pageSource, /<Label htmlFor="assigned-user">Assigned To/)
  assert.match(pageSource, /<select id="assigned-user"[^>]*value=\{assignedUserId\}/)
  assert.match(pageSource, /assignedUserId: persistedAssignedUserId/)
  assert.match(pageSource, /Assign a portal user responsible for coordinating this request\./)
  assert.match(pageSource, /<Meta icon=\{User\} label="Submitted by">\{request\.submittedBy\}<\/Meta>/)
  assert.doesNotMatch(pageSource, /setSubmittedBy/)
})
