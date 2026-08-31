import type { Role } from "./types"

/** Shared role display labels so every "Name · Role" surface renders identically. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  director: "Director",
  assistant_director: "Assistant Director",
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role
}
