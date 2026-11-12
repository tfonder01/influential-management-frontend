import { expect, type Page } from "@playwright/test"
import { fixtures } from "./polish-fixtures"

export const longName = "Long location " + "UnbrokenName".repeat(20)

export async function setup(page: Page, options: Parameters<typeof fixtures>[1] = {}) {
  const base = await fixtures(page, options)
  const state = { supply: [] as Record<string, unknown>[], records: [] as Record<string, unknown>[] }
  const supply = { ...base.record, id: "supply-saved", title: "Saved supply", category: "SUPPLIES", quantity: 2, priority: "MEDIUM", area: "Infant" }
  const record = {
    id: "record", locationId: "one", locationName: "Location one", recordArea: "COMPLIANCE", complianceCategory: "CLASSROOM_OBSERVATIONS",
    operationsType: null, title: "Saved observation", customTitle: false, recordType: null, classroomAgeGroup: "INFANT", area: null,
    referenceLabel: null, recordDate: "2026-11-01", reviewStatus: "NEW", archived: false, archivedAt: null,
    reportingPeriod: { cadence: "MONTHLY", month: 11, year: 2026, weekOf: null }, createdByUserId: "owner", createdByName: "Test Owner",
    createdAt: "2026-11-01", updatedAt: "2026-11-01", description: "Fixture record", attachments: [], commentCount: 0,
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === "OPTIONS") return route.fallback()
    if (pathname === "/api/supply-requests" && request.method() === "GET") {
      const content = new URL(request.url()).searchParams.get("archived") === "true" ? [] : [supply]
      return route.fulfill({ json: { content, totalElements: content.length, totalPages: content.length, number: 0 } })
    }
    if (pathname === "/api/supply-requests/supply-saved") {
      if (request.method() === "PATCH") {
        const input = request.postDataJSON(); state.supply.push(input); Object.assign(supply, input, { area: input.area ?? null, classroomAgeGroup: input.classroomAgeGroup ?? null })
      }
      return route.fulfill({ json: supply })
    }
    if (pathname === "/api/records" && request.method() === "GET") {
      const content = new URL(request.url()).searchParams.get("archived") === "true" ? [] : [record]
      return route.fulfill({ json: { content, totalElements: content.length, totalPages: content.length, number: 0 } })
    }
    if (pathname === "/api/supply-requests" && request.method() === "POST") {
      const input = request.postDataJSON(); state.supply.push(input)
      return route.fulfill({ json: { ...input, id: "supply", status: "SUBMITTED", approvalStatus: "AWAITING_APPROVAL", archived: false,
        attachments: [], createdAt: "2026-11-01", updatedAt: "2026-11-01" } })
    }
    if (pathname === "/api/records/record") {
      if (request.method() === "PATCH") {
        const input = request.postDataJSON(); state.records.push(input)
        Object.assign(record, input)
      }
      return route.fulfill({ json: record })
    }
    if (pathname === "/api/records" && request.method() === "POST") {
      state.records.push(request.postDataJSON())
      return route.fulfill({ json: record })
    }
    if (pathname.endsWith("/assignable")) return route.fulfill({ json: [{ id: "assignee", displayName: longName, role: "DIRECTOR" }] })
    return route.fallback()
  })
  return { ...state, base, supplyRecord: supply }
}

export async function openSupply(page: Page) {
  await page.goto("/supply-requests")
  await page.getByRole("button", { name: "New Supply Request", exact: true }).click()
  return page.getByRole("dialog", { name: "New Supply Request" })
}

export async function viewportContainsPopup(page: Page) {
  const popup = page.getByRole("listbox")
  await expect(popup).toBeVisible()
  const bounds = (await popup.boundingBox())!, viewport = page.viewportSize()!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

