import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { preferNewestServerState } from "../lib/server-state.ts"

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
  assert.equal((storeSource.match(/preferNewestServerState\(detail, summary\)/g) ?? []).length, 2)
})
