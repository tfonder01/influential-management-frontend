import { apiClient } from "./api-client"
import type { ApiPage } from "./records-api"

/**
 * Backend <-> frontend adapter for the Sprint 5A production Activity feed
 * (`GET /api/activity`). The backend already returns a human-readable projection over the
 * audit trail (see `ActivityService`/`ActivityController`) - this module intentionally does
 * no additional business-logic translation, just typed fetching.
 */
export type ApiActivityModule = "RECORDS" | "MAINTENANCE" | "SUPPLY" | "OTHER"
export type ApiActivityEntityType = "WORKSPACE_RECORD" | "MAINTENANCE_REQUEST" | "SUPPLY_REQUEST"

export interface ApiActivityItem {
  id: string
  action: string
  module: ApiActivityModule
  actorUserId: string | null
  actorDisplayName: string | null
  actorRole: string | null
  locationId: string | null
  locationName: string | null
  entityType: string
  entityId: string | null
  entityDisplayNumber: string | null
  entityTitle: string | null
  message: string
  route: string | null
  createdAt: string
}

export interface ListActivityParams {
  module?: ApiActivityModule
  locationId?: string
  entityType?: ApiActivityEntityType
  entityId?: string
  page?: number
  size?: number
}

export async function listActivity(params: ListActivityParams = {}): Promise<ApiPage<ApiActivityItem>> {
  const query = new URLSearchParams()
  if (params.module) query.set("module", params.module)
  if (params.locationId) query.set("locationId", params.locationId)
  if (params.entityType) query.set("entityType", params.entityType)
  if (params.entityId) query.set("entityId", params.entityId)
  query.set("page", String(params.page ?? 0))
  query.set("size", String(params.size ?? 20))
  return apiClient.request<ApiPage<ApiActivityItem>>(`/api/activity?${query.toString()}`)
}
