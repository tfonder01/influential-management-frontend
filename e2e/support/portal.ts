import { selectPopupOption, selectClassroomArea } from "./select"
import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
  type Response,
} from "@playwright/test"
import { randomUUID } from "node:crypto"
import { stagingBackendUrl, stagingBaseUrl, type TestCredentials } from "./env"
import { guardedApiOrigin, guardStagingContext } from "./staging-guard"

export const uploadFixturePath = "e2e/fixtures/staging-upload.pdf"
export const uploadFixtureName = "staging-upload.pdf"

const AUTH_TRANSITION_TIMEOUT_MS = 30_000
const STG_MUTATION_TIMEOUT_MS = 30_000
const STG_MUTATION_UI_TIMEOUT_MS = 20_000
const STG_UPLOAD_TIMEOUT_MS = 45_000

export type OnboardingStatus = "NOT_STARTED" | "DISMISSED" | "COMPLETED"
export type LoginDestination = "dashboard" | "onboarding-welcome" | "maintenance"

export interface ApiWaitOptions {
  label: string
  method: string
  path: string
  timeout?: number
}

function matchesApiRequest(request: Request, options: ApiWaitOptions, origin?: string): boolean {
  const url = new URL(request.url())
  return (!origin || url.origin === origin) && request.method() === options.method && url.pathname === options.path
}

export async function expectApiStatus(
  response: Pick<Response, "ok" | "status" | "json">,
  operation: string,
  expected: number | "success",
): Promise<void> {
  const status = response.status()
  if (expected === "success" ? response.ok() : status === expected) return

  const body = await response.json().catch(() => null) as { code?: unknown; violations?: unknown } | null
  const code = typeof body?.code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(body.code) ? body.code : undefined
  const fields = Array.isArray(body?.violations)
    ? [...new Set(body.violations.flatMap((violation) => {
      const field = violation?.field
      return typeof field === "string" && /^[a-z][a-zA-Z0-9]{0,63}$/.test(field) ? [field] : []
    }))].slice(0, 10)
    : []
  const details = [code, fields.length ? `fields: ${fields.join(", ")}` : undefined].filter(Boolean)
  throw new Error(`${operation} returned HTTP ${status}${details.length ? ` (${details.join(", ")})` : ""}. Expected ${expected === "success" ? "a successful response" : `HTTP ${expected}`}.`)
}

export async function waitForSuccessfulApiResponse(
  page: Page,
  options: ApiWaitOptions
): Promise<Response> {
  const origin = guardedApiOrigin(page.context())
  const timeout = options.timeout ?? STG_MUTATION_TIMEOUT_MS
  const startedAt = Date.now()
  let requestStarted = false
  let requestFailure: string | undefined
  const onRequest = (request: Request) => {
    if (matchesApiRequest(request, options, origin)) requestStarted = true
  }
  const onRequestFailed = (request: Request) => {
    if (matchesApiRequest(request, options, origin)) {
      requestFailure = request.failure()?.errorText ?? "unknown network failure"
    }
  }

  page.on("request", onRequest)
  page.on("requestfailed", onRequestFailed)
  try {
    const response = await page.waitForResponse(
      (candidate) => matchesApiRequest(candidate.request(), options, origin),
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

    await expectApiStatus(response, `${options.label}: ${options.method} ${options.path}`, "success")

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

export async function setOnboardingState(
  apiRequest: APIRequestContext,
  credentials: TestCredentials,
  status: OnboardingStatus
): Promise<OnboardingStatus> {
  const authResponse = await apiRequest.post(`${stagingBackendUrl()}/api/auth/login`, {
    data: credentials,
    maxRedirects: 0,
  })
  if (!authResponse.ok()) {
    throw new Error(`Prepare onboarding state: login returned HTTP ${authResponse.status()}.`)
  }

  const session = await authResponse.json() as {
    accessToken: string
    user: {
      role: "OWNER" | "DIRECTOR" | "ASSISTANT_DIRECTOR"
      onboarding: { status: OnboardingStatus }
    }
  }
  const response = await apiRequest.patch(`${stagingBackendUrl()}/api/users/me/onboarding`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    maxRedirects: 0,
    data: {
      tourAudience: session.user.role === "OWNER" ? "OWNER" : "LOCATION_STAFF",
      version: 1,
      status,
    },
  })
  if (!response.ok()) {
    throw new Error(`Prepare onboarding state: update returned HTTP ${response.status()}.`)
  }
  return session.user.onboarding.status
}

export async function login(
  page: Page,
  credentials: TestCredentials,
  destination: LoginDestination = "dashboard"
): Promise<{ accessToken: string; user: { role: string } }> {
  await guardStagingContext(page.context())
  await page.goto("/login")
  if (new URL(page.url()).origin !== stagingBaseUrl()) throw new Error("Sign-in page escaped the approved staging origin")
  await page.getByLabel("Email").fill(credentials.email)
  await page.getByLabel("Password", { exact: true }).fill(credentials.password)
  let session: { accessToken: string; user: { role: string } }
  try {
    const response = await clickAndWaitForApi(
      page,
      page.getByRole("button", { name: "Sign in", exact: true }),
      {
        label: "Login",
        method: "POST",
        path: "/api/auth/login",
        timeout: AUTH_TRANSITION_TIMEOUT_MS,
      }
    )
    session = await response.json()
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

  const welcome = page.getByRole("dialog", { name: "Welcome to Influential Management" })
  const destinationReady = destination === "onboarding-welcome"
    ? expect(welcome).toBeVisible({ timeout: AUTH_TRANSITION_TIMEOUT_MS })
    : Promise.all([
        expect(page.getByRole("heading", { name: destination === "maintenance" ? "Maintenance" : "Dashboard", exact: true }).first())
          .toBeVisible({ timeout: AUTH_TRANSITION_TIMEOUT_MS }),
        expect(welcome).toBeHidden({ timeout: AUTH_TRANSITION_TIMEOUT_MS }),
      ])

  await Promise.all([
    expect(page).toHaveURL(destination === "maintenance" ? /\/maintenance\/?$/ : /\/dashboard(?:[/?#]|$)/, { timeout: AUTH_TRANSITION_TIMEOUT_MS }),
    destinationReady,
  ]).catch(async (cause: unknown) => {
    const state = {
      url: page.url(),
      welcomeVisible: await welcome.isVisible().catch(() => false),
      dashboardHeadingVisible: await page
        .getByRole("heading", { name: destination === "maintenance" ? "Maintenance" : "Dashboard", exact: true })
        .first()
        .isVisible()
        .catch(() => false),
    }
    throw new Error(
      `Login API returned success, but the expected ${destination} state did not become ready. `
        + `Browser state: ${JSON.stringify(state)}.`,
      { cause }
    )
  })
  return session
}

export async function readInvitationSetupLink(dialog: Locator): Promise<string> {
  try {
    const href = await dialog.getByRole("link", { name: "Open setup page", exact: true }).getAttribute("href")
    if (href?.trim()) return href
  } catch {
    // Locator errors can include a URL. Keep invitation diagnostics free of tokens.
  }
  throw new Error("Invitation ready did not show an account setup link")
}

export function validatedInvitationSetupUrl(href: string, frontendOrigin: string): URL {
  try {
    const url = new URL(href, frontendOrigin)
    if (url.origin === frontendOrigin && url.pathname === "/setup-account"
      && !url.username && !url.password && url.searchParams.get("token")) return url
  } catch {
    // URL parsing errors can contain the original input.
  }
  throw new Error("The invitation setup link does not match the approved staging route")
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

export async function selectMaintenanceLocation(trigger: Locator, locationName: string) {
  await expect(trigger).toBeVisible()
  if (await trigger.isEnabled()) await selectPopupOption(trigger, locationName)
  const selected = trigger.locator('[data-slot="select-value"]')
  if (await selected.count()) {
    await expect(selected, "Selected Maintenance location").toHaveText(locationName)
  } else {
    await expect.poll(async () => (await trigger.innerText()).replace(/\s*▼\s*$/, "").trim(), {
      message: "Selected Maintenance location",
    }).toBe(locationName)
  }
}

export async function createMaintenanceRequest(
  page: Page,
  title: string,
  locationName?: string,
  areaName = "Kitchen",
  onCreated?: (id: string) => void,
): Promise<string> {
  await page.goto("/maintenance")
  // Finish initial records/supply/summary loading before filling the modal.
  // Each select's committed value is checked separately below.
  await page.waitForLoadState("networkidle")
  await expect(page.getByText("Loading maintenance requests…", { exact: true })).toBeHidden()
  await dismissVisibleNotification(page)
  await page.getByRole("button", { name: "New Maintenance Request" }).click()
  const dialog = page.getByRole("dialog", { name: "New Maintenance Request" })
  const location = dialog.getByLabel("Location", { exact: true })
  const category = dialog.getByLabel("Maintenance Category", { exact: true })
  const area = dialog.getByLabel("Classroom / Area", { exact: true })
  const description = `Disposable STG E2E maintenance request for ${title}`
  await dialog.getByLabel("Issue / Request Title").fill(title)
  await dialog.getByLabel("Description", { exact: true }).fill(description)
  if (locationName) {
    await selectMaintenanceLocation(location, locationName)
  }
  await selectPopupOption(category, "Building / Facility")
  await selectMaintenanceArea(page, areaName)

  await expect(location).toBeVisible()
  await expect(location).toContainText(locationName ?? /\S/)
  await expect(location).not.toContainText("Select location")
  await expect(area).toContainText(areaName)
  await expect(category).toContainText("Building / Facility")
  await expect(dialog.getByLabel("Priority", { exact: true })).toContainText("Normal")
  await expect(dialog.getByLabel("Issue / Request Title")).toHaveValue(title)
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue(description)
  await expect(dialog.getByLabel("Date Reported")).not.toHaveValue("")
  await expect(page.getByRole("listbox")).toHaveCount(0)
  await expect(page.getByRole("menu")).toHaveCount(0)
  const submit = dialog.getByRole("button", { name: "Submit Request", exact: true })
  await expect(submit).toBeEnabled()
  const response = await clickAndWaitForApi(page, submit, {
    label: "Create maintenance request",
    method: "POST",
    path: "/api/maintenance",
  })
  await expectApiStatus(response, "Create maintenance request", 201)
  if (onCreated) onCreated((await response.json() as { id: string }).id)
  await expect(dialog).toBeHidden({ timeout: STG_MUTATION_UI_TIMEOUT_MS })
  return openCreatedItem(page, "/maintenance", "Search maintenance requests", title)
}

export async function createSupplyRequest(page: Page, title: string): Promise<string> {
  await page.goto("/supply-requests")
  await page.getByRole("button", { name: "New Supply Request" }).click()
  const dialog = page.getByRole("dialog", { name: "New Supply Request" })
  await selectClassroomArea(dialog.getByLabel("Classroom / Area"), "Preschool - 1 A")
  await selectPopupOption(dialog.getByLabel("Category"), "Supplies")
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

/** Select a global classroom or facility area through the accessible cascading menu. */
export async function selectMaintenanceArea(page: Page, name: string) {
  await selectClassroomArea(page.getByLabel("Classroom / Area", { exact: true }), name)
}
