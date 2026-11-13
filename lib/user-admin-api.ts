import { apiClient, ApiClientError, type ApiRole } from "./api-client"

export type AdminUserStatus = "ACTIVE" | "DISABLED" | "INVITED"

export interface AdminUser {
  id: string
  displayName: string
  email: string
  role: ApiRole
  status: AdminUserStatus
  locations: { id: string; name: string }[]
  lastLoginAt?: string
  createdAt: string
  canDeletePermanently?: boolean
  deleteBlockedReason?: string | null
}

export interface AdminUserPage {
  content: AdminUser[]
  number: number
  totalPages: number
  totalElements: number
}

export interface InviteUserResult {
  user: AdminUser
  expiresAt: string
  developmentSetupUrl?: string
}

export function listAdminUsers(page = 0, size = 25, statuses: readonly AdminUserStatus[] = []) {
  const query = new URLSearchParams({ page: String(page), size: String(size) })
  statuses.forEach((status) => query.append("status", status))
  return apiClient.request<AdminUserPage>(`/api/admin/users?${query}`)
}

export function updateAdminUser(id: string, role: ApiRole, locationIds: string[]) {
  return apiClient.request<AdminUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ role, locationIds }),
  })
}

export function inviteAdminUser(name: string, email: string, role: ApiRole, locationIds: string[]) {
  return apiClient.request<InviteUserResult>("/api/admin/users/invite", {
    method: "POST",
    body: JSON.stringify({ name, email, role, locationIds }),
  })
}

export function resendAdminUserInvite(id: string) {
  return apiClient.request<InviteUserResult>(`/api/admin/users/${id}/resend-invite`, { method: "POST" })
}

export function disableAdminUser(id: string) {
  return apiClient.request<AdminUser>(`/api/admin/users/${id}/disable`, { method: "POST" })
}

export function reactivateAdminUser(id: string) {
  return apiClient.request<AdminUser>(`/api/admin/users/${id}/reactivate`, { method: "POST" })
}

export async function deleteUnusedAdminInvitation(id: string) {
  const result = await apiClient.request<unknown>(`/api/admin/users/${id}`, { method: "DELETE" })
  if (result !== undefined) {
    throw new ApiClientError("The deletion was not confirmed. Reload users before trying again.", 502, "DELETE_NOT_CONFIRMED")
  }
}
