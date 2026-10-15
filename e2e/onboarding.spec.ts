import { expect, test } from "@playwright/test"
import { ownerCredentials, stagingBackendUrl } from "./support/env"
import { clickAndWaitForApi, login } from "./support/portal"

type OnboardingStatus = "NOT_STARTED" | "DISMISSED" | "COMPLETED"

const viewportSizes = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
]

async function expectTooltipInsideViewport(page: import("@playwright/test").Page) {
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

test("Owner receives v1 once, can complete it, and can manually replay it", async ({ page, request }) => {
  const credentials = ownerCredentials()
  const authResponse = await request.post(`${stagingBackendUrl()}/api/auth/login`, {
    data: credentials,
  })
  expect(authResponse.ok()).toBe(true)
  const session = await authResponse.json() as {
    accessToken: string
    user: { onboarding: { status: OnboardingStatus } }
  }
  const originalStatus = session.user.onboarding.status
  const updateState = async (status: OnboardingStatus) => {
    const response = await request.patch(`${stagingBackendUrl()}/api/users/me/onboarding`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { tourAudience: "OWNER", version: 1, status },
    })
    expect(response.ok()).toBe(true)
  }

  try {
    await updateState("NOT_STARTED")
    await login(page, credentials)

    const welcome = page.getByRole("dialog", { name: "Welcome to Influential Management" })
    await expect(welcome).toBeVisible()
    await welcome.getByRole("button", { name: "Start walkthrough" }).click()

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

    await clickAndWaitForApi(
      page,
      page.locator('[data-tour-tooltip] [data-action="primary"]'),
      { label: "Complete onboarding", method: "PATCH", path: "/api/users/me/onboarding" }
    )
    await page.reload()
    await expect(welcome).toHaveCount(0)

    await page.getByRole("button", { name: "Help & support", exact: true }).click()
    const support = page.getByRole("dialog", { name: "Help & support" })
    await support.getByRole("button", { name: "Restart", exact: true }).click()
    await expect(page.locator('[data-tour-tooltip] [data-action="skip"]')).toBeVisible()
    await clickAndWaitForApi(
      page,
      page.locator('[data-tour-tooltip] [data-action="skip"]'),
      { label: "Dismiss replayed onboarding", method: "PATCH", path: "/api/users/me/onboarding" }
    )
  } finally {
    await updateState(originalStatus)
  }
})
