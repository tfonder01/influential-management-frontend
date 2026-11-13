import type { Page } from "@playwright/test"
import type { AdminUser } from "../../lib/user-admin-api"

const locations = ["one", "two"].map((id) => ({ id, name: `Location ${id}`, addressLine1: "", city: "", state: "", postalCode: "", active: true }))
export const user = (id: string, status: AdminUser["status"]): AdminUser => ({ id, status, displayName: `User ${id}`, email: `${id}@example.test`,
  canDeletePermanently: status === "INVITED", deleteBlockedReason: status === "INVITED" ? null : "USER_ALREADY_ACTIVATED",
  role: "DIRECTOR", locations: [{ id: "one", name: "Location one" }], createdAt: "2026-01-01" })

export async function fixtures(page: Page, options: { locationName?: string; role?: "OWNER" | "DIRECTOR" } = {}) {
  const scopedLocations = locations.map((location) => ({ ...location, name: location.id === "one" ? options.locationName ?? location.name : location.name }))
  const state = { users: [user("active", "ACTIVE"), user("invited", "INVITED"), user("disabled", "DISABLED")],
    record: { id: "history", requestNumber: 12, title: "Historical request", locationId: "one", locationName: "Location one", category: "BUILDING_FACILITY", priority: "LOW", status: "SUBMITTED",
      approvalStatus: "NOT_REQUIRED", archived: false, attachments: [], commentCount: 0, area: "Other", classroomAgeGroup: "INFANT",
      description: "Historical fixture", createdAt: "2026-01-01", updatedAt: "2026-01-01", submittedByUserId: "owner", submittedByName: "Test Owner" } as Record<string, unknown>,
    showHistory: false, deleteRequests: [] as string[], deleteGate: null as Promise<void> | null, deleteError: "", deleteStatus: 204, nextInviteId: 0,
    userRequests: [] as URL[], payloads: [] as Record<string, unknown>[], slowStatus: "", classroomRequests: [] as string[] }
  await page.route("**/api/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204 }); return }
    let body: unknown = { content: [], totalElements: 0, totalPages: 0, number: 0 }
    let status = 200
    if (path === "/api/auth/refresh") body = { accessToken: "local-fixture-token", expiresInSeconds: 900, tokenType: "Bearer", user: {
      id: "owner", organizationId: "org", organizationName: "Test organization", firstName: "Test", lastName: "Owner", email: "owner@example.test",
      role: options.role ?? "OWNER", operationalEmailNotificationsEnabled: true, locations: scopedLocations,
      onboarding: { tourAudience: "OWNER", version: 1, status: "DISMISSED", promptRequired: false },
    } }
    else if (path === "/api/dashboard/summary") body = { month: "2026-11", generatedAt: "2026-11-11", needsReview: { total: 0, records: 0, maintenance: 0, supply: 0 },
      records: { active: 0, newCount: 0, needsAttention: 0, reviewed: 0, compliance: 0, operations: 0 },
      maintenance: { open: 0, awaitingApproval: 0, inProgress: 0, completedThisMonth: 0, costThisMonth: 0 },
      supply: { open: 0, awaitingApproval: 0, orderedOrInTransit: 0, receivedThisMonth: 0, spendThisMonth: 0 }, operationalRequests: [] }
    else if (path === "/api/admin/settings/organization") body = { id: "org", name: "Test organization", updatedAt: "2026-01-01" }
    else if (path === "/api/admin/settings/locations") body = scopedLocations
    else if (path.includes("/classrooms")) { state.classroomRequests.push(path); status = 500
    } else if (path === "/api/admin/users/invite") {
      const input = request.postDataJSON(), invited = { ...user(`new-invite-${++state.nextInviteId}`, "INVITED"), displayName: input.name, email: input.email }
      state.users.push(invited); body = { user: invited, expiresAt: "2026-12-01" }
    } else if (/\/api\/admin\/users\/[^/]+$/.test(path) && request.method() === "DELETE") {
      const id = path.split("/").at(-1)!
      state.deleteRequests.push(id)
      if (state.deleteGate) await state.deleteGate
      if (state.deleteError) { await route.fulfill({ status: 409, json: { code: "USER_ALREADY_ACTIVATED", message: state.deleteError } }); return }
      if (state.deleteStatus !== 204) { await route.fulfill({ status: state.deleteStatus, json: { message: "Unexpected response" } }); return }
      state.users = state.users.filter((item) => item.id !== id)
      await route.fulfill({ status: 204 }); return
    } else if (/\/api\/admin\/users\/[^/]+\/(disable|reactivate)$/.test(path)) {
      const item = state.users.find((user) => user.id === path.split("/").at(-2))!
      item.status = path.endsWith("/disable") ? "DISABLED" : "ACTIVE"; body = item
    } else if (path === "/api/admin/users") {
      state.userRequests.push(url)
      const statuses = url.searchParams.getAll("status"), index = Number(url.searchParams.get("page") ?? 0), size = Number(url.searchParams.get("size") ?? 25)
      const filtered = state.users.filter((user) => !statuses.length || statuses.includes(user.status))
      body = { content: filtered.slice(index * size, (index + 1) * size), totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size), number: index }
      if (statuses.includes(state.slowStatus)) await new Promise((resolve) => setTimeout(resolve, 700))
    } else if (path === "/api/maintenance" && request.method() === "GET" && state.showHistory) {
      const items = url.searchParams.get("archived") === "true" ? [] : [state.record]
      body = { content: items, totalElements: items.length, totalPages: items.length, number: 0 }
    } else if (path === "/api/maintenance/history") {
      if (request.method() === "PATCH") {
        const input = request.postDataJSON(); state.payloads.push(input); Object.assign(state.record, input)
        state.record.classroomAgeGroup = input.classroomAgeGroup ?? null
      }
      body = state.record
    } else if (path.endsWith("/comments")) body = []
    else if (path === "/api/maintenance" && request.method() === "POST") {
      const input = request.postDataJSON(); state.payloads.push(input)
      body = { ...input, id: "ticket", requestNumber: 1, status: "SUBMITTED", approvalStatus: "NOT_REQUIRED", archived: false,
        attachments: [], area: input.area, createdAt: "2026-01-01", updatedAt: "2026-01-01" }
    } else if (path.endsWith("/notifications/unread-count")) body = { count: 0 }
    else if (path.endsWith("/assignable") || path.endsWith("/mentionable")) body = []
    await route.fulfill({ status, json: body })
  })
  return state
}
