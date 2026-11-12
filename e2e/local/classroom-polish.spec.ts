import { expect, test, type Page } from "@playwright/test"
import type { AdminUser } from "../../lib/user-admin-api"
const locations = ["one", "two"].map((id) => ({ id, name: `Location ${id}`, addressLine1: "", city: "", state: "", postalCode: "", active: true }))
const user = (id: string, status: AdminUser["status"]): AdminUser => ({ id, status, displayName: `User ${id}`, email: `${id}@example.test`,
  role: "DIRECTOR", locations: [{ id: "one", name: "Location one" }], createdAt: "2026-01-01" })

async function fixtures(page: Page) {
  const state = { users: [user("active", "ACTIVE"), user("invited", "INVITED"), user("disabled", "DISABLED")],
    record: { id: "history", requestNumber: 12, title: "Historical request", locationId: "one", locationName: "Location one", category: "BUILDING_FACILITY", priority: "LOW", status: "SUBMITTED",
      approvalStatus: "NOT_REQUIRED", archived: false, attachments: [], commentCount: 0, area: "Other", classroomAgeGroup: "INFANT",
      description: "Historical fixture", createdAt: "2026-01-01", updatedAt: "2026-01-01", submittedByUserId: "owner", submittedByName: "Test Owner" } as Record<string, unknown>,
    showHistory: false,
    userRequests: [] as URL[], payloads: [] as Record<string, unknown>[], slowStatus: "", classroomRequests: [] as string[] }
  await page.route("**/api/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204 }); return }
    let body: unknown = { content: [], totalElements: 0, totalPages: 0, number: 0 }
    let status = 200
    if (path === "/api/auth/refresh") body = { accessToken: "local-fixture-token", expiresInSeconds: 900, tokenType: "Bearer", user: {
      id: "owner", organizationId: "org", organizationName: "Test organization", firstName: "Test", lastName: "Owner", email: "owner@example.test",
      role: "OWNER", operationalEmailNotificationsEnabled: true, locations,
      onboarding: { tourAudience: "OWNER", version: 1, status: "DISMISSED", promptRequired: false },
    } }
    else if (path === "/api/dashboard/summary") body = { month: "2026-11", generatedAt: "2026-11-11", needsReview: { total: 0, records: 0, maintenance: 0, supply: 0 },
      records: { active: 0, newCount: 0, needsAttention: 0, reviewed: 0, compliance: 0, operations: 0 },
      maintenance: { open: 0, awaitingApproval: 0, inProgress: 0, completedThisMonth: 0, costThisMonth: 0 },
      supply: { open: 0, awaitingApproval: 0, orderedOrInTransit: 0, receivedThisMonth: 0, spendThisMonth: 0 }, operationalRequests: [] }
    else if (path === "/api/admin/settings/organization") body = { id: "org", name: "Test organization", updatedAt: "2026-01-01" }
    else if (path === "/api/admin/settings/locations") body = locations
    else if (path.includes("/classrooms")) { state.classroomRequests.push(path); status = 500
    } else if (path === "/api/admin/users/invite") {
      const input = request.postDataJSON(), invited = { ...user("new-invite", "INVITED"), displayName: input.name, email: input.email }
      state.users.push(invited); body = { user: invited, expiresAt: "2026-12-01" }
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
async function openMaintenance(page: Page) {
  await page.goto("/maintenance")
  await page.getByRole("button", { name: "New Maintenance Request", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "New Maintenance Request" })
  await expect(dialog.getByLabel("Classroom / Area", { exact: true })).toBeEnabled()
  return dialog
}
async function insideViewport(page: Page) {
  for (const menu of await page.locator('[role="menu"], [role="listbox"]').all()) {
    const box = await menu.boundingBox(); if (!box) continue
    const viewport = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

async function hoverMenuItem(page: Page, name: string) {
  const trigger = page.getByRole("menuitem", { name, exact: true })
  const box = (await trigger.boundingBox())!
  // Native pointer movement lets Base UI release its safe hover corridor.
  // locator.hover alone waits for that release before it moves the pointer.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await trigger.hover()
}

test("global menus have every option, hover/click selection and no classroom fetch", async ({ page }) => {
  const state = await fixtures(page), dialog = await openMaintenance(page), area = dialog.getByLabel("Classroom / Area", { exact: true })
  await area.click()
  await expect(page.getByRole("menuitem", { name: "Custom", exact: true })).toHaveCount(1)
  for (const name of ["Other", "Other / custom area", "Whole Location"]) await expect(page.getByRole("menuitem", { name, exact: true })).toHaveCount(0)
  for (const type of ["Infant", "Toddler", "Twaddler", "Prepper"]) {
    await hoverMenuItem(page, type)
    for (const section of ["A", "B", "C"]) await expect(page.getByRole("menuitem", { name: `${type} ${section}`, exact: true })).toBeVisible()
  }
  await hoverMenuItem(page, "Preschool")
  for (const level of ["1", "2", "3"]) {
    await hoverMenuItem(page, level)
    for (const section of ["A", "B", "C"]) await expect(page.getByRole("menuitem", { name: `Preschool - ${level} ${section}`, exact: true })).toBeVisible()
  }
  await page.getByRole("menuitem", { name: "Preschool - 3 C", exact: true }).click()
  await dialog.getByLabel("Location", { exact: true }).click(); await page.getByRole("option", { name: "Location two", exact: true }).click()
  await expect(area).toContainText("Preschool - 3 C")
  await area.click(); await page.getByRole("menuitem", { name: "Preschool", exact: true }).click()
  await page.getByRole("menuitem", { name: "3", exact: true }).click()
  await page.getByRole("menuitem", { name: "Preschool - 3 C", exact: true }).click()
  await dialog.getByLabel("Maintenance Category", { exact: true }).click(); await page.getByRole("option", { name: "Building / Facility", exact: true }).click()
  await dialog.getByLabel("Priority", { exact: true }).click(); await page.getByRole("option", { name: "High", exact: true }).click()
  await dialog.getByLabel("Issue / Request Title").fill("Global test")
  await dialog.getByLabel("Description", { exact: true }).fill("Fixture request")
  await dialog.getByRole("button", { name: "Submit Request", exact: true }).click()
  await expect.poll(() => state.payloads.length).toBe(1)
  expect(state.payloads[0]).toMatchObject({ area: "Preschool - 3 C", classroomAgeGroup: "PRESCHOOL", locationId: "two", priority: "HIGH" })
  expect(state.classroomRequests).toEqual([])
})

for (const width of [390, 430, 768, 1440]) test(`submenu keyboard, select styling and viewport at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await fixtures(page)
  const dialog = await openMaintenance(page), area = dialog.getByLabel("Classroom / Area", { exact: true })
  for (const label of ["Location", "Maintenance Category", "Priority", "Classroom / Area"]) {
    const trigger = dialog.getByLabel(label, { exact: true })
    await expect(trigger).toHaveClass(/min-h-10/)
    await expect(trigger).toHaveClass(/rounded-lg/)
    await expect(trigger).toHaveClass(/border-input/)
    expect(await trigger.evaluate((el) => el.tagName)).toBe("BUTTON")
  }
  await area.click(); await page.getByRole("menuitem", { name: "Preschool", exact: true }).click()
  await page.getByRole("menuitem", { name: "1", exact: true }).click()
  await insideViewport(page)
  await page.screenshot({ path: `test-results/classroom-menu-${width}.png` })
  await page.keyboard.press("Escape"); await expect(page.getByRole("menuitem", { name: "1", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowLeft"); await expect(page.getByRole("menuitem", { name: "Preschool", exact: true })).toBeFocused()
  await page.keyboard.press("Escape"); await expect(area).toBeFocused()
  await area.press("ArrowDown"); await page.getByRole("menuitem", { name: "Toddler", exact: true }).focus()
  await page.keyboard.press("ArrowRight"); await expect(page.getByRole("menuitem", { name: "Toddler A", exact: true })).toBeFocused()
  await page.keyboard.press("End"); await page.keyboard.press("Enter"); await expect(area).toContainText("Toddler C")
  const priority = dialog.getByLabel("Priority", { exact: true })
  await priority.focus(); await priority.press("ArrowDown"); await expect(page.getByRole("option", { name: "Normal", exact: true })).toBeFocused(); await page.keyboard.press("End"); await expect(page.getByRole("option", { name: "Urgent", exact: true })).toBeFocused(); await page.keyboard.press("Enter")
  await expect(priority).toContainText("Urgent")
  await expect(page.getByRole("listbox")).not.toBeVisible(); await expect(priority).toBeFocused(); await priority.press("ArrowDown"); await expect(page.getByRole("option", { name: "Urgent", exact: true })).toBeFocused(); await insideViewport(page); await page.keyboard.press("Escape"); await expect(page.getByRole("listbox")).not.toBeVisible(); await expect(priority).toBeFocused()
})

test("Custom requires nonblank text and never infers classroom identity", async ({ page }) => {
  const state = await fixtures(page), dialog = await openMaintenance(page)
  await dialog.getByLabel("Classroom / Area", { exact: true }).click(); await page.getByRole("menuitem", { name: "Custom", exact: true }).click()
  const custom = dialog.getByLabel("Custom area name")
  await custom.fill("   "); expect(await custom.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
  await custom.fill("Infant")
  await dialog.getByLabel("Maintenance Category", { exact: true }).click(); await page.getByRole("option", { name: "Building / Facility", exact: true }).click()
  await dialog.getByLabel("Issue / Request Title").fill("Custom test"); await dialog.getByLabel("Description", { exact: true }).fill("Fixture request")
  await dialog.getByRole("button", { name: "Submit Request", exact: true }).click()
  await expect.poll(() => state.payloads.length).toBe(1)
  expect(state.payloads[0]).toMatchObject({ area: "Infant" })
  expect(state.payloads[0]).not.toHaveProperty("classroomAgeGroup")
})

test("Users filters ignore stale responses and refresh lifecycle membership and totals", async ({ page }) => {
  const state = await fixtures(page); await page.goto("/admin/users")
  const filter = page.getByLabel("Status", { exact: true })
  await expect(page.locator("article")).toHaveCount(2); await expect(page.getByText("User disabled", { exact: true })).toHaveCount(0)
  expect(state.userRequests.at(-1)!.searchParams.getAll("status")).toEqual(["ACTIVE", "INVITED"])
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(filter).toBeVisible(); await insideViewport(page)
  }
  await filter.selectOption("disabled"); await expect(page.locator("article")).toHaveCount(1)
  await expect(page.getByText("User disabled", { exact: true })).toBeVisible()
  await filter.selectOption("all"); await expect(page.locator("article")).toHaveCount(3)
  state.slowStatus = "DISABLED"
  const pending = page.waitForRequest((request) => new URL(request.url()).searchParams.getAll("status").includes("DISABLED"))
  const staleResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.getAll("status").includes("DISABLED"))
  await filter.selectOption("disabled"); await pending; await filter.selectOption("active")
  await expect(page.getByText("User active", { exact: true })).toBeVisible(); await staleResponse
  await expect(page.locator("article")).toHaveCount(1); await expect(page.getByText("User disabled", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Disable", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Disable user", exact: true }).click()
  await expect(page.getByText("No active users found", { exact: true })).toBeVisible()
  state.slowStatus = ""; await filter.selectOption("disabled"); await expect(page.locator("article")).toHaveCount(2)
  const row = page.locator("article").filter({ hasText: "User active" })
  await row.getByRole("button", { name: "Reactivate", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Reactivate user", exact: true }).click()
  await expect(page.locator("article")).toHaveCount(1)
  await filter.selectOption("current"); await expect(page.locator("article")).toHaveCount(2)
  await page.getByRole("button", { name: "Invite user", exact: true }).click()
  const invite = page.getByRole("dialog", { name: "Invite user" })
  await invite.getByLabel("Full name").fill("New Invite"); await invite.getByLabel("Email", { exact: true }).fill("new@example.test")
  await invite.getByRole("combobox").selectOption("OWNER")
  await invite.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByRole("dialog", { name: "Invitation ready" })).toBeVisible()
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.locator("article")).toHaveCount(3)
})

test("Users resets page on filter and recovers a removed last page", async ({ page }) => {
  const state = await fixtures(page); state.users = Array.from({ length: 26 }, (_, index) => user(`active-${index}`, "ACTIVE"))
  await page.goto("/admin/users"); await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Disable", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Disable user", exact: true }).click()
  await expect(page.locator("article")).toHaveCount(25)
  expect(state.userRequests.at(-1)!.searchParams.get("page")).toBe("0")
  await page.getByLabel("Status", { exact: true }).selectOption("all")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  await page.getByLabel("Status", { exact: true }).selectOption("disabled")
  await expect(page.locator("article")).toHaveCount(1)
  expect(state.userRequests.at(-1)!.searchParams.get("page")).toBe("0")
})


test.describe("touch input", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test("touch can traverse Preschool levels and choose a global room", async ({ page }) => {
    await fixtures(page)
    const dialog = await openMaintenance(page), area = dialog.getByLabel("Classroom / Area", { exact: true })
    await area.tap()
    const preschool = page.getByRole("menuitem", { name: "Preschool", exact: true })
    await preschool.tap(); await expect(preschool).toHaveAttribute("aria-expanded", "true")
    const level = page.getByRole("menuitem", { name: "1", exact: true })
    await level.tap(); await expect(level).toHaveAttribute("aria-expanded", "true")
    await insideViewport(page)
    await page.getByRole("menuitem", { name: "Preschool - 1 B", exact: true }).tap()
    await expect(area).toContainText("Preschool - 1 B")
  })
})

for (const savedArea of ["Other", "Whole Location", "Arbitrary saved room", "Old classroom label"]) test(`history preserves ${savedArea} and allows Custom replacement`, async ({ page }) => {
  const state = await fixtures(page); state.showHistory = true; state.record.area = savedArea
  await page.goto("/maintenance/history"); await page.getByRole("button", { name: "Edit", exact: true }).click()
  let dialog = page.getByRole("dialog", { name: "Edit request details" })
  await dialog.getByLabel("Classroom / Area", { exact: true }).click()
  await expect(page.getByRole("menuitem", { name: `${savedArea} (saved area)`, exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await dialog.getByLabel("Title", { exact: true }).fill("Unrelated edit")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click(); await expect(dialog).not.toBeVisible()
  expect(state.payloads[0]).toMatchObject({ area: savedArea, classroomAgeGroup: "INFANT" })
  await page.getByRole("button", { name: "Edit", exact: true }).click(); dialog = page.getByRole("dialog", { name: "Edit request details" })
  await dialog.getByLabel("Classroom / Area", { exact: true }).click(); await page.getByRole("menuitem", { name: "Custom", exact: true }).click()
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click(); expect(state.payloads).toHaveLength(1)
  await dialog.getByLabel("Custom area name").fill("Infant A")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click(); await expect(dialog).not.toBeVisible()
  expect(state.payloads[1]).toMatchObject({ area: "Infant A" }); expect(state.payloads[1]).not.toHaveProperty("classroomAgeGroup")
})

test("menus flip and remain inside the viewport beside the bottom/right edge", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 600 }); await fixtures(page)
  const dialog = await openMaintenance(page), area = dialog.getByLabel("Classroom / Area", { exact: true })
  await area.evaluate((element: HTMLElement) => {
    Object.assign(element.style, { position: "fixed", bottom: "8px", right: "8px", width: "180px" })
  })
  await area.click(); await page.getByRole("menuitem", { name: "Preschool", exact: true }).click()
  await page.getByRole("menuitem", { name: "3", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Preschool - 3 C", exact: true })).toBeVisible()
  await insideViewport(page)
})


