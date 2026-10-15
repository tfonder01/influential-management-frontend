import { apiClient, type OnboardingAudience, type OnboardingState, type OnboardingStatus } from "./api-client"

export function updateOnboarding(input: {
  tourAudience: OnboardingAudience
  version: number
  status: OnboardingStatus
}) {
  return apiClient.request<OnboardingState>("/api/users/me/onboarding", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
