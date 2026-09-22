import { expect, test } from "@playwright/test"
import {
  directorCredentials,
  locationFixtures,
  ownerCredentials,
} from "./support/env"
import {
  archiveMaintenanceIfActive,
  archiveRecordIfActive,
  archiveSupplyIfActive,
  createComplianceRecord,
  createMaintenanceRequest,
  createSupplyRequest,
  login,
  logout,
  uniqueName,
  uploadFixtureName,
} from "./support/portal"

test.describe("Influential Management STG critical paths", () => {
  test("Owner login survives refresh and logout protects the dashboard", async ({ page }) => {
    await login(page, ownerCredentials())

    await page.reload()
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/)
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true }).first()).toBeVisible()

    await logout(page)
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard$/)
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible()
  })

  test("Director sees assigned-location data and cannot open another location's request", async ({ browser }) => {
    const owner = await browser.newPage()
    const director = await browser.newPage()
    const title = uniqueName("E2E restricted maintenance")
    const { directorLocationName, restrictedLocationName } = locationFixtures()
    let requestPath: string | undefined

    try {
      await login(owner, ownerCredentials())
      requestPath = await createMaintenanceRequest(owner, title, restrictedLocationName)
      const requestId = requestPath.split("/").at(-1)
      expect(requestId).toBeTruthy()

      await login(director, directorCredentials())
      await director.goto("/maintenance")
      const locationFilter = director.getByLabel("Filter by location")
      await expect(locationFilter.locator("option", { hasText: directorLocationName })).toHaveCount(1)
      await expect(locationFilter.locator("option", { hasText: restrictedLocationName })).toHaveCount(0)
      await expect(director.getByText(title, { exact: true })).toHaveCount(0)

      const detailResponse = director.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes(`/api/maintenance/${requestId}`)
      )
      await director.goto(requestPath)
      const response = await detailResponse
      expect([403, 404]).toContain(response.status())
      await expect(director.getByRole("heading", { name: title, exact: true })).toHaveCount(0)
    } finally {
      if (requestPath) await archiveMaintenanceIfActive(owner, requestPath)
      await owner.close()
      await director.close()
    }
  })

  test("Maintenance request is approved, completed, archived, and restored", async ({ page }) => {
    const title = uniqueName("E2E maintenance")
    let requestPath: string | undefined

    try {
      await login(page, directorCredentials())
      requestPath = await createMaintenanceRequest(page, title)
      await expect(page.getByText("Awaiting Approval", { exact: true }).first()).toBeVisible()

      await logout(page)
      await login(page, ownerCredentials())
      await page.goto(requestPath)
      await page.getByRole("button", { name: "Approve", exact: true }).click()
      await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Mark In Progress" }).click()
      await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Mark Complete" }).click()
      await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible()

      await archiveMaintenanceIfActive(page, requestPath)
      await page.goto("/archived")
      const archivedItem = page.getByText(title, { exact: true }).first().locator("..").locator("..")
      await expect(archivedItem).toBeVisible()
      await archivedItem.getByRole("button", { name: "Restore" }).click()
      await expect(archivedItem).toBeHidden()

      await page.goto("/maintenance")
      await page.getByLabel("Search maintenance requests").fill(title)
      await expect(page.getByRole("link", { name: title, exact: true }).first()).toBeVisible()
    } finally {
      if (requestPath) await archiveMaintenanceIfActive(page, requestPath)
    }
  })

  test("Supply request is approved, ordered, received, and archived for cleanup", async ({ page }) => {
    const title = uniqueName("E2E supply")
    let requestPath: string | undefined

    try {
      await login(page, directorCredentials())
      requestPath = await createSupplyRequest(page, title)
      await expect(page.getByText("Awaiting Approval", { exact: true }).first()).toBeVisible()

      await logout(page)
      await login(page, ownerCredentials())
      await page.goto(requestPath)
      await page.getByRole("button", { name: "Approve", exact: true }).click()
      await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Mark Ordered" }).click()
      await expect(page.getByText("Ordered", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Mark Received" }).click()
      await expect(page.getByText("Received", { exact: true }).first()).toBeVisible()
    } finally {
      if (requestPath) await archiveSupplyIfActive(page, requestPath)
    }
  })

  test("Compliance record renders, downloads its private file, archives, and restores", async ({ page }) => {
    const title = uniqueName("E2E compliance")
    const { directorLocationName } = locationFixtures()
    let recordPath: string | undefined

    try {
      await login(page, ownerCredentials())
      recordPath = await createComplianceRecord(page, title, directorLocationName)
      await expect(page.getByText("Staff Complaints", { exact: true }).first()).toBeVisible()
      await expect(page.getByText(`Disposable STG E2E compliance record for ${title}`)).toBeVisible()
      await expect(page.getByText(uploadFixtureName, { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: `Open ${uploadFixtureName} in new tab` })).toBeVisible()

      const downloadPromise = page.waitForEvent("download")
      await page.getByRole("button", { name: `Download ${uploadFixtureName}` }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe(uploadFixtureName)

      await archiveRecordIfActive(page, recordPath)
      await page.goto("/archived")
      const archivedLink = page.getByRole("link", { name: `Open ${title}` })
      const archivedRow = page.getByRole("row").filter({ has: archivedLink })
      await expect(archivedRow).toBeVisible()
      await archivedRow.getByRole("button", { name: "Restore" }).click()
      await expect(archivedRow).toBeHidden()

      await page.goto("/records")
      await page.getByLabel("Search records").fill(title)
      await expect(page.getByRole("link", { name: `Open ${title}` })).toBeVisible()
    } finally {
      if (recordPath) await archiveRecordIfActive(page, recordPath)
    }
  })
})
