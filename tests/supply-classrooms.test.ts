import test from "node:test"
import assert from "node:assert/strict"
import { GLOBAL_CLASSROOM_GROUPS, standardClassroomAgeGroup } from "../lib/maintenance-area-options.ts"

test("every Supply standard classroom maps to its existing age-group classification", () => {
  let count = 0
  for (const group of GLOBAL_CLASSROOM_GROUPS) {
    const rooms = [...group.rooms, ...group.branches.flatMap((branch) => branch.rooms)]
    for (const area of rooms) {
      assert.equal(standardClassroomAgeGroup(area), group.label)
      count++
    }
  }
  assert.equal(count, 21)
})

test("nonstandard, historical generic and facility labels are not new standard classrooms", () => {
  for (const area of ["", "Infant", "Preschool", "Kitchen", "Exterior", "Hallway", "Other", "Whole Location", "Custom", "Blue Room", "Infant D", "Preschool - 4 A"]) {
    assert.equal(standardClassroomAgeGroup(area), undefined)
  }
})
