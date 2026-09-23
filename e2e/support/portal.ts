import { expect, type Locator, type Page, type Request, type Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { TestCredentials } from "./env"

export const uploadFixturePath = "e2e/fixtures/staging-upload.pdf"
export const uploadFixtureName = "staging-upload.pdf"

const AUTH_TRANSITION_TIMEOUT_MS = 30_000
const STG_MUTATION_TIMEOUT_MS = 30_000
const STG_MUTATION_UI_TIMEOUT_MS = 20_000
const STG_UPLOAD_TIMEOUT_MS = 45_000

interface ApiWaitOptions {
  label: string
  method: string
  path: string
  timeout?: number
}

function matchesApiRequest(request: Request, options: ApiWaitOptions): boolean {
  return request.method() === options.method && new URL(request.url()).pathname === options.path
}

async function waitForSuccessfulApiResponse(
  page: Page,
  options: ApiWaitOptions
): Promise<Response> {
  const timeout = options.timeout ?? STG_MUTATION_TIMEOUT_MS
  const startedAt = Date.now()
  let requestStarted = false
  let requestFailure: string | undefined
  const onRequest = (request: Request) => {
    if (matchesApiRequest(request, options)) requestStarted = true
  }
  const onRequestFailed = (request: Request) => {
    if (matchesApiRequest(request, options)) {
      requestFailure = request.failure()?.errorText ?? "unknown network failure"
    }
  }

  page.on("request", onRequest)
  page.on("requestfailed", onRequestFailed)
  try {
    const response = await page.waitForResponse(
      (candidate) => matchesApiRequest(candidate.request(), options),
      { timeout }
    ).catch((cause: unknown) => {
      const detail = requestFailure
        ? `request failed before a response (${requestFailure})`
        : requestStarted
          ? `request was still pending after ${timeout / 1000}s`
          : `request never fired within ${timeout / 1000}s`
      throw new Error(
        `${options.label}: ${options.method} ${options.path} ${detail}.`,
        { cause }
      )
    })

    if (!response.ok()) {
      throw new Error(
        `${options.label}: ${options.method} ${options.path} returned `
          + `HTTP ${response.status()} ${response.statusText()}.`
      )
    }

    if ([204, 205, 304].includes(response.status())) return response

    const completionTimeout = Math.max(1, timeout - (Date.now() - startedAt))
    let completionTimer: ReturnType<typeof setTimeout> | undefined
    const completion = await Promise.race([
      response.finished().then((error) => ({ kind: "finished" as const, error })),
      new Promise<{ kind: "timeout" }>((resolve) => {
        completionTimer = setTimeout(() => resolve({ kind: "timeout" }), completionTimeout)
      }),
    ])
    if (completionTimer) clearTimeout(completionTimer)

    if (completion.kind === "timeout") {
      throw new Error(
        `${options.label}: ${options.method} ${options.path} returned HTTP ${response.status()}, `
          + `but its response body was still pending after ${timeout / 1000}s.`
      )
    }
    if (completion.error) {
      throw new Error(
        `${options.label}: ${options.method} ${options.path} returned HTTP ${response.status()}, `
          + `but response completion failed (${completion.error.message}).`
      )
    }
    return response
  } finally {
    page.off("request", onRequest)
    page.off("requestfailed", onRequestFailed)
  }
}

export async function clickAndWaitForApi(
  page: Page,
  control: Locator,
  options: ApiWaitOptions
): Promise<Response> {
  await dismissVisibleNotification(page)

  await control.click({ trial: true, timeout: STG_MUTATION_TIMEOUT_MS }).catch((cause: unknown) => {
    throw new Error(
      `${options.label}: the action did not become enabled, visible, and unobstructed within `
        + `${STG_MUTATION_TIMEOUT_MS / 1000}s, so ${options.method} ${options.path} was not sent.`,
      { cause }
    )
  })
  const responsePromise = waitForSuccessfulApiResponse(page, options)
  void responsePromise.catch(() => undefined)
  try {
    await control.click({ timeout: STG_MUTATION_TIMEOUT_MS })
  } catch (cause) {
    void responsePromise.catch(() => undefined)
    throw new Error(
      `${options.label}: the action did not remain enabled and stable within `
        + `${STG_MUTATION_TIMEOUT_MS / 1000}s, so ${options.method} ${options.path} was not sent.`,
      { cause }
    )
  }
  return responsePromise
}

async function dismissVisibleNotification(page: Page): Promise<void> {
  const dismissNotification = page.getByRole("button", { name: "Dismiss notification" }).last()
  if (await dismissNotification.isVisible()) {
    await dismissNotification.click({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  }
}

export async function ensureNextActionReady(
  page: Page,
  control: Locator,
  persistedState: Locator,
  description: string
): Promise<void> {
  await dismissVisibleNotification(page)
  try {
    await control.click({ trial: true, timeout: 5_000 })
    return
  } catch {
    console.warn(
      `[e2e] ${description}: the next action did not become ready within 5s; `
        + "reloading once to reconcile persisted state."
    )
  }

  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(persistedState).toBeVisible({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  await control.click({ trial: true, timeout: STG_MUTATION_UI_TIMEOUT_MS })
}

export function workflowProgress(
  page: Page,
  workflow: "Maintenance" | "Supply",
  status: string
): Locator {
  return page.getByRole("list", { name: `${workflow} progress: ${status}`, exact: true })
}

export async function expectUiAfterMutation(
  locator: Locator,
  description: string,
  timeout = STG_MUTATION_UI_TIMEOUT_MS,
  reloadOnMismatch = true
): Promise<void> {
  const initialTimeout = reloadOnMismatch ? Math.min(10_000, timeout) : timeout
  try {
    await expect(locator).toBeVisible({ timeout: initialTimeout })
    return
  } catch (initialCause) {
    if (!reloadOnMismatch) {
      throw new Error(
        `${description}: the API returned success, but the expected UI state did not appear within `
          + `${timeout / 1000}s.`,
        { cause: initialCause }
      )
    }
  }

  console.warn(
    `[e2e] ${description}: the API succeeded but live UI state did not reconcile within `
      + `${initialTimeout / 1000}s; reloading once to verify persisted state.`
  )
  await locator.page().reload({ waitUntil: "domcontentloaded" })
  await expect(locator).toBeVisible({ timeout }).catch((cause: unknown) => {
    throw new Error(
      `${description}: the API returned success, but the expected persisted UI state did not appear `
        + `within ${timeout / 1000}s after one reload.`,
      { cause }
    )
  })
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${randomUUID().slice(0, 8)}`
}

export async function login(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email").fill(credentials.email)
  await page.getByLabel("Password", { exact: true }).fill(credentials.password)
  try {
    await clickAndWaitForApi(
      page,
      page.getByRole("button", { name: "Sign in", exact: true }),
      {
        label: "Login",
        method: "POST",
        path: "/api/auth/login",
        timeout: AUTH_TRANSITION_TIMEOUT_MS,
      }
    )
  } catch (cause) {
    const visibleError = await page.getByRole("alert").textContent({ timeout: 2_000 }).catch(() => null)
    const requestDiagnostic = cause instanceof Error ? cause.message : "unknown login failure"
    throw new Error(
      visibleError?.trim()
        ? `Login failed: ${visibleError.trim()} (${requestDiagnostic})`
        : `Login failed before authentication completed. ${requestDiagnostic}`,
      { cause }
    )
  }

  await Promise.all([
    expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: AUTH_TRANSITION_TIMEOUT_MS }),
    expect(page.getByRole("heading", { name: "Dashboard", exact: true }).first())
      .toBeVisible({ timeout: AUTH_TRANSITION_TIMEOUT_MS }),
  ]).catch((cause: unknown) => {
    throw new Error(
      "Login API returned success, but the dashboard URL and heading did not become ready within 30s.",
      { cause }
    )
  })
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open account menu" }).click()
  await clickAndWaitForApi(page, page.getByRole("menuitem", { name: "Sign out" }), {
    label: "Logout",
    method: "POST",
    path: "/api/auth/logout",
    timeout: AUTH_TRANSITION_TIMEOUT_MS,
  })
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: AUTH_TRANSITION_TIMEOUT_MS })
}

async function openCreatedItem(
  page: Page,
  path: string,
  searchLabel: string,
  title: string
): Promise<string> {
  await page.goto(path)
  await page.getByRole("textbox", { name: searchLabel, exact: true }).fill(title)
  const link = page
    .getByRole("link", { name: title, exact: true })
    .or(page.getByRole("link", { name: `Open ${title}`, exact: true }))
    .first()
  await expect(link).toBeVisible({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
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
  await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Submit Request" }), {
    label: "Create maintenance request",
    method: "POST",
    path: "/api/maintenance",
  })
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
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
  await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Submit Request" }), {
    label: "Create supply request",
    method: "POST",
    path: "/api/supply-requests",
  })
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  return openCreatedItem(page, "/supply-requests", "Search supply requests", title)
}

async function selectPopupOption(combobox: Locator, option: string): Promise<void> {
  await combobox.click()
  await combobox.page().getByRole("option", { name: option, exact: true }).click()
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
  const comboboxes = dialog.locator('[data-slot="select-trigger"]')

  await selectPopupOption(comboboxes.nth(0), "Compliance")
  await selectPopupOption(comboboxes.nth(1), locationName)
  await selectPopupOption(comboboxes.nth(2), "Staff Complaints")
  await selectPopupOption(comboboxes.nth(3), "Workplace Conduct")
  await dialog.getByRole("checkbox", { name: "Use custom title" }).check()
  await dialog.getByPlaceholder("Enter a descriptive record title").fill(title)
  await dialog.getByPlaceholder("Add context, notes, or details about this record...").fill(
    `Disposable STG E2E compliance record for ${title}`
  )
  await dialog.locator('input[type="file"]').setInputFiles(uploadFixturePath)
  const responsePromises = [
    waitForSuccessfulApiResponse(page, {
      label: "Compliance file upload",
      method: "POST",
      path: "/api/files",
      timeout: STG_UPLOAD_TIMEOUT_MS,
    }),
    waitForSuccessfulApiResponse(page, {
      label: "Create compliance record",
      method: "POST",
      path: "/api/records",
      timeout: STG_UPLOAD_TIMEOUT_MS,
    }),
  ]
  try {
    await dialog.getByRole("button", { name: "Upload Record" }).click()
  } catch (error) {
    for (const responsePromise of responsePromises) void responsePromise.catch(() => undefined)
    throw error
  }
  await Promise.all(responsePromises)
  await expectUiAfterMutation(
    page.getByRole("heading", { name: "Record uploaded successfully", exact: true }),
    "Create compliance record",
    STG_UPLOAD_TIMEOUT_MS,
    false
  )
  await page.getByRole("button", { name: "Done", exact: true }).click()

  return openCreatedItem(page, "/records", "Search records...", title)
}

export async function archiveMaintenanceIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive request", exact: true })
  const restore = page.getByRole("button", { name: "Restore request", exact: true })
  await expect(archive.or(restore)).toBeVisible({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  if (await restore.isVisible()) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this maintenance request?" })
  const id = path.split("/").at(-1)
  if (!id) throw new Error(`Cannot archive maintenance request without an ID: ${path}`)
  await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Archive Request" }), {
    label: "Archive maintenance request",
    method: "POST",
    path: `/api/maintenance/${id}/archive`,
  })
  await expect(page).toHaveURL(/\/maintenance\/?(?:[?#].*)?$/, { timeout: STG_MUTATION_UI_TIMEOUT_MS })
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
}

export async function archiveSupplyIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive request", exact: true })
  const restore = page.getByRole("button", { name: "Restore request", exact: true })
  await expect(archive.or(restore)).toBeVisible({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  if (await restore.isVisible()) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this supply request?" })
  const id = path.split("/").at(-1)
  if (!id) throw new Error(`Cannot archive supply request without an ID: ${path}`)
  await clickAndWaitForApi(page, dialog.getByRole("button", { name: "Archive Request" }), {
    label: "Archive supply request",
    method: "POST",
    path: `/api/supply-requests/${id}/archive`,
  })
  await expect(page).toHaveURL(/\/supply-requests\/?(?:[?#].*)?$/, { timeout: STG_MUTATION_UI_TIMEOUT_MS })
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
}

export async function archiveRecordIfActive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  const archive = page.getByRole("button", { name: "Archive Record", exact: true }).first()
  const restore = page.getByRole("button", { name: "Restore Record", exact: true }).first()
  await expect(archive.or(restore)).toBeVisible({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  if (await restore.isVisible()) return
  await archive.click()
  const dialog = page.getByRole("dialog", { name: "Archive this record?" })
  const id = path.split("/").at(-1)
  if (!id) throw new Error(`Cannot archive compliance record without an ID: ${path}`)
  await clickAndWaitForApi(
    page,
    dialog.getByRole("button", { name: "Archive Record", exact: true }),
    {
      label: "Archive compliance record",
      method: "POST",
      path: `/api/records/${id}/archive`,
    }
  )
  await expect(page).toHaveURL(/\/records\/?(?:[?#].*)?$/, { timeout: STG_MUTATION_UI_TIMEOUT_MS })
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
}
