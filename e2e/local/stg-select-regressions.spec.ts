import { expect, test } from "@playwright/test"
import { fixtures } from "../support/polish-fixtures"
import { selectClassroomArea, selectPopupOption, withSelectOptions } from "../support/select"
import { clickAndWaitForApi } from "../support/portal"

test("option inspection checks the open popup and closes it even after a failed assertion", async ({ page }) => {
  await fixtures(page); await page.goto("/maintenance")
  const trigger = page.getByLabel("Filter by location", { exact: true })
  await withSelectOptions(trigger, async (popup) => {
    await expect(popup.getByRole("option", { name: "Location one", exact: true })).toBeVisible()
    await expect(popup.getByRole("option", { name: "Unassigned location", exact: true })).toHaveCount(0)
  })
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(trigger).toBeFocused()
  await expect(withSelectOptions(trigger, async () => { throw new Error("Inspection failed") })).rejects.toThrow("Inspection failed")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("listbox")).toHaveCount(0)
})

for (const role of ["OWNER", "DIRECTOR"] as const) test(`Maintenance preserves ${role} selections after an unrelated store refresh`, async ({ page }) => {
  const state = await fixtures(page, { role })
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route("**/api/dashboard/summary", async (route) => {
    await pending
    await route.fulfill({ json: {
      month: "2026-11", generatedAt: "2026-11-12", needsReview: { total: 0, records: 0, maintenance: 0, supply: 0 },
      records: { active: 0, newCount: 0, needsAttention: 0, reviewed: 0, compliance: 0, operations: 0 },
      maintenance: { open: 7, awaitingApproval: 0, inProgress: 0, completedThisMonth: 0, costThisMonth: 0 },
      supply: { open: 0, awaitingApproval: 0, orderedOrInTransit: 0, receivedThisMonth: 0, spendThisMonth: 0 }, operationalRequests: [],
    } })
  })
  try {
    await page.goto("/maintenance")
    await page.getByRole("button", { name: "New Maintenance Request", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "New Maintenance Request" })
    const location = dialog.getByLabel("Location", { exact: true }), area = dialog.getByLabel("Classroom / Area", { exact: true })
    if (role === "OWNER") await selectPopupOption(location, "Location two")
    await selectClassroomArea(area, "Kitchen")
    await selectPopupOption(dialog.getByLabel("Maintenance Category", { exact: true }), "Building / Facility")
    await dialog.getByLabel("Issue / Request Title").fill("Background refresh regression")
    await dialog.getByLabel("Description", { exact: true }).fill("Keep the user's selected classroom or facility area")
    release()
    // The rendered summary proves the delayed response has updated the shared app store.
    await expect(page.getByText("7", { exact: true })).toBeVisible()
    await expect(area).toContainText("Kitchen")
    await expect(location).toContainText(role === "OWNER" ? "Location two" : "Location one")
    await expect(dialog.getByLabel("Maintenance Category", { exact: true })).toContainText("Building / Facility")
    await expect(dialog.getByRole("button", { name: "Submit Request", exact: true })).toBeEnabled()
    await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Submit Request", exact: true }), {
      label: "Create maintenance after background refresh", method: "POST", path: "/api/maintenance",
    })
    await expect.poll(() => state.payloads.length).toBe(1)
    expect(state.payloads[0]).toMatchObject({ area: "Kitchen", category: "BUILDING_FACILITY", locationId: role === "OWNER" ? "two" : "one" })
  } finally {
    release()
  }
})
