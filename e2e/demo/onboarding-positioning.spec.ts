import { expect, test, type Page } from "@playwright/test"

const viewportSizes = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
]

async function expectTooltipInsideViewport(page: Page) {
  const tooltip = page.locator("[data-tour-tooltip]")
  await expect(tooltip).toBeVisible()
  const bounds = await tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    }
  })
  const margin = 15
  expect(bounds.top).toBeGreaterThanOrEqual(margin)
  expect(bounds.left).toBeGreaterThanOrEqual(margin)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - margin)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight - margin)
}

test("Owner demo tour keeps every tooltip inside desktop, tablet, and mobile viewports", async ({ page }) => {
  const onboardingRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/users/me/onboarding") onboardingRequests.push(request.method())
  })

  await page.setViewportSize(viewportSizes[1])
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Help & support", exact: true }).click()
  await page.getByRole("button", { name: "Preview walkthrough", exact: true }).click()

  const expectedTargets = [
    "dashboard-overview",
    "needs-review-overview",
    "locations-overview",
    "users-overview",
    "settings-overview",
    "support-entry",
  ]

  for (const [index, target] of expectedTargets.entries()) {
    await expect(page.locator(`[data-tour="${target}"]`)).toBeVisible()
    for (const viewport of viewportSizes) {
      await page.setViewportSize(viewport)
      await expectTooltipInsideViewport(page)
    }
    await page.setViewportSize(viewportSizes[1])
    if (index < expectedTargets.length - 1) {
      await page.locator('[data-tour-tooltip] [data-action="primary"]').click()
    }
  }

  await page.locator('[data-tour-tooltip] [data-action="primary"]').click()
  expect(onboardingRequests).toEqual([])
})
