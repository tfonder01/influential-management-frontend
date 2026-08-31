import type { MaintenanceRequest } from "./types"

/**
 * Human-friendly display identifier for a maintenance request, e.g. "MNT-1001".
 *
 * Production requests carry a real `requestNumber` assigned by a database sequence at creation
 * time. Demo/mock requests use ids like "maint1"; for those we derive a stable, readable fallback
 * number from the trailing digits of the mock id (never from a real UUID) so the demo experience
 * matches production's display format without requiring mock data migration.
 */
export function maintenanceDisplayId(request: Pick<MaintenanceRequest, "id" | "requestNumber">): string {
  if (request.requestNumber != null) {
    return `MNT-${request.requestNumber}`
  }
  const match = /(\d+)$/.exec(request.id)
  const suffix = match ? Number(match[1]) : 0
  return `MNT-${1000 + suffix}`
}
