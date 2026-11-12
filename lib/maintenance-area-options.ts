import type { ClassroomAgeGroup } from "./types"

export const CLASSROOM_TYPES = [
  { value: "INFANT", label: "Infant" }, { value: "TODDLER", label: "Toddler" },
  { value: "TWADDLER", label: "Twaddler" }, { value: "PREPPER", label: "Prepper" },
  { value: "PRESCHOOL", label: "Preschool" },
] as const
export const FACILITY_AREAS = ["Kitchen", "Office", "Lobby", "Restroom", "Playground", "Exterior", "Hallway", "Storage"]
export interface MaintenanceAreaSelection { area: string; classroomAgeGroup?: ClassroomAgeGroup }
const sections = ["A", "B", "C"]
export const GLOBAL_CLASSROOM_GROUPS = CLASSROOM_TYPES.map((type) => ({
  ...type,
  branches: type.value === "PRESCHOOL" ? ["1", "2", "3"].map((level) => ({ level,
    rooms: sections.map((section) => `Preschool - ${level} ${section}`),
  })) : [],
  rooms: type.value === "PRESCHOOL" ? [] : sections.map((section) => `${type.label} ${section}`),
}))
export const GLOBAL_CLASSROOM_AREAS = GLOBAL_CLASSROOM_GROUPS.flatMap((group) =>
  [...group.rooms, ...group.branches.flatMap((branch) => branch.rooms)])

/** Classification is explicit: never infer classroom identity from custom/saved text. */
export function maintenanceAreaPayload(input: { area?: string; classroomAgeGroup?: string }) {
  const type = CLASSROOM_TYPES.find((item) => item.label === input.classroomAgeGroup)?.value
  return {
    ...(input.area !== undefined ? { area: input.area } : {}),
    ...(type ? { classroomAgeGroup: type } : {}),
  }
}
export function maintenanceAreaFilterOptions(areas: string[]) {
  return Array.from(new Set([...CLASSROOM_TYPES.map((type) => type.label), ...GLOBAL_CLASSROOM_AREAS, ...FACILITY_AREAS, ...areas.filter(Boolean)]))
}
