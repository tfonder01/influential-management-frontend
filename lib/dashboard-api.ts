import { apiClient } from "./api-client"
import { getNeedsReviewCounts } from "./needs-review"
import { isComplianceRecord, isOperationsRecord } from "./record-workspaces"
import type { ComplianceRecord, MaintenanceRequest, Role, SupplyRequest } from "./types"

export interface DashboardSummary {
  month: string
  generatedAt: string
  records: {
    active: number
    newCount: number
    needsAttention: number
    reviewed: number
    compliance: number
    operations: number
  }
  maintenance: {
    open: number
    awaitingApproval: number
    inProgress: number
    completedThisMonth: number
    costThisMonth: number
  }
  supply: {
    open: number
    awaitingApproval: number
    orderedOrInTransit: number
    receivedThisMonth: number
    spendThisMonth: number
  }
  needsReview: {
    records: number
    maintenance: number
    supply: number
    total: number
  }
}

export async function getDashboardSummaryApi(): Promise<DashboardSummary> {
  return apiClient.request<DashboardSummary>("/api/dashboard/summary")
}

/** Demo-mode equivalent of the production aggregate, kept deterministic and rule-compatible. */
export function buildDashboardSummary(
  records: ComplianceRecord[],
  maintenanceRequests: MaintenanceRequest[],
  supplyRequests: SupplyRequest[],
  role: Role,
  now = new Date()
): DashboardSummary {
  const month = now.toISOString().slice(0, 7)
  const activeRecords = records.filter((record) => record.status !== "Archived")
  const activeMaintenance = maintenanceRequests.filter((request) => !request.archived)
  const activeSupply = supplyRequests.filter((request) => !request.archived)
  const completedThisMonth = activeMaintenance.filter((request) =>
    request.maintenanceStatus === "Completed" && request.completedAt?.startsWith(month)
  )
  const receivedThisMonth = activeSupply.filter((request) =>
    request.fulfillmentStatus === "Received" && request.receivedAt?.startsWith(month)
  )

  return {
    month,
    generatedAt: now.toISOString(),
    records: {
      active: activeRecords.length,
      newCount: activeRecords.filter((record) => record.status === "New").length,
      needsAttention: activeRecords.filter((record) => record.status === "Needs Attention").length,
      reviewed: activeRecords.filter((record) => record.status === "Reviewed").length,
      compliance: activeRecords.filter(isComplianceRecord).length,
      operations: activeRecords.filter(isOperationsRecord).length,
    },
    maintenance: {
      open: activeMaintenance.filter((request) => !["Completed", "Cancelled"].includes(request.maintenanceStatus)).length,
      awaitingApproval: activeMaintenance.filter((request) => request.approvalStatus === "Awaiting Approval").length,
      inProgress: activeMaintenance.filter((request) => request.maintenanceStatus === "In Progress").length,
      completedThisMonth: completedThisMonth.length,
      costThisMonth: completedThisMonth.reduce((sum, request) => sum + (request.finalCost ?? 0), 0),
    },
    supply: {
      open: activeSupply.filter((request) => !["Received", "Cancelled"].includes(request.fulfillmentStatus)).length,
      awaitingApproval: activeSupply.filter((request) => request.approvalStatus === "Awaiting Approval").length,
      orderedOrInTransit: activeSupply.filter((request) => ["Ordered", "Waiting / In Transit"].includes(request.fulfillmentStatus)).length,
      receivedThisMonth: receivedThisMonth.length,
      spendThisMonth: receivedThisMonth.reduce((sum, request) => sum + (request.finalTotal ?? 0), 0),
    },
    needsReview: getNeedsReviewCounts(activeRecords, activeMaintenance, activeSupply, role),
  }
}
