import type { MaintenanceRequest } from "./types"

export interface VersionedServerState {
  id: string
  lastUpdated: string
}

function timestamp(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Keep a mutation/detail response when an older list request finishes later.
 * Server timestamps are authoritative; unparseable timestamps fall back to the
 * incoming snapshot so a malformed local value cannot freeze reconciliation.
 */
export function preferNewestServerState<T extends VersionedServerState>(
  current: T,
  incoming: T
): T {
  const currentTimestamp = timestamp(current.lastUpdated)
  const incomingTimestamp = timestamp(incoming.lastUpdated)

  if (currentTimestamp !== null && incomingTimestamp !== null && currentTimestamp > incomingTimestamp) {
    return current
  }

  return incoming
}

export function mergeMaintenanceSummaries(previous: MaintenanceRequest[], summaries: MaintenanceRequest[]): MaintenanceRequest[] {
  const previousById = new Map(previous.map((request) => [request.id, request]))
  return summaries.map((summary) => {
    const detail = previousById.get(summary.id)
    if (!detail) return summary
    const newest = preferNewestServerState(detail, summary)
    if (newest === detail) return detail
    return {
      ...summary,
      description: detail.description,
      approvalNote: detail.approvalNote,
      vendorContact: detail.vendorContact,
      originalPhotos: detail.originalPhotos,
      completionPhotos: detail.completionPhotos,
      invoices: detail.invoices,
      supportingDocuments: detail.supportingDocuments,
      assetName: detail.assetName,
      assetType: detail.assetType,
      repeatIssueKey: detail.repeatIssueKey,
      repeatRepairCount: detail.repeatRepairCount,
      repeatRecordedCost: detail.repeatRecordedCost,
      repeatRepairPeriodMonths: detail.repeatRepairPeriodMonths,
    }
  })
}

export function upsertMaintenanceDetail(previous: MaintenanceRequest[], detail: MaintenanceRequest): MaintenanceRequest[] {
  const index = previous.findIndex(({ id }) => id === detail.id)
  if (index === -1) return [detail, ...previous]
  const next = [...previous]
  next[index] = { ...previous[index], ...detail, supportingDocuments: detail.supportingDocuments }
  return next
}
