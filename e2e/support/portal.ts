import { expect, type Locator, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { TestCredentials } from "./env"

export const uploadFixturePath = "e2e/fixtures/staging-upload.pdf"
export const uploadFixtureName = "staging-upload.pdf"

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${randomUUID().slice(0, 8)}`
}

export async function login(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email").fill(credentials.email)
  await page.getByLabel("Password").fill(credentials.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/)
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true }).first()).toBeVisible()
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/)
}

async function openCreatedItem(
  page: Page,
  path: string,
  searchLabel: string,
  title: string
): Promise<string> {
  await page.goto(path)
  await page.getByLabel(searchLabel).fill(title)
  const link = page.getByRole("link", { name: title, exact: true }).first()
  await expect(link).toBeVisible()
  await link.click()
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
  return new URL(page.url()).pathname
}

export async function createMaintenanceRequest(
  page: Page,
  title: string,
  locationName?: string
): Promise<string> {
  await page.goto("/maintenance")
  await page.getByRole("button", { name: "New Maintenance Request" }).click()
  const dialog = page.getByRole("dialog", { name: "New Maintenance Request" })
  if (locationName) await dialog.getByLabel("Location").selectOption({ label: locationName })
  await dialog.getByLabel("Classroom / Area").selectOption({ label: "Preschool" })
  await dialog.getByLabel("Maintenance Category").selectOption({ label: "Building / Facility" })
  await dialog.getByLabel("Issue / Request Title").fill(title)
  await dialog.getByLabel("Description").fill(`Disposable STG E2E maintenance request for ${title}`)
  await dialog.getByRole("button", { name: "Submit Request" }).click()
  await expect(dialog).toBeHidden()
  return openCreatedItem(page, "/maintenance", "Search maintenance requests", title)
}

export async function createSupplyRequest(page: Page, title: string): Promise<string> {
  await page.goto("/supply-requests")
  await page.getByRole("button", { name: "New Supply Request" }).click()
  const dialog = page.getByRole("dialog", { name: "New Supply Request" })
  await dialog.getByLabel("Classroom / Area").selectOption({ label: "Preschool" })
  await dialog.getByLabel("Category").selectOption({ label: "Supplies" })
  await dialog.getByLabel("Item / Request Title").fill(title)
  await dialog.getByLabel("Description").fill(`Disposable STG E2E supply request for ${title}`)
  await dialog.getByLabel("Quantity").fill("2")
  await dialog.getByRole("button", { name: "Submit Request" }).click()
  await expect(dialog).toBeHidden()
  return openCreatedItem(page, "/supply-requests", "Search supply requests", title)
}

async function selectPopupOption(group: Locator, option: string): Promise<void> {
  await group.getByRole("combobox").click()
  await group.page().getByRole("option", { name: option, exact: true }).click()
}

export async function createComplianceRecord(
  page: Page,
  title: string,
  locationName: string
): Promise<string> {
  await page.goto("/records")
  await page.getByRole("button", { name: "Create" }).click()
  await page.getByRole("menuitem", { name: "Upload Record" }).click()
  const dialog = page.getByRole("dialog", { name: "Upload Record" })

  await selectPopupOption(dialog.getByText("Record Area", { exact: true }).locator(".."), "Compliance")
  await selectPopupOption(dialog.getByText("Location", { exact: true }).locator(".."), locationName)
  await selectPopupOption(dialog.getByText("Compliance Category", { exact: true }).locator(".."), "Staff Complaints")
  await selectPopupOption(dialog.getByText("Record Type", { exact: true }).locator(".."), "Workplace Conduct")
  await dialog.getByRole("checkbox", { name: "Use custom title" }).check()
  await dialog.getByPlaceholder("Enter a descriptive record title").fill(title)
  await dialog.getByPlaceholder("Add context, notes, or details about this record...").fill(
    `Disposable STG E2E compliance record for ${title}`
  )
  await dialog.locator('input[type="file"]').setInputFiles(uploadFixturePath)
  await dialog.getByRole("button", { name: "Upload Record" }).click()
  await expect(dialog.getByText("Record uploaded successfully")).toBeVisible()
  await dialog.getByRole("button", { name: "Done" }).click()

  return openCreatedItem(page, "/records", "Search records", title)
}

export async function archiveMaintenanceIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive request", exact: true })
  if (!(await archive.isVisible().catch(() => false))) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this maintenance request?" })
  await dialog.getByRole("button", { name: "Archive Request" }).click()
  await expect(page).toHaveURL(/\/maintenance\/?(?:[?#].*)?$/)
  await expect(dialog).toBeHidden()
}

export async function archiveSupplyIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive request", exact: true })
  if (!(await archive.isVisible().catch(() => false))) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this supply request?" })
  await dialog.getByRole("button", { name: "Archive Request" }).click()
  await expect(page).toHaveURL(/\/supply-requests\/?(?:[?#].*)?$/)
  await expect(dialog).toBeHidden()
}

export async function archiveRecordIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive Record", exact: true }).first()
  if (!(await archive.isVisible().catch(() => false))) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this record?" })
  await dialog.getByRole("button", { name: "Archive Record", exact: true }).click()
  await expect(page).toHaveURL(/\/records\/?(?:[?#].*)?$/)
  await expect(dialog).toBeHidden()
}
