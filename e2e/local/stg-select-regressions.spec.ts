import { expect, test, type APIResponse } from "@playwright/test"
import { completeSetup, findPendingMaintenanceFixture } from "../support/maintenance-invitation"
import { fixtures } from "../support/polish-fixtures"
import { selectClassroomArea, selectPopupOption, withSelectOptions } from "../support/select"
import { clickAndWaitForApi, expectApiStatus, readInvitationSetupLink, selectMaintenanceLocation, validatedInvitationSetupUrl } from "../support/portal"

test("reads the setup link from the ready dialog while it is open", async ({ page }) => {
  await page.setContent(`
    <section role="dialog" aria-label="Invitation ready">
      <a href="/setup-account?token=synthetic">Open setup page</a>
      <button onclick="this.parentElement.remove()">Done</button>
    </section>
  `)
  const ready = page.getByRole("dialog", { name: "Invitation ready", exact: true })
  const origin = "https://portal-stg.example.test"
  const setup = validatedInvitationSetupUrl(await readInvitationSetupLink(ready), origin)
  await ready.getByRole("button", { name: "Done", exact: true }).click()
  await expect(ready).toHaveCount(0)
  expect(setup.origin).toBe(origin)
  expect(setup.pathname).toBe("/setup-account")
  for (const href of ["https://other.example.test/setup-account?token=synthetic", "/login?token=synthetic", "/setup-account"]) {
    expect(() => validatedInvitationSetupUrl(href, origin)).toThrow("does not match the approved staging route")
  }
})

for (const status of [204, 200, 400]) {
  test(`account setup with HTTP ${status} only opens sign-in after verified activation`, async ({ page }) => {
    const origin = "https://portal-stg.example.test"
    const token = "synthetic-invite"
    const password = "synthetic-password"
    await page.route(`${origin}/setup-account?*`, (route) => route.fulfill({
      contentType: "text/html",
      body: `
        <h2>Set up your account</h2>
        <label for="password">Password</label><input id="password" type="password">
        <label for="confirm">Confirm password</label><input id="confirm" type="password">
        <button id="activate">Activate account</button>
        <script>
          document.querySelector('#activate').onclick = () =>
            fetch('/api/auth/setup-account', { method: 'POST' });
        </script>`,
    }))
    await page.route(`${origin}/api/auth/setup-account`, (route) => route.fulfill({ status }))
    await page.route(`${origin}/login`, (route) => route.fulfill({ body: "Sign in" }))

    const activation = completeSetup(page, `/setup-account?token=${token}`, password, origin)
    if (status === 204) {
      await activation
      expect(page.url()).toBe(`${origin}/login`)
    } else if (status === 200) {
      await expect(activation).rejects.toThrow(/^Account setup: activation returned HTTP 200 instead of HTTP 204$/)
      expect(new URL(page.url()).pathname).toBe("/setup-account")
    } else {
      await expect(activation).rejects.toThrow(/^Account setup: the activation POST did not succeed \(HTTP 400\)$/)
      expect(new URL(page.url()).pathname).toBe("/setup-account")
    }
  })
}

test("lost invitation responses recover only one exact pending fixture across pages", async () => {
  const fixture = { email: "synthetic@example.test", name: "E2E Maintenance synthetic", locationId: "assigned" }
  const exact = {
    id: "exact-id", email: fixture.email, displayName: fixture.name, role: "MAINTENANCE",
    status: "INVITED", locations: [{ id: fixture.locationId }],
  }
  const nearMatches = [
    { ...exact, email: "other@example.test" }, { ...exact, displayName: "Other name" },
    { ...exact, role: "DIRECTOR" }, { ...exact, status: "ACTIVE" },
    { ...exact, locations: [{ id: "other-location" }] },
  ]
  const list = (rows: (typeof exact)[][]) => async (path: string) => {
    const page = Number(new URL(path, "https://backend-stg.example.test").searchParams.get("page"))
    expect(path).toBe(`/api/admin/users?status=INVITED&size=50&page=${page}`)
    return { ok: () => true, json: async () => ({ number: page, totalPages: rows.length, content: rows[page] }) } as APIResponse
  }
  await expect(findPendingMaintenanceFixture(list([nearMatches, [exact]]), fixture)).resolves.toBe("exact-id")
  await expect(findPendingMaintenanceFixture(list([nearMatches]), fixture)).resolves.toBeUndefined()
  await expect(findPendingMaintenanceFixture(list([[exact], [{ ...exact, id: "other-id" }]]), fixture))
    .rejects.toThrow("More than one account matched")
})

test("Maintenance verifies the exact preselected location on a disabled control", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: "Location", exact: true })
  await page.setContent('<button role="combobox" aria-label="Location" disabled>Winter Park<span aria-hidden="true">▼</span></button>')
  await selectMaintenanceLocation(trigger, "Winter Park")
  await page.setContent('<button role="combobox" aria-label="Location" disabled><span data-slot="select-value">Winter Park Annex</span></button>')
  await expect(selectMaintenanceLocation(trigger, "Winter Park")).rejects.toThrow("Selected Maintenance location")
})

test("API diagnostics include only the operation, status, code, and safe field names", async () => {
  const response = {
    status: () => 400,
    ok: () => false,
    json: async () => ({
      code: "VALIDATION_ERROR",
      message: "Do not log this body",
      violations: [{ field: "priority", message: "Do not log this value" }, { field: "unsafe@example.test" }],
      token: "synthetic-token",
    }),
  }
  await expect(expectApiStatus(response, "Create fixture", 201)).rejects.toThrow(
    /^Create fixture returned HTTP 400 \(VALIDATION_ERROR, fields: priority\)\. Expected HTTP 201\.$/,
  )
})

test("an anchored role pattern verifies both labels with a decorative trigger arrow", async ({ page }) => {
  for (const label of ["Maintenance Only", "Maintenance"]) {
    for (const valueSlot of [true, false]) {
      await page.setContent(`
        <button role="combobox" aria-label="Role" aria-expanded="false">
          <span id="value"${valueSlot ? ' data-slot="select-value"' : ""}>Director</span><span aria-hidden="true">▼</span>
        </button>
        <div role="listbox" hidden>
          <div role="option">${label}</div>
          <div role="option">Maintenance Coordinator</div>
        </div>
      `)
      await page.evaluate(() => {
        const trigger = document.querySelector<HTMLButtonElement>('[role="combobox"]')!
        const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!
        trigger.addEventListener("click", () => {
          trigger.setAttribute("aria-expanded", "true")
          listbox.hidden = false
        })
        listbox.addEventListener("click", (event) => {
          const option = (event.target as HTMLElement).closest('[role="option"]')
          if (!option) return
          document.querySelector("#value")!.textContent = option.textContent
          trigger.setAttribute("aria-expanded", "false")
          listbox.hidden = true
        })
      })

      const trigger = page.getByRole("combobox", { name: "Role" })
      await selectPopupOption(trigger, /^Maintenance(?: Only)?$/)
      await expect(trigger.locator("#value")).toHaveText(label)
      await expect(trigger).toHaveText(label + "▼")
    }
  }
})

test("option inspection checks the open popup and closes it even after a failed assertion", async ({ page }) => {
  await fixtures(page); await page.goto("/maintenance")
  const trigger = page.getByLabel("Filter by location", { exact: true })
  await withSelectOptions(trigger, async (popup) => {
    await expect(popup.getByRole("option", { name: "Location one", exact: true })).toBeVisible()
    await expect(popup.getByRole("option", { name: "Unassigned location", exact: true })).toHaveCount(0)
  })
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(trigger).toBeFocused()
  await expect(withSelectOptions(trigger, async () => { throw new Error("Inspection failed") })).rejects.toThrow("Inspection failed")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("listbox")).toHaveCount(0)
})

for (const role of ["OWNER", "DIRECTOR"] as const) test(`Maintenance preserves ${role} selections after an unrelated store refresh`, async ({ page }) => {
  const state = await fixtures(page, { role })
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route("**/api/dashboard/summary", async (route) => {
    await pending
    await route.fulfill({ json: {
      month: "2026-11", generatedAt: "2026-11-12", needsReview: { total: 0, records: 0, maintenance: 0, supply: 0 },
      records: { active: 0, newCount: 0, needsAttention: 0, reviewed: 0, compliance: 0, operations: 0 },
      maintenance: { open: 7, awaitingApproval: 0, inProgress: 0, completedThisMonth: 0, costThisMonth: 0 },
      supply: { open: 0, awaitingApproval: 0, orderedOrInTransit: 0, receivedThisMonth: 0, spendThisMonth: 0 }, operationalRequests: [],
    } })
  })
  try {
    await page.goto("/maintenance")
    await page.getByRole("button", { name: "New Maintenance Request", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "New Maintenance Request" })
    const location = dialog.getByLabel("Location", { exact: true }), area = dialog.getByLabel("Classroom / Area", { exact: true })
    if (role === "OWNER") await selectPopupOption(location, "Location two")
    await selectClassroomArea(area, "Kitchen")
    await selectPopupOption(dialog.getByLabel("Maintenance Category", { exact: true }), "Building / Facility")
    await dialog.getByLabel("Issue / Request Title").fill("Background refresh regression")
    await dialog.getByLabel("Description", { exact: true }).fill("Keep the user's selected classroom or facility area")
    release()
    // The rendered summary proves the delayed response has updated the shared app store.
    await expect(page.getByText("7", { exact: true })).toBeVisible()
    await expect(area).toContainText("Kitchen")
    await expect(location).toContainText(role === "OWNER" ? "Location two" : "Location one")
    await expect(dialog.getByLabel("Maintenance Category", { exact: true })).toContainText("Building / Facility")
    await expect(dialog.getByRole("button", { name: "Submit Request", exact: true })).toBeEnabled()
    await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Submit Request", exact: true }), {
      label: "Create maintenance after background refresh", method: "POST", path: "/api/maintenance",
    })
    await expect.poll(() => state.payloads.length).toBe(1)
    expect(state.payloads[0]).toMatchObject({ area: "Kitchen", category: "BUILDING_FACILITY", locationId: role === "OWNER" ? "two" : "one" })
  } finally {
    release()
  }
})
