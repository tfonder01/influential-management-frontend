import { selectPopupOption } from "../support/select"
import { expect, test, type Page } from "@playwright/test"
import { fixtures, user } from "../support/polish-fixtures"
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
  await selectPopupOption(filter, "Disabled"); await expect(page.locator("article")).toHaveCount(1)
  await expect(page.getByText("User disabled", { exact: true })).toBeVisible()
  await selectPopupOption(filter, "All Users"); await expect(page.locator("article")).toHaveCount(3)
  state.slowStatus = "DISABLED"
  const pending = page.waitForRequest((request) => new URL(request.url()).searchParams.getAll("status").includes("DISABLED"))
  const staleResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.getAll("status").includes("DISABLED"))
  await selectPopupOption(filter, "Disabled"); await pending; await selectPopupOption(filter, "Active")
  await expect(page.getByText("User active", { exact: true })).toBeVisible(); await staleResponse
  await expect(page.locator("article")).toHaveCount(1); await expect(page.getByText("User disabled", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Disable", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Disable user", exact: true }).click()
  await expect(page.getByText("No active users found", { exact: true })).toBeVisible()
  state.slowStatus = ""; await selectPopupOption(filter, "Disabled"); await expect(page.locator("article")).toHaveCount(2)
  const row = page.locator("article").filter({ hasText: "User active" })
  await row.getByRole("button", { name: "Reactivate", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Reactivate user", exact: true }).click()
  await expect(page.locator("article")).toHaveCount(1)
  await selectPopupOption(filter, "Active & Invited"); await expect(page.locator("article")).toHaveCount(2)
  await page.getByRole("button", { name: "Invite user", exact: true }).click()
  const invite = page.getByRole("dialog", { name: "Invite user" })
  await invite.getByLabel("Full name").fill("New Invite"); await invite.getByLabel("Email", { exact: true }).fill("new@example.test")
  await selectPopupOption(invite.getByRole("combobox"), "Owner")
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
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "All Users")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "Disabled")
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


