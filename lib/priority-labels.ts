import type { MaintenancePriority } from "./types"

/**
 * Priority display labels for Maintenance and Supply requests. The canonical value set is
 * Low / Medium / High / Urgent across backend and frontend — no "Normal" value is used.
 */
export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Urgent",
}

export function priorityLabel(priority: MaintenancePriority): string {
  return PRIORITY_LABELS[priority]
}
