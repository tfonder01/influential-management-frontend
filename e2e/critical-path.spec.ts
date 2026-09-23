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
  clickAndWaitForApi,
  createComplianceRecord,
  createMaintenanceRequest,
  createSupplyRequest,
  ensureNextActionReady,
  expectUiAfterMutation,
  login,
  logout,
  uniqueName,
  uploadFixtureName,
  workflowProgress,
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
    let workflowCompleted = false

    try {
      await login(page, directorCredentials())
      requestPath = await createMaintenanceRequest(page, title)
      await expect(page.getByText("Awaiting Approval", { exact: true }).first()).toBeVisible()

      await logout(page)
      await login(page, ownerCredentials())
      await page.goto(requestPath)
      const requestId = requestPath.split("/").at(-1)
      expect(requestId).toBeTruthy()
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Approve", exact: true }), {
        label: "Approve maintenance request",
        method: "POST",
        path: `/api/maintenance/${requestId}/approve`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Maintenance", "Approved / Ready"),
        "Approve maintenance request"
      )
      await ensureNextActionReady(
        page,
        page.getByRole("button", { name: "Mark In Progress" }),
        workflowProgress(page, "Maintenance", "Approved / Ready"),
        "Approve maintenance request"
      )
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Mark In Progress" }), {
        label: "Mark maintenance request in progress",
        method: "PATCH",
        path: `/api/maintenance/${requestId}/status`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Maintenance", "In Progress"),
        "Mark maintenance request in progress"
      )
      await ensureNextActionReady(
        page,
        page.getByRole("button", { name: "Mark Complete" }),
        workflowProgress(page, "Maintenance", "In Progress"),
        "Mark maintenance request in progress"
      )
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Mark Complete" }), {
        label: "Complete maintenance request",
        method: "PATCH",
        path: `/api/maintenance/${requestId}/status`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Maintenance", "Completed"),
        "Complete maintenance request"
      )

      await archiveMaintenanceIfActive(page, requestPath)
      await page.goto("/archived")
      const archivedLink = page.getByRole("link", { name: title, exact: true })
      await expectUiAfterMutation(archivedLink, "Archive maintenance request")
      await archivedLink.click()
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Restore request", exact: true }), {
        label: "Restore maintenance request",
        method: "POST",
        path: `/api/maintenance/${requestId}/restore`,
      })
      await expectUiAfterMutation(
        page.getByRole("button", { name: "Archive request", exact: true }),
        "Restore maintenance request"
      )

      await page.goto("/maintenance")
      await page.getByLabel("Search maintenance requests").fill(title)
      await expectUiAfterMutation(
        page.getByRole("link", { name: title, exact: true }).first(),
        "Restore maintenance request"
      )
      workflowCompleted = true
    } finally {
      if (requestPath) {
        try {
          await archiveMaintenanceIfActive(page, requestPath)
        } catch (cleanupError) {
          if (workflowCompleted) throw cleanupError
          console.warn("[e2e] Maintenance cleanup did not complete after the primary test failure.")
        }
      }
    }
  })

  test("Supply request is approved, ordered, received, and archived for cleanup", async ({ page }) => {
    const title = uniqueName("E2E supply")
    let requestPath: string | undefined
    let workflowCompleted = false

    try {
      await login(page, directorCredentials())
      requestPath = await createSupplyRequest(page, title)
      await expect(page.getByText("Awaiting Approval", { exact: true }).first()).toBeVisible()

      await logout(page)
      await login(page, ownerCredentials())
      await page.goto(requestPath)
      const requestId = requestPath.split("/").at(-1)
      expect(requestId).toBeTruthy()
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Approve", exact: true }), {
        label: "Approve supply request",
        method: "POST",
        path: `/api/supply-requests/${requestId}/approve`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Supply", "Approved / Ready"),
        "Approve supply request"
      )
      await ensureNextActionReady(
        page,
        page.getByRole("button", { name: "Mark Ordered" }),
        workflowProgress(page, "Supply", "Approved / Ready"),
        "Approve supply request"
      )
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Mark Ordered" }), {
        label: "Mark supply request ordered",
        method: "PATCH",
        path: `/api/supply-requests/${requestId}/status`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Supply", "Ordered"),
        "Mark supply request ordered"
      )
      await ensureNextActionReady(
        page,
        page.getByRole("button", { name: "Mark Received" }),
        workflowProgress(page, "Supply", "Ordered"),
        "Mark supply request ordered"
      )
      await clickAndWaitForApi(page, page.getByRole("button", { name: "Mark Received" }), {
        label: "Mark supply request received",
        method: "PATCH",
        path: `/api/supply-requests/${requestId}/status`,
      })
      await expectUiAfterMutation(
        workflowProgress(page, "Supply", "Received"),
        "Mark supply request received"
      )
      workflowCompleted = true
    } finally {
      if (requestPath) {
        try {
          await archiveSupplyIfActive(page, requestPath)
        } catch (cleanupError) {
          if (workflowCompleted) throw cleanupError
          console.warn("[e2e] Supply cleanup did not complete after the primary test failure.")
        }
      }
    }
  })

  test("Compliance record renders, downloads its private file, archives, and restores", async ({ page }) => {
    const title = uniqueName("E2E compliance")
    const { directorLocationName } = locationFixtures()
    let recordPath: string | undefined
    let workflowCompleted = false

    try {
      await login(page, ownerCredentials())
      recordPath = await createComplianceRecord(page, title, directorLocationName)
      await expect(page.getByText("Staff Complaints", { exact: true }).first()).toBeVisible()
      await expect(page.getByText(`Disposable STG E2E compliance record for ${title}`)).toBeVisible()
      await expect(page.getByText(uploadFixtureName, { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: `Open ${uploadFixtureName} in new tab` })).toBeVisible()

      const downloadPromise = page.waitForEvent("download", { timeout: 45_000 })
      await page.getByRole("button", { name: `Download ${uploadFixtureName}` }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe(uploadFixtureName)

      await archiveRecordIfActive(page, recordPath)
      await page.goto("/archived")
      const archivedOpenButton = page.getByRole("button", { name: `Open ${title}`, exact: true })
      const archivedRow = page.getByRole("row").filter({ has: archivedOpenButton })
      await expectUiAfterMutation(archivedRow, "Archive compliance record")
      const recordId = recordPath.split("/").at(-1)
      expect(recordId).toBeTruthy()
      await clickAndWaitForApi(page, archivedRow.getByRole("button", { name: "Restore" }), {
        label: "Restore compliance record",
        method: "POST",
        path: `/api/records/${recordId}/restore`,
      })
      await expect(archivedRow).toBeHidden({ timeout: 20_000 })

      await page.goto("/records")
      await page.getByRole("textbox", { name: "Search records...", exact: true }).fill(title)
      await expectUiAfterMutation(
        page.getByRole("link", { name: `Open ${title}` }),
        "Restore compliance record"
      )
      workflowCompleted = true
    } finally {
      if (recordPath) {
        try {
          await archiveRecordIfActive(page, recordPath)
        } catch (cleanupError) {
          if (workflowCompleted) throw cleanupError
          console.warn("[e2e] Compliance cleanup did not complete after the primary test failure.")
        }
      }
    }
  })
})
