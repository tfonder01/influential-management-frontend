import { apiClient } from "./api-client"
import { getNeedsReviewCounts } from "./needs-review"
import { isComplianceRecord, isOperationsRecord } from "./record-workspaces"
import type { ComplianceRecord, Location, MaintenanceRequest, Role, SupplyRequest } from "./types"

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
  operationalRequests: Array<{
    id: string
    reference: string
    requestType: "MAINTENANCE" | "SUPPLY"
    title: string
    locationId: string
    locationName: string
    approvalStatus: string
    progressStatus: string
    priority: string
    createdAt: string
  }>
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
  locations: Location[] = [],
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

  const operationalRequests = [
    ...activeMaintenance
      .filter((request) => !["Completed", "Cancelled"].includes(request.maintenanceStatus))
      .map((request) => ({
        id: request.id,
        reference: `MNT-${request.requestNumber ?? request.id}`,
        requestType: "MAINTENANCE" as const,
        title: request.title,
        locationId: request.locationId,
        locationName: locations.find((location) => location.id === request.locationId)?.name ?? "Unknown location",
        approvalStatus: request.approvalStatus,
        progressStatus: request.maintenanceStatus,
        priority: request.priority,
        createdAt: request.createdAt,
        tier: ["Awaiting Approval", "Needs Information"].includes(request.approvalStatus) ? 0 : 1,
      })),
    ...activeSupply
      .filter((request) => !["Received", "Cancelled"].includes(request.fulfillmentStatus))
      .map((request) => ({
        id: request.id,
        reference: `SUP-${request.requestNumber ?? request.id}`,
        requestType: "SUPPLY" as const,
        title: request.title,
        locationId: request.locationId,
        locationName: locations.find((location) => location.id === request.locationId)?.name ?? "Unknown location",
        approvalStatus: request.approvalStatus,
        progressStatus: request.fulfillmentStatus,
        priority: request.priority,
        createdAt: request.requestedAt,
        tier: ["Awaiting Approval", "Needs Information"].includes(request.approvalStatus) ? 0 : 1,
      })),
  ]
    .sort((a, b) => a.tier - b.tier || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((request) => {
      const { tier, ...withoutTier } = request
      void tier
      return withoutTier
    })

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
    operationalRequests,
    needsReview: getNeedsReviewCounts(activeRecords, activeMaintenance, activeSupply, role),
  }
}
