import type { Step } from "react-joyride"
import type { OnboardingAudience, OnboardingStatus } from "./api-client"
import type { Role } from "./types"

export const ONBOARDING_VERSIONS: Record<OnboardingAudience, number> = {
  OWNER: 1,
  LOCATION_STAFF: 1,
}

interface TourStepData {
  route: string
  targetKey: string
}

interface StepDefinition extends TourStepData {
  title: string
  content: string
}

const ownerSteps: StepDefinition[] = [
  { route: "/dashboard", targetKey: "dashboard-overview", title: "Your dashboard", content: "Start here for a quick view of activity, uploads, and work that needs attention." },
  { route: "/needs-review", targetKey: "needs-review-overview", title: "Needs Review", content: "Review items that are waiting for an Owner decision or follow-up." },
  { route: "/locations", targetKey: "locations-overview", title: "Locations", content: "See organization-wide location activity and open each location's workspace." },
  { route: "/admin/users", targetKey: "users-overview", title: "Users", content: "Invite staff and manage roles, location access, and account status." },
  { route: "/settings", targetKey: "settings-overview", title: "Settings", content: "Update your profile and organization preferences from here." },
  { route: "/settings", targetKey: "support-entry", title: "Help & support", content: "Return here whenever you need support or want to replay this walkthrough." },
]

const locationLeaderSteps: StepDefinition[] = [
  { route: "/dashboard", targetKey: "dashboard-overview", title: "Your dashboard", content: "Start here for a quick view of activity and work across your assigned locations." },
  { route: "/records", targetKey: "compliance-overview", title: "Compliance", content: "Upload and review licensing, health and safety, classroom, incident, and complaint records." },
  { route: "/operations", targetKey: "operations-overview", title: "Operations", content: "Keep opening, closing, playground, and other operational records separate from compliance." },
  { route: "/maintenance", targetKey: "maintenance-overview", title: "Maintenance", content: "Submit issues and follow approval and repair progress independently." },
  { route: "/supply-requests", targetKey: "supply-requests-overview", title: "Supply Requests", content: "Request supplies and follow approval and fulfillment independently." },
  { route: "/activity", targetKey: "activity-overview", title: "Activity", content: "Use the activity history to follow recent changes across your locations." },
  { route: "/activity", targetKey: "support-entry", title: "Help & support", content: "Return here whenever you need support or want to replay this walkthrough." },
]

export function onboardingAudienceFor(role: Role): OnboardingAudience {
  return role === "owner" ? "OWNER" : "LOCATION_STAFF"
}

const TOUR_TARGET_BY_HREF: Record<string, string> = {
  "/dashboard": "dashboard-overview",
  "/needs-review": "needs-review-overview",
  "/locations": "locations-overview",
  "/admin/users": "users-overview",
  "/settings": "settings-overview",
  "/records": "compliance-overview",
  "/operations": "operations-overview",
  "/maintenance": "maintenance-overview",
  "/supply-requests": "supply-requests-overview",
  "/activity": "activity-overview",
}

export function tourTargetForHref(href: string | undefined): string | undefined {
  return href ? TOUR_TARGET_BY_HREF[href] : undefined
}

export function shouldAutoPrompt(isDemoMode: boolean, promptRequired: boolean): boolean {
  return !isDemoMode && promptRequired
}

export function shouldPersistOnboarding(isDemoMode: boolean): boolean {
  return !isDemoMode
}

export function onboardingSteps(audience: OnboardingAudience, prepareStep: (data: TourStepData) => Promise<void>): Step[] {
  const definitions = audience === "OWNER" ? ownerSteps : locationLeaderSteps
  return definitions.map((definition) => ({
    id: definition.targetKey,
    target: `[data-tour="${definition.targetKey}"]`,
    title: definition.title,
    content: definition.content,
    data: { route: definition.route, targetKey: definition.targetKey },
    before: () => prepareStep(definition),
    placement: definition.targetKey === "support-entry" ? "right" : "bottom",
  }))
}

export type { OnboardingStatus }
