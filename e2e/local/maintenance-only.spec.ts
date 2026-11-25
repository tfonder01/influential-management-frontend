import { expect, test } from "@playwright/test"
import { fixtures } from "../support/polish-fixtures"

for (const width of [390, 1440]) {
  for (const role of ["OWNER", "MAINTENANCE"] as const) {
    test(`${role} Maintenance detail at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      const calls: string[] = []
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname
        if (path.startsWith("/api/")) calls.push(path)
      })
      const data = await fixtures(page, { role })
      data.showHistory = true
      data.record.status = "COMPLETED"
      data.record.completedAt = "2026-01-02T12:00:00Z"
      data.record.updatedAt = data.record.completedAt

      await page.goto("/maintenance/history")
      await expect(page.getByRole("heading", { name: "Historical request" })).toBeVisible()
      const worker = role === "MAINTENANCE"
      await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toHaveCount(worker ? 0 : 1)
      await expect(page.getByText("Add Supporting Document", { exact: true })).toHaveCount(worker ? 1 : 0)
      await expect(page.getByRole("button", { name: "Reopen Maintenance Request" })).toHaveCount(worker ? 0 : 1)
      if (worker) {
        await expect(page.getByText("Loading users...", { exact: true })).toHaveCount(0)
        await expect(page.getByText("Unassigned", { exact: true })).toBeVisible()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath("maintenance-detail.png"), fullPage: true })
      await page.getByRole("region", { name: worker ? "Supporting documents" : "Invoices", exact: true })
        .screenshot({ path: testInfo.outputPath("maintenance-attachments.png") })

      if (worker) {
        await page.goto("/dashboard")
        await expect(page).toHaveURL(/\/maintenance$/)
        await expect(page.getByRole("link", { name: /^Historical request/ })).toBeVisible()
        expect(calls).not.toContain("/api/dashboard/summary")
        expect(calls).not.toContain("/api/records")
        expect(calls).not.toContain("/api/supply-requests")
        await page.screenshot({ path: testInfo.outputPath("maintenance-list.png"), fullPage: true })
      }
    })
  }
}
