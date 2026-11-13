import { expect, test, type Page } from "@playwright/test"
import { fixtures, user } from "../support/polish-fixtures"
import { selectPopupOption } from "../support/select"

const dialog = (page: Page) => page.getByRole("dialog", { name: "Delete this unused invitation permanently?" })
const row = (page: Page, id: string) => page.locator("article").filter({ has: page.getByText(`User ${id}`, { exact: true }) })
async function invite(page: Page, email: string) {
  await page.getByRole("button", { name: "Invite user", exact: true }).click()
  const form = page.getByRole("dialog", { name: "Invite user", exact: true })
  await form.getByLabel("Full name").fill("Disposable Invite")
  await form.getByLabel("Email", { exact: true }).fill(email)
  await selectPopupOption(form.getByRole("combobox"), "Owner")
  await form.getByRole("button", { name: "Send invitation" }).click()
  await page.getByRole("dialog", { name: "Invitation ready" }).getByRole("button", { name: "Done", exact: true }).click()
}

test("only explicit API eligibility enables deletion, including disabled invitations", async ({ page }) => {
  const state = await fixtures(page)
  state.users = [user("active", "ACTIVE"), user("invited", "INVITED"), user("disabled-real", "DISABLED"),
    { ...user("disabled-invite", "DISABLED"), canDeletePermanently: true },
    { ...user("legacy", "INVITED"), canDeletePermanently: undefined }]
  await page.goto("/admin/users")
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "All Users")
  await expect(row(page, "active").getByRole("button", { name: "Delete permanently" })).toHaveCount(0)
  await expect(row(page, "disabled-real").getByRole("button", { name: "Delete permanently" })).toHaveCount(0)
  await expect(row(page, "legacy").getByRole("button", { name: "Delete permanently" })).toHaveCount(0)
  await expect(row(page, "invited").getByRole("button", { name: "Delete permanently" })).toBeVisible()
  await expect(row(page, "disabled-invite").getByRole("button", { name: "Delete permanently" })).toBeVisible()
})

for (const width of [390, 430, 768, 1440]) test(`confirmation, cancel, keyboard focus and containment at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await fixtures(page)
  await page.goto("/admin/users")
  const trigger = row(page, "invited").getByRole("button", { name: "Delete permanently" })
  await trigger.click()
  await expect(dialog(page)).toContainText("invited@example.test")
  await expect(dialog(page)).toContainText("cannot be undone")
  await expect(dialog(page)).toContainText("invite this email again")
  expect(await dialog(page).evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath(`confirmation-${width}.png`), animations: "disabled" })
  await dialog(page).getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(state.deleteRequests).toEqual([])
  await trigger.press("Enter")
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toBeHidden()
  expect(state.deleteRequests).toEqual([])
})

test("pending deletion prevents duplicate and conflicting actions and waits for 204", async ({ page }) => {
  const state = await fixtures(page)
  let release!: () => void
  state.deleteGate = new Promise<void>((resolve) => { release = resolve })
  await page.goto("/admin/users")
  await row(page, "invited").getByRole("button", { name: "Delete permanently" }).click()
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click()
  await expect(dialog(page).getByRole("button", { name: "Delete permanently", exact: true })).toBeDisabled()
  await expect(dialog(page).getByRole("button", { name: "Cancel", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Invite user", exact: true, includeHidden: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Edit access", includeHidden: true }).first()).toBeDisabled()
  await page.keyboard.press("Escape"); await expect(dialog(page)).toBeVisible()
  await expect(page.getByText("Unused invitation permanently deleted", { exact: true })).toHaveCount(0)
  await expect(row(page, "invited")).toBeVisible()
  release()
  await expect(dialog(page)).toBeHidden()
  await expect(row(page, "invited")).toHaveCount(0)
  await expect(page.getByText("Unused invitation permanently deleted", { exact: true })).toBeVisible()
  expect(state.deleteRequests).toEqual(["invited"])
  await expect(page.getByRole("heading", { name: "User administration", exact: true })).toBeFocused()
})

test("stale eligibility displays safe backend errors and retains the account", async ({ page }) => {
  const state = await fixtures(page); state.deleteError = "This account completed setup. Disable it instead."
  await page.goto("/admin/users")
  await row(page, "invited").getByRole("button", { name: "Delete permanently" }).click()
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click()
  await expect(dialog(page).getByRole("alert")).toHaveText(state.deleteError)
  await expect(row(page, "invited")).toBeVisible()
  await expect(page.getByText("Unused invitation permanently deleted", { exact: true })).toHaveCount(0)
})

test("a non-204 success response never reports deletion success", async ({ page }) => {
  const state = await fixtures(page); state.deleteStatus = 200
  await page.goto("/admin/users")
  await row(page, "invited").getByRole("button", { name: "Delete permanently" }).click()
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click()
  await expect(dialog(page).getByRole("alert")).toContainText("deletion was not confirmed")
  await expect(row(page, "invited")).toBeVisible()
})

test("deleting the last filtered page repairs pagination and preserves the status filter", async ({ page }) => {
  const state = await fixtures(page)
  state.users = Array.from({ length: 26 }, (_, index) => ({ ...user(`pending-${index}`, "DISABLED"), canDeletePermanently: true }))
  await page.goto("/admin/users")
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "Disabled")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  await row(page, "pending-25").getByRole("button", { name: "Delete permanently" }).click()
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click()
  await expect(page.locator("article")).toHaveCount(25)
  await expect(page.getByLabel("Status", { exact: true })).toContainText("Disabled")
  expect(state.userRequests.at(-1)!.searchParams.get("page")).toBe("0")
  expect(state.userRequests.at(-1)!.searchParams.getAll("status")).toEqual(["DISABLED"])
})

test("invite, disable, delete and reinvite keeps filter and creates a new identity", async ({ page }) => {
  const state = await fixtures(page)
  await page.goto("/admin/users")
  const email = "disposable@example.test"
  await invite(page, email)
  const original = state.users.find((item) => item.email === email)!.id
  let card = page.locator("article").filter({ hasText: email })
  await card.getByRole("button", { name: "Disable", exact: true }).click()
  await page.getByRole("dialog", { name: "Disable this user?" }).getByRole("button", { name: "Disable user", exact: true }).click()
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "Disabled")
  await card.getByRole("button", { name: "Delete permanently" }).click()
  await dialog(page).getByRole("button", { name: "Delete permanently", exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByLabel("Status", { exact: true })).toContainText("Disabled")
  await invite(page, email)
  expect(state.users.find((item) => item.email === email)!.id).not.toBe(original)
  await expect(page.getByLabel("Status", { exact: true })).toContainText("Disabled")
  await selectPopupOption(page.getByLabel("Status", { exact: true }), "Invited")
  card = page.locator("article").filter({ hasText: email })
  await expect(card).toHaveCount(1)
})
