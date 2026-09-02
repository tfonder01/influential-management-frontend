import type { ComplianceRecord, MaintenanceRequest, Role, SupplyRequest } from "./types"

/**
 * Single source of truth for what counts as an "actionable" item in the Needs Review
 * workspace, shared by the sidebar badge and the Needs Review page itself so the two
 * can never drift apart.
 */

export function isRecordActionable(record: ComplianceRecord): boolean {
  return record.status === "New" || record.status === "Needs Attention"
}

export function isMaintenanceActionable(request: MaintenanceRequest): boolean {
  return !request.archived && (request.approvalStatus === "Awaiting Approval" || Boolean(request.needsMoreInfo))
}

export function isSupplyActionable(request: SupplyRequest): boolean {
  return !request.archived && (request.approvalStatus === "Awaiting Approval" || Boolean(request.needsMoreInfo))
}

export interface NeedsReviewCounts {
  records: number
  maintenance: number
  supply: number
  total: number
}

/**
 * Maintenance/Supply Owner-approval actions are only ever surfaced to Owners (Directors and
 * Assistant Directors never see those controls on the Needs Review page), so their actionable
 * total must not include them. Records, maintenance, and supply requests are disjoint entities
 * (separate id spaces), so summing the three counts never double-counts a single item.
 */
export function getNeedsReviewCounts(
  records: ComplianceRecord[],
  maintenanceRequests: MaintenanceRequest[],
  supplyRequests: SupplyRequest[],
  role: Role
): NeedsReviewCounts {
  const recordCount = records.filter(isRecordActionable).length
  const maintenanceCount = role === "owner" ? maintenanceRequests.filter(isMaintenanceActionable).length : 0
  const supplyCount = role === "owner" ? supplyRequests.filter(isSupplyActionable).length : 0
  return {
    records: recordCount,
    maintenance: maintenanceCount,
    supply: supplyCount,
    total: recordCount + maintenanceCount + supplyCount,
  }
}
