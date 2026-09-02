import { apiClient } from "./api-client"
import type { ApiPage } from "./records-api"

export interface ApiNotification {
  id: string
  type: string
  title: string
  message: string
  entityType: string
  entityId: string
  route: string
  readAt: string | null
  createdAt: string
}

export async function listNotifications(page = 0, size = 10): Promise<ApiPage<ApiNotification>> {
  return apiClient.request<ApiPage<ApiNotification>>(`/api/notifications?page=${page}&size=${size}`)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await apiClient.request<{ count: number }>("/api/notifications/unread-count")
  return response.count
}

export async function markNotificationReadApi(id: string): Promise<ApiNotification> {
  return apiClient.request<ApiNotification>(`/api/notifications/${id}/read`, { method: "POST" })
}

export async function markAllNotificationsReadApi(): Promise<number> {
  const response = await apiClient.request<{ updated: number }>("/api/notifications/read-all", { method: "POST" })
  return response.updated
}

export async function dismissNotificationApi(id: string): Promise<void> {
  await apiClient.request<void>(`/api/notifications/${id}/dismiss`, { method: "POST" })
}

export async function dismissAllNotificationsApi(): Promise<number> {
  const response = await apiClient.request<{ updated: number }>("/api/notifications/dismiss-all", { method: "POST" })
  return response.updated
}
