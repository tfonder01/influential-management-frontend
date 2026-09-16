import test from "node:test"
import assert from "node:assert/strict"
import { canManageArchive } from "../lib/archive-actions.ts"

test("only Owners see archive, restore, and permanent-delete controls", () => {
  assert.equal(canManageArchive("owner"), true)
  assert.equal(canManageArchive("director"), false)
  assert.equal(canManageArchive("assistant_director"), false)
})
