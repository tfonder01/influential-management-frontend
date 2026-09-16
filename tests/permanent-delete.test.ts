import test from "node:test"
import assert from "node:assert/strict"
import {
  copyPermanentDeleteConfirmation,
  createPermanentDeleteSubmissionGuard,
  isPermanentDeleteConfirmed,
  PERMANENT_DELETE_CONFIRMATION,
} from "../lib/permanent-delete.ts"

test("permanent delete confirmation requires exact uppercase DELETE", () => {
  assert.equal(PERMANENT_DELETE_CONFIRMATION, "DELETE")
  assert.equal(isPermanentDeleteConfirmed("DELETE"), true)
  assert.equal(isPermanentDeleteConfirmed("delete"), false)
  assert.equal(isPermanentDeleteConfirmed(" Delete "), false)
  assert.equal(isPermanentDeleteConfirmed(""), false)
})

test("copy writes exactly uppercase DELETE", async () => {
  const writes: string[] = []
  await copyPermanentDeleteConfirmation({ writeText: async (value) => { writes.push(value) } })
  assert.deepEqual(writes, ["DELETE"])
})

test("submission guard prevents concurrent double submission", async () => {
  const guard = createPermanentDeleteSubmissionGuard()
  let submissions = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const action = async () => { submissions += 1; await pending }

  const first = guard(action)
  const second = guard(action)
  assert.equal(await second, false)
  assert.equal(submissions, 1)
  release()
  assert.equal(await first, true)
})