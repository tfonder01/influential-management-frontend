import { apiClient } from "./api-client"
import { operationalEmailPreferencePayload, type OperationalEmailPreference } from "./user-preferences"

export function updateOperationalEmailPreference(enabled: boolean) {
  return apiClient.request<OperationalEmailPreference>("/api/users/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(operationalEmailPreferencePayload(enabled)),
  })
}
