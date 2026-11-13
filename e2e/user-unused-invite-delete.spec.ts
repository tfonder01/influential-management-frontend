import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { ownerCredentials } from "./support/env"
import { login } from "./support/portal"
import { selectPopupOption } from "./support/select"

// Enable only after the feature is deployed and disposable-account STG validation is approved.
// Every DELETE below is constrained to a UUID returned by this test's own invite request.
test("STG disposable invite can be disabled, deleted, and invited again", async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_ALLOW_UNUSED_INVITE_DELETE !== "true", "Requires separately approved deployed STG validation")
  await login(page, ownerCredentials())
  await page.goto("/admin/users")
  const email = `unused-invite-e2e-${randomUUID()}@example.test`
  const created = new Set<string>()
  await page.route("**/api/admin/users/*", async (route) => {
    if (route.request().method() === "DELETE") {
      const id = new URL(route.request().url()).pathname.split("/").at(-1)!
      if (!created.has(id)) { await route.abort(); throw new Error("Refused to delete a user not created by this test") }
    }
    await route.continue()
  })

  async function invite() {
    await page.getByRole("button", { name: "Invite user", exact: true }).click()
    const form = page.getByRole("dialog", { name: "Invite user", exact: true })
    await form.getByLabel("Full name").fill("Disposable Invitation Test")
    await form.getByLabel("Email", { exact: true }).fill(email)
    await selectPopupOption(form.getByRole("combobox"), "Owner")
    const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/users/invite" && response.request().method() === "POST")
    await form.getByRole("button", { name: "Send invitation" }).click()
    const result = await response
    expect(result.ok()).toBe(true)
    const body = await result.json() as { user: { id: string; email: string; canDeletePermanently: boolean } }
    expect(body.user.email).toBe(email)
    expect(body.user.canDeletePermanently).toBe(true)
    expect(created.has(body.user.id)).toBe(false)
    created.add(body.user.id)
    await page.getByRole("dialog", { name: "Invitation ready" }).getByRole("button", { name: "Done", exact: true }).click()
    return body.user.id
  }

  async function findDisposable(page: Page, status: "Invited" | "Disabled") {
    await selectPopupOption(page.getByLabel("Status", { exact: true }), status)
    const card = page.locator("article").filter({ has: page.getByText(email, { exact: true }) })
    for (let index = 0; index < 100; index++) {
      await expect(page.getByText("Loading users…", { exact: true })).toBeHidden()
      if (await card.count()) return card
      const next = page.getByRole("button", { name: "Next", exact: true })
      if (!await next.isVisible() || !await next.isEnabled()) break
      const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/users" && response.request().method() === "GET")
      await next.click(); await response
    }
    throw new Error("This test's newly created disposable invitation was not found")
  }

  async function deleteDisposable(id: string, status: "Invited" | "Disabled") {
    expect(created.has(id)).toBe(true)
    const card = await findDisposable(page, status)
    await card.getByRole("button", { name: "Delete permanently", exact: true }).click()
    const confirm = page.getByRole("dialog", { name: "Delete this unused invitation permanently?" })
    await expect(confirm).toContainText(email)
    const deleted = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/admin/users/${id}` && response.request().method() === "DELETE")
    await confirm.getByRole("button", { name: "Delete permanently", exact: true }).click()
    expect((await deleted).status()).toBe(204)
    await expect(confirm).toBeHidden()
    await expect(card).toHaveCount(0)
    await expect(page.getByLabel("Status", { exact: true })).toContainText(status)
  }

  const original = await invite()
  const card = await findDisposable(page, "Invited")
  await card.getByRole("button", { name: "Disable", exact: true }).click()
  await page.getByRole("dialog", { name: "Disable this user?" }).getByRole("button", { name: "Disable user", exact: true }).click()
  await deleteDisposable(original, "Disabled")
  const replacement = await invite()
  expect(replacement).not.toBe(original)
  await deleteDisposable(replacement, "Invited")
})
