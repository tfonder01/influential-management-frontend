import test from "node:test"
import assert from "node:assert/strict"
import { GLOBAL_CLASSROOM_GROUPS, GLOBAL_CLASSROOM_AREAS, FACILITY_AREAS, maintenanceAreaFilterOptions, maintenanceAreaPayload } from "../lib/maintenance-area-options.ts"

test("global classroom hierarchy contains every standard section and preschool level", () => {
  assert.equal(GLOBAL_CLASSROOM_AREAS.length, 21)
  assert.equal(new Set(GLOBAL_CLASSROOM_AREAS).size, 21)
  assert.deepEqual(GLOBAL_CLASSROOM_GROUPS.map((g) => g.label), ["Infant", "Toddler", "Twaddler", "Prepper", "Preschool"])
  for (const group of GLOBAL_CLASSROOM_GROUPS.slice(0, 4)) {
    assert.deepEqual(group.rooms, ["A", "B", "C"].map((section) => `${group.label} ${section}`))
    for (const area of group.rooms) assert.deepEqual(maintenanceAreaPayload({ area, classroomAgeGroup: group.label }), { area, classroomAgeGroup: group.value })
  }
  assert.deepEqual(GLOBAL_CLASSROOM_GROUPS[4].branches.map((b) => b.level), ["1", "2", "3"])
  for (const branch of GLOBAL_CLASSROOM_GROUPS[4].branches) {
    assert.deepEqual(branch.rooms, ["A", "B", "C"].map((section) => `Preschool - ${branch.level} ${section}`))
    for (const area of branch.rooms) assert.deepEqual(maintenanceAreaPayload({ area, classroomAgeGroup: "Preschool" }), { area, classroomAgeGroup: "PRESCHOOL" })
  }
})

test("facility options exclude legacy options; filters retain saved values", () => {
  assert.deepEqual(FACILITY_AREAS, ["Kitchen", "Office", "Lobby", "Restroom", "Playground", "Exterior", "Hallway", "Storage"])
  const options = maintenanceAreaFilterOptions(["Other", "Whole Location", "Blue Room", "Kitchen", ""])
  for (const value of ["Other", "Whole Location", "Blue Room"]) assert(options.includes(value))
  assert.equal(options.filter((v) => v === "Kitchen").length, 1)
  assert(!options.includes("Custom"))
})

test("custom text never infers classification, even when matching a standard classroom", () => {
  for (const area of ["Infant", "Infant A", "Preschool - 1 B", "Kitchen", "Custom text"]) {
    assert.deepEqual(maintenanceAreaPayload({ area }), { area })
  }
})

test("historical values and explicit classifications survive unrelated edits verbatim", () => {
  for (const area of ["Other", "Whole Location", "Old classroom", " Arbitrary text ", ""]) {
    assert.deepEqual(maintenanceAreaPayload({ area, classroomAgeGroup: "Infant" }), { area, classroomAgeGroup: "INFANT" })
  }
  assert.deepEqual(maintenanceAreaPayload({}), {})
})
