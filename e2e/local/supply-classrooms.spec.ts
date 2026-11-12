import { expect, test, type Page } from "@playwright/test"
import { GLOBAL_CLASSROOM_GROUPS, FACILITY_AREAS } from "../../lib/maintenance-area-options"
import { setup, openSupply } from "../support/select-fixtures"
import { selectClassroomArea, selectPopupOption } from "../support/select"

async function hoverItem(page: Page, name: string) {
  const item = page.getByRole("menuitem", { name, exact: true }), box = (await item.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await item.hover()
}

async function menusInsideViewport(page: Page) {
  const viewport = page.viewportSize()!
  for (const menu of await page.getByRole("menu").all()) {
    const bounds = (await menu.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test("Supply exposes the shared 21-room hierarchy with hover and click selection", async ({ page }) => {
  await setup(page); const dialog = await openSupply(page), area = dialog.getByLabel("Classroom / Area")
  await expect(area).toContainText("Not specified")
  await area.click()
  for (const name of ["Not specified", ...FACILITY_AREAS, "Custom"]) await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible()
  for (const name of ["Whole Location", "Other"]) await expect(page.getByRole("menuitem", { name, exact: true })).toHaveCount(0)
  for (const group of GLOBAL_CLASSROOM_GROUPS) {
    await hoverItem(page, group.label)
    for (const room of group.rooms) await expect(page.getByRole("menuitem", { name: room, exact: true })).toBeVisible()
    for (const branch of group.branches) {
      await hoverItem(page, branch.level)
      for (const room of branch.rooms) await expect(page.getByRole("menuitem", { name: room, exact: true })).toBeVisible()
    }
  }
  await page.getByRole("menuitem", { name: "Preschool - 3 C", exact: true }).click()
  await expect(area).toContainText("Preschool - 3 C")
  await selectPopupOption(dialog.getByLabel("Location", { exact: true }), "Location two")
  await expect(area).toContainText("Preschool - 3 C")
})

test("Supply creates each age-group classification through the unchanged API contract", async ({ page }) => {
  const state = await setup(page)
  const choices = [["Infant A", "INFANT"], ["Toddler C", "TODDLER"], ["Twaddler A", "TWADDLER"], ["Prepper B", "PREPPER"], ["Preschool - 2 C", "PRESCHOOL"]]
  for (const [area, classroomAgeGroup] of choices) {
    const dialog = await openSupply(page)
    await selectClassroomArea(dialog.getByLabel("Classroom / Area"), area)
    await selectPopupOption(dialog.getByLabel("Category", { exact: true }), "Supplies")
    await dialog.getByLabel("Item / Request Title").fill(`For ${area}`)
    await dialog.getByLabel("Description", { exact: true }).fill("Global classroom fixture")
    const count = state.supply.length
    await dialog.getByRole("button", { name: "Submit Request", exact: true }).click()
    await expect.poll(() => state.supply.length).toBe(count + 1)
    expect(state.supply.at(-1)).toMatchObject({ area, classroomAgeGroup, priority: "MEDIUM", locationId: "one" })
  }
})

for (const selection of ["Not specified", ...FACILITY_AREAS, "Custom"]) test(`Supply optional/facility selection: ${selection}`, async ({ page }) => {
  const state = await setup(page), dialog = await openSupply(page)
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), "Infant A")
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), selection)
  await selectPopupOption(dialog.getByLabel("Category", { exact: true }), "Supplies")
  await dialog.getByLabel("Item / Request Title").fill("Area fixture")
  await dialog.getByLabel("Description", { exact: true }).fill("No classroom classification")
  if (selection === "Custom") {
    const custom = dialog.getByLabel("Custom area name")
    await custom.fill("   ")
    await dialog.getByRole("button", { name: "Submit Request", exact: true }).click()
    expect(state.supply).toHaveLength(0)
    expect(await custom.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
    // A custom value must not infer classification, even if it resembles a standard room.
    await custom.fill("Infant A")
  }
  await dialog.getByRole("button", { name: "Submit Request", exact: true }).click()
  await expect.poll(() => state.supply.length).toBe(1)
  expect(state.supply[0]).not.toHaveProperty("classroomAgeGroup")
  if (selection === "Not specified") expect(state.supply[0]).not.toHaveProperty("area")
  else expect(state.supply[0]).toMatchObject({ area: selection === "Custom" ? "Infant A" : selection })
})

for (const area of ["Preschool", "Other", "Whole Location", "Arbitrary saved room", "Toddler B"]) test(`Supply edit preserves and replaces historical area: ${area}`, async ({ page }) => {
  const state = await setup(page)
  Object.assign(state.supplyRecord, { area, classroomAgeGroup: "PRESCHOOL" })
  await page.goto("/supply-requests/supply-saved")
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  let dialog = page.getByRole("dialog", { name: "Edit request details" })
  await expect(dialog.getByLabel("Classroom / Area")).toContainText(area)
  await dialog.getByLabel("Classroom / Area").click()
  if (area !== "Toddler B") await expect(page.getByRole("menuitem", { name: `${area} (saved area)`, exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await dialog.getByLabel("Item / Title", { exact: true }).fill("Unrelated title edit")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.supply[0]).toMatchObject({ area, classroomAgeGroup: "PRESCHOOL" })
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "Edit request details" })
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), "Toddler C")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.supply[1]).toMatchObject({ area: "Toddler C", classroomAgeGroup: "TODDLER" })
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "Edit request details" })
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), "Not specified")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.supply[2]).not.toHaveProperty("area")
  expect(state.supply[2]).not.toHaveProperty("classroomAgeGroup")
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await expect(page.getByRole("dialog").getByLabel("Classroom / Area")).toContainText("Not specified")
})

test("Supply edit requires Custom text and never infers its classification", async ({ page }) => {
  const state = await setup(page); await page.goto("/supply-requests/supply-saved")
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Edit request details" })
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), "Custom")
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
  await dialog.getByLabel("Custom area name").fill("   ")
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
  await dialog.getByLabel("Custom area name").fill("Preschool - 2 C")
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect.poll(() => state.supply.length).toBe(1)
  expect(state.supply[0]).toMatchObject({ area: "Preschool - 2 C" })
  expect(state.supply[0]).not.toHaveProperty("classroomAgeGroup")
})

for (const width of [390, 430, 768, 1440]) test(`Supply cascade keyboard and viewport at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 }); await setup(page)
  const dialog = await openSupply(page), area = dialog.getByLabel("Classroom / Area")
  await area.focus(); await area.press("Space")
  await page.getByRole("menuitem", { name: "Preschool", exact: true }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("menuitem", { name: "1", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("menuitem", { name: "Preschool - 1 A", exact: true })).toBeFocused()
  await menusInsideViewport(page)
  await page.keyboard.press("End"); await page.keyboard.press("Enter")
  await expect(area).toContainText("Preschool - 1 C"); await expect(area).toBeFocused()
  await area.press("Enter"); await page.keyboard.press("Escape"); await expect(area).toBeFocused()
  await area.evaluate((element: HTMLElement) => Object.assign(element.style, { position: "fixed", right: "8px", bottom: "8px", width: "180px" }))
  await area.click(); await page.getByRole("menuitem", { name: "Preschool", exact: true }).click()
  await page.getByRole("menuitem", { name: "3", exact: true }).click()
  await menusInsideViewport(page)
  await page.screenshot({ path: `test-results/supply-classrooms-${width}.png` })
})

test.describe("Supply touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
  test("tap traverses the global hierarchy and optional clearing", async ({ page }) => {
    await setup(page); const dialog = await openSupply(page), area = dialog.getByLabel("Classroom / Area")
    await area.tap(); await page.getByRole("menuitem", { name: "Preschool", exact: true }).tap()
    await page.getByRole("menuitem", { name: "2", exact: true }).tap(); await menusInsideViewport(page)
    await page.getByRole("menuitem", { name: "Preschool - 2 B", exact: true }).tap()
    await expect(area).toContainText("Preschool - 2 B")
    await area.tap(); await page.getByRole("menuitem", { name: "Not specified", exact: true }).tap()
    await expect(area).toContainText("Not specified")
  })
})
