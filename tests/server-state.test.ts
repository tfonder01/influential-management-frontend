import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { mergeMaintenanceSummaries, preferNewestServerState, upsertMaintenanceDetail } from "../lib/server-state.ts"
import type { MaintenanceRequest } from "../lib/types.ts"

const storeSource = readFileSync(new URL("../lib/store.tsx", import.meta.url), "utf8")

test("a slower list response cannot overwrite newer mutation state", () => {
  const mutation = { id: "maintenance-1", lastUpdated: "2026-09-24T14:00:01Z", status: "APPROVED_READY" }
  const staleList = { id: "maintenance-1", lastUpdated: "2026-09-24T14:00:00Z", status: "SUBMITTED" }

  assert.strictEqual(preferNewestServerState(mutation, staleList), mutation)
})

test("a newer server snapshot replaces current state", () => {
  const current = { id: "supply-1", lastUpdated: "2026-09-24T14:00:00Z", status: "ORDERED" }
  const incoming = { id: "supply-1", lastUpdated: "2026-09-24T14:00:02Z", status: "RECEIVED" }

  assert.strictEqual(preferNewestServerState(current, incoming), incoming)
})

test("unparseable timestamps do not freeze state reconciliation", () => {
  const current = { id: "supply-1", lastUpdated: "invalid", status: "ORDERED" }
  const incoming = { id: "supply-1", lastUpdated: "also-invalid", status: "RECEIVED" }

  assert.strictEqual(preferNewestServerState(current, incoming), incoming)
})

test("Maintenance and Supply summary hydration both reject older snapshots", () => {
  assert.match(storeSource, /mergeMaintenanceSummaries\(previous, requests\)/)
  assert.match(storeSource, /preferNewestServerState\(detail, summary\)/)
})

const summary: MaintenanceRequest = {
  id: "repair-1", title: "Synthetic repair", description: "", locationId: "location-1",
  area: "Kitchen", category: "Other", priority: "Low", submittedBy: "Fixture", submittedById: "person-1",
  createdAt: "2026-09-24T14:00:00Z", lastUpdated: "2026-09-24T14:00:02Z",
  approvalStatus: "Not Required", maintenanceStatus: "In Progress", originalPhotos: [],
  completionPhotos: [], invoices: [], archived: false,
}
const documents = [{ name: "supporting.pdf", uploadedAt: summary.createdAt, uploadedBy: "Fixture" }]
const detail = { ...summary, lastUpdated: summary.createdAt, supportingDocuments: documents }

test("a newer Maintenance summary preserves supporting documents from detail", () => {
  const [merged] = mergeMaintenanceSummaries([detail], [summary])
  assert.equal(merged.lastUpdated, summary.lastUpdated)
  assert.deepEqual(merged.supportingDocuments, documents)
})

test("an authoritative Maintenance list omission evicts supporting documents", () => {
  const revoked = mergeMaintenanceSummaries([detail], [])
  assert.deepEqual(revoked, [])
  assert.equal(mergeMaintenanceSummaries(revoked, [summary])[0].supportingDocuments, undefined)
})

test("a detail response that removes supporting documents stays authoritative on list refresh", () => {
  const removed = upsertMaintenanceDetail([detail], { ...detail, supportingDocuments: [] })
  assert.deepEqual(mergeMaintenanceSummaries(removed, [summary])[0].supportingDocuments, [])
})
