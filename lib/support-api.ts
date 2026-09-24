import { apiClient } from "./api-client"

export type SupportSubmissionType = "PROBLEM" | "FEATURE_SUGGESTION"

export interface SupportSubmissionInput {
  type: SupportSubmissionType
  message: string
  currentPath: string
  locationId?: string
}

export function submitSupport(input: SupportSubmissionInput) {
  return apiClient.request<{ message: string }>("/api/support", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
