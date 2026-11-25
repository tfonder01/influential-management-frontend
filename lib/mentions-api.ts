import { apiClient, type ApiRole } from "./api-client"

export interface MentionableUser {
  id: string
  displayName: string
  role: ApiRole
}

export interface CommentMention {
  userId: string
  displayName: string
}

export function listMentionableUsers(locationId: string, maintenanceRequestId?: string): Promise<MentionableUser[]> {
  if (maintenanceRequestId) return apiClient.request<MentionableUser[]>(`/api/maintenance/${maintenanceRequestId}/mentionable-users`)
  const query = new URLSearchParams({ locationId })
  return apiClient.request<MentionableUser[]>(`/api/users/mentionable?${query}`)
}

export function listAssignableUsers(locationId: string): Promise<MentionableUser[]> {
  const query = new URLSearchParams({ locationId })
  return apiClient.request<MentionableUser[]>(`/api/users/assignable?${query}`)
}
