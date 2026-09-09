import { apiClient } from "./api-client"

export interface OrganizationSettings {
  id: string
  name: string
  notificationEmail?: string
  updatedAt: string
}

export interface LocationSettings {
  id: string
  name: string
  notificationEmail?: string
  updatedAt: string
}

export function getOrganizationSettings() {
  return apiClient.request<OrganizationSettings>("/api/admin/settings/organization")
}

export function updateOrganizationSettings(name: string, notificationEmail: string) {
  return apiClient.request<OrganizationSettings>("/api/admin/settings/organization", {
    method: "PATCH",
    body: JSON.stringify({ name, notificationEmail }),
  })
}

export function listLocationSettings() {
  return apiClient.request<LocationSettings[]>("/api/admin/settings/locations")
}

export function createLocationSettings(name: string, notificationEmail: string) {
  return apiClient.request<LocationSettings>("/api/admin/settings/locations", {
    method: "POST",
    body: JSON.stringify({ name, notificationEmail }),
  })
}

export function updateLocationSettings(id: string, name: string, notificationEmail: string) {
  return apiClient.request<LocationSettings>(`/api/admin/settings/locations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, notificationEmail }),
  })
}
