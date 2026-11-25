import { expect, type APIResponse, type Page } from "@playwright/test"
import type { AdminUserPage } from "../../lib/user-admin-api"
import { clickAndWaitForApi, validatedInvitationSetupUrl } from "./portal"

async function setupStep<T>(step: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    // Playwright errors can include the setup URL or form values. Keep only known-safe diagnostics.
    const status = error instanceof Error && /^Activate worker: POST \/api\/auth\/setup-account returned HTTP (\d{3})/.exec(error.message)
    throw new Error(`Account setup: ${step}${status ? ` (HTTP ${status[1]})` : ""}`)
  }
}

export async function completeSetup(page: Page, rawUrl: string, password: string, frontendOrigin: string) {
  const url = validatedInvitationSetupUrl(rawUrl, frontendOrigin)
  await setupStep("could not open the approved setup page", async () => {
    const response = await page.goto(url.href)
    const loaded = new URL(page.url())
    if (!response?.ok() || loaded.origin !== url.origin || loaded.pathname !== url.pathname) throw new Error()
  })
  await setupStep("the setup token did not unlock the password form", () =>
    expect(page.getByRole("heading", { name: "Set up your account", exact: true })).toBeVisible(),
  )
  await setupStep("could not fill the password fields", async () => {
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Confirm password", { exact: true }).fill(password)
  })
  const activation = await setupStep("the activation POST did not succeed", () =>
    clickAndWaitForApi(page, page.getByRole("button", { name: "Activate account", exact: true }), {
      label: "Activate worker", method: "POST", path: "/api/auth/setup-account",
    }),
  )
  if (activation.status() !== 204) {
    throw new Error(`Account setup: activation returned HTTP ${activation.status()} instead of HTTP 204`)
  }
  await setupStep("could not open the approved staging sign-in page after activation", async () => {
    const loginUrl = new URL("/login", frontendOrigin).href
    const response = await page.goto(loginUrl)
    if (!response?.ok() || page.url() !== loginUrl) throw new Error()
  })
}

export async function findPendingMaintenanceFixture(
  list: (path: string) => Promise<APIResponse>,
  fixture: { email: string; name: string; locationId: string },
): Promise<string | undefined> {
  let match: string | undefined
  for (let page = 0, totalPages = 1; page < totalPages; page++) {
    const response = await list(`/api/admin/users?status=INVITED&size=50&page=${page}`)
    if (!response.ok()) throw new Error(`Fixture lookup returned HTTP ${response.status()}`)
    const result = await response.json() as AdminUserPage
    if (result.number !== page || !Number.isSafeInteger(result.totalPages) || result.totalPages < 0) {
      throw new Error("Fixture lookup returned invalid pagination")
    }
    totalPages = result.totalPages
    for (const user of result.content) {
      if (user.email !== fixture.email.toLowerCase() || user.displayName !== fixture.name ||
        user.role !== "MAINTENANCE" || user.status !== "INVITED" ||
        user.locations.length !== 1 || user.locations[0].id !== fixture.locationId) continue
      if (match) throw new Error("More than one account matched the pending fixture")
      match = user.id
    }
  }
  return match
}
