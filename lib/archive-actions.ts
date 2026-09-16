import type { Role } from "./types"

/** Frontend visibility only; backend authorization remains authoritative. */
export function canManageArchive(role: Role): boolean {
  return role === "owner"
}
