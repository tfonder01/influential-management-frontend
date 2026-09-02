import type { MaintenancePriority } from "./types"

/**
 * User-facing priority labels for Maintenance and Supply requests. Internal values remain
 * Low / Medium / High / Urgent so persisted MEDIUM values and API contracts stay unchanged.
 */
export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  Low: "Low",
  Medium: "Normal",
  High: "High",
  Urgent: "Urgent",
}

export function priorityLabel(priority: MaintenancePriority): string {
  return PRIORITY_LABELS[priority]
}
