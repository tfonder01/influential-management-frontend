import { expect, test as base, type APIRequestContext, type APIResponse, type Page } from "@playwright/test"
import { randomUUID, randomBytes } from "node:crypto"
import { readFile, unlink, stat } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { directorCredentials, locationFixtures, ownerCredentials, required, stagingBackendUrl, stagingBaseUrl, stagingMailMode } from "./support/env"
import { clickAndWaitForApi, createMaintenanceRequest, expectApiStatus, login, readInvitationSetupLink, setOnboardingState, uploadFixturePath, workflowProgress } from "./support/portal"
import { selectPopupOption } from "./support/select"
import { guardStagingContext } from "./support/staging-guard"
import { completeSetup, findPendingMaintenanceFixture } from "./support/maintenance-invitation"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYk0AAAAASUVORK5CYII=", "base64")
const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i

type FixtureKind = "maintenance" | "supply-requests" | "admin/users"
type Attachment = { fileId: string; originalFilename: string }
type Notification = { id: string; type: string; title: string; entityId: string }
type Location = { id: string; name: string; active: boolean }

async function stagingRequest(api: APIRequestContext, token: string, method: string, path: string,
  options: { data?: object; multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } = {}) {
  if (!path.startsWith("/api/")) throw new Error("Expected a staging API path")
  const url = new URL(path, stagingBackendUrl())
  if (url.origin !== stagingBackendUrl()) throw new Error("Unapproved staging API origin")
  return api.fetch(url.href, { method, headers: { Authorization: `Bearer ${token}` }, maxRedirects: 0, ...options })
}

async function json<T>(response: APIResponse, operation: string, status = 200): Promise<T> {
  await expectApiStatus(response, operation, status)
  return response.json() as Promise<T>
}

function mailSettings() {
  const mode = stagingMailMode()
  if (mode === "disabled") return { mode } as const
  const directory = required("PLAYWRIGHT_STAGING_MAIL_HANDOFF_DIR")
  const template = required("PLAYWRIGHT_STAGING_MAIL_RECIPIENT_TEMPLATE")
  if (!isAbsolute(directory) || !/^[^@]*\{id\}[^@]*@[^@\s]+$/.test(template)) {
    throw new Error("Configure an absolute handoff directory and an approved recipient template with {id} in the local part")
  }
  return { mode, directory, template } as const
}

async function handoff(path: string) {
  let value: string | undefined
  await expect.poll(async () => {
    try { value = (await readFile(path, "utf8")).trim() } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Cannot read the staging mail handoff")
    }
    return Boolean(value)
  }, { message: "Waiting for the staging mail handoff", timeout: 90_000 }).toBe(true)
  await unlink(path)
  return value!
}

const test = base.extend<{
  run: {
    owner: Page; worker: Page; a: Location; b: Location; name: string; workerId: string; workerToken: string
    ownerCall: (method: string, path: string, data?: object) => Promise<APIResponse>
    workerCall: (method: string, path: string, data?: object) => Promise<APIResponse>
    own: (kind: FixtureKind, id: string) => void
    addStaffFile: (id: string, filename: string, type: string) => Promise<string>
    confirmMentionEmail: (requestNumber: number) => Promise<void>
  }
}>({
  run: async ({ browser, request }, provide) => {
    const mail = mailSettings()
    if (mail.mode === "capture" && !(await stat(mail.directory).catch(() => null))?.isDirectory()) {
      throw new Error("Create the approved local mail handoff directory before running")
    }
    const marker = randomUUID()
    const name = `E2E Maintenance ${marker}`
    console.log(`[e2e] Disposable fixture run ${marker}`)
    const email = mail.mode === "disabled" ? `${marker}@example.test` : mail.template.replace("{id}", marker)
    const password = `Aa1!${randomBytes(24).toString("hex")}`
    const owner = await browser.newPage()
    const worker = await browser.newPage()
    const owned = new Map<string, FixtureKind>()
    const unattached = new Set<string>()
    const own = (kind: FixtureKind, id: string) => {
      if (!uuidPattern.test(id)) throw new Error("Expected a UUID from the staging create response")
      owned.set(id, kind)
    }
    let inviteLocationId: string | undefined
    let fixtureFailed = false
    let ownerToken: string | undefined
    let originalTour: Awaited<ReturnType<typeof setOnboardingState>> | undefined
    try {
      originalTour = await setOnboardingState(request, ownerCredentials(), "DISMISSED")
      ownerToken = (await login(owner, ownerCredentials())).accessToken
      const ownerCall = (method: string, path: string, data?: object) =>
        stagingRequest(request, ownerToken!, method, path, { data })
      const me = await json<{ role: string; locations: Location[] }>(await ownerCall("GET", "/api/auth/me"), "Load owner fixture locations")
      const names = locationFixtures()
      const a = me.locations.find((location) => location.name === names.directorLocationName && location.active)
      const b = me.locations.find((location) => location.name === names.restrictedLocationName && location.active)
      if (me.role !== "OWNER" || !a || !b || a.id === b.id) throw new Error("Expected an Owner and two distinct active fixture locations")

      await owner.goto("/admin/users")
      await owner.getByRole("button", { name: "Invite user", exact: true }).click()
      const dialog = owner.getByRole("dialog", { name: "Invite user", exact: true })
      await dialog.getByLabel("Full name").fill(name)
      await dialog.getByLabel("Email", { exact: true }).fill(email)
      // The deployed staging UI may still use the previous label. Verify the enum in the response below.
      await selectPopupOption(dialog.getByRole("combobox"), /^Maintenance(?: Only)?$/)
      await dialog.getByRole("checkbox", { name: a.name, exact: true }).check()
      inviteLocationId = a.id
      const invitation = await clickAndWaitForApi(owner, dialog.getByRole("button", { name: "Send invitation" }),
        { label: "Invite disposable worker", method: "POST", path: "/api/admin/users/invite" })
      const invite = await invitation.json() as Pick<import("../lib/user-admin-api").InviteUserResult, "user">
      own("admin/users", invite.user.id)
      expect(invite.user.role).toBe("MAINTENANCE")
      expect(invite.user.locations.map(({ id }) => id)).toEqual([a.id])
      const ready = owner.getByRole("dialog", { name: "Invitation ready", exact: true })
      await ready.waitFor({ state: "visible" })
      let setupUrl = mail.mode === "disabled" ? await readInvitationSetupLink(ready) : undefined
      if (mail.mode === "capture" && await ready.getByRole("link", { name: "Open setup page", exact: true }).count()) {
        throw new Error("Staging mail mode disagrees with the invitation dialog")
      }
      await ready.getByRole("button", { name: "Done", exact: true }).click()
      if (mail.mode === "capture") {
        console.log(`[e2e] Match the invite for ${email}. Write its setup URL to ${marker}.setup.txt in the configured handoff directory.`)
        setupUrl = await handoff(join(mail.directory, `${marker}.setup.txt`))
      }
      await guardStagingContext(worker.context()).catch(() => {
        throw new Error("Account setup: could not establish the approved staging browser guard")
      })
      await completeSetup(worker, setupUrl!, password, stagingBaseUrl())
      const { accessToken: workerToken, user } = await login(worker, { email, password }, "maintenance")
      expect(user.role).toBe("MAINTENANCE")
      const workerCall = (method: string, path: string, data?: object) =>
        stagingRequest(request, workerToken, method, path, { data })
      await provide({
        owner, worker, a, b, name, workerId: invite.user.id, workerToken, ownerCall, workerCall, own,
        async addStaffFile(id, filename, type) {
          if (owned.get(id) !== "maintenance") throw new Error("Cannot attach files to a request outside this run")
          const file = await json<{ id: string }>(await stagingRequest(request, ownerToken!, "POST", `/api/files?locationId=${a.id}`, {
            multipart: { file: { name: filename, mimeType: "application/pdf", buffer: await readFile(uploadFixturePath) } },
          }), "Upload staff fixture file", 201)
          unattached.add(file.id)
          await expectApiStatus(await ownerCall("POST", `/api/maintenance/${id}/attachments`, { fileId: file.id, attachmentType: type }), "Attach staff fixture file", 201)
          unattached.delete(file.id)
          return file.id
        },
        async confirmMentionEmail(requestNumber) {
          if (mail.mode === "disabled") {
            console.log("[e2e] SMTP verification omitted in email-disabled mode")
            return
          }
          console.log(`[e2e] Confirm the Maintenance mention for ${email} and MNT-${requestNumber}. Write MNT-${requestNumber} to ${marker}.mention.txt.`)
          expect(await handoff(join(mail.directory, `${marker}.mention.txt`))).toBe(`MNT-${requestNumber}`)
        },
      })
    } catch (error) {
      fixtureFailed = true
      throw error
    } finally {
      const failures: string[] = []
      if (inviteLocationId && ownerToken && ![...owned.values()].includes("admin/users")) {
        try {
          const id = await findPendingMaintenanceFixture(
            (path) => stagingRequest(request, ownerToken!, "GET", path),
            { email, name, locationId: inviteLocationId },
          )
          if (id) own("admin/users", id)
        } catch {
          failures.push("could not verify the exact pending Maintenance fixture")
        }
      }
      for (const [id, kind] of [...owned].reverse()) {
        try {
          if (!ownerToken) throw new Error()
          const path = `/api/${kind}/${id}`
          if (kind !== "admin/users") {
            const current = await stagingRequest(request, ownerToken, "GET", path)
            if (current.ok() && ((await current.json()) as { archived: boolean }).archived) continue
          }
          const action = kind === "admin/users" ? "disable" : "archive"
          const result = await stagingRequest(request, ownerToken, "POST", `${path}/${action}`)
          if (!result.ok()) {
            failures.push(`${kind}/${id} HTTP ${result.status()}`)
          } else if (kind === "admin/users") {
            const disabled = await result.json() as { id: string; status: string }
            if (disabled.id !== id || disabled.status !== "DISABLED") failures.push(`${kind}/${id} disable not confirmed`)
          }
        } catch { failures.push(`${kind}/${id}`) }
      }
      if (originalTour) {
        await setOnboardingState(request, ownerCredentials(), originalTour).catch(() => { failures.push("Owner onboarding restore") })
      }
      if (mail.mode === "capture") {
        for (const suffix of ["setup", "mention"]) {
          await unlink(join(mail.directory, `${marker}.${suffix}.txt`)).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") failures.push(`${marker}.${suffix}.txt`)
          })
        }
      }
      await Promise.allSettled([owner.context().close(), worker.context().close()])
      if (unattached.size) failures.push(`unattached files: ${[...unattached].join(", ")}`)
      if (failures.length) {
        const message = `Staging cleanup needs attention: ${failures.join("; ")}`
        if (fixtureFailed) console.error(message)
        else throw new Error(message)
      }
    }
  },
})

test.describe("Maintenance worker staging", () => {
  test.skip(process.env.PLAYWRIGHT_ALLOW_STAGING_MAINTENANCE_ONLY !== "true", "Requires an authorized staging run")
  test.describe.configure({ retries: 0, timeout: 360_000 })

  test("Owner provisions a worker and completes the repair lifecycle", async ({ run, browser, request }) => {
    const director = await browser.newPage()
    const credentials = directorCredentials()
    const originalTour = await setOnboardingState(request, credentials, "DISMISSED")
    const title = `${run.name} repair`
    try {
      await login(director, credentials)
      let createdId: string | undefined
      const path = await createMaintenanceRequest(director, title, run.a.name, "Kitchen", (id) => {
        run.own("maintenance", id)
        createdId = id
      })
      expect(path).toBe(`/maintenance/${createdId}`)
      const id = createdId!
      const api = `/api${path}`
      await expectApiStatus(await run.ownerCall("POST", `${api}/approve`, {}), "Approve repair fixture", 200)
      await expectApiStatus(await run.ownerCall("PATCH", api, { ...maintenanceFields(title), assignedUserId: run.workerId }), "Assign repair fixture", 200)
      const invoice = await run.addStaffFile(id, `${run.name}-invoice.pdf`, "INVOICE")
      const legacy = await run.addStaffFile(id, `${run.name}-legacy.pdf`, "OTHER")

      await run.worker.setViewportSize({ width: 390, height: 850 })
      await run.worker.goto("/maintenance")
      await run.worker.getByRole("textbox", { name: "Search maintenance requests", exact: true }).fill(title)
      await run.worker.getByRole("link").and(run.worker.locator(`a[href="${path}"]`)).click()
      await expect(run.worker.getByRole("heading", { name: title, exact: true })).toBeVisible()
      expect(await run.worker.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      await run.worker.setViewportSize({ width: 1440, height: 900 })
      await run.worker.goto("/settings")
      await expect(run.worker).toHaveURL(/\/settings$/)
      await expect(run.worker.getByRole("heading", { name: "Your Profile", exact: true })).toBeVisible()
      await run.worker.goto(path)
      await expect(run.worker.getByRole("heading", { name: "Invoices", exact: true })).toHaveCount(0)
      const allowed = await json<{ attachments: Attachment[] }>(await run.workerCall("GET", api), "Load worker repair details")
      expect(allowed.attachments).toHaveLength(0)
      const attachmentSummary = run.worker.locator("section > div:has(> div > h2)").filter({
        has: run.worker.getByRole("heading", { name: "Attachments", exact: true }),
      })
      await expect(attachmentSummary.getByLabel("0 attachments", { exact: true })).toBeVisible()
      await expect(run.worker.getByText(`${run.name}-invoice.pdf`, { exact: true })).toHaveCount(0)
      for (const file of [invoice, legacy]) {
        expect((await run.workerCall("GET", `${api}/attachments/${file}/content?disposition=inline`)).status()).toBe(404)
        expect((await run.workerCall("GET", `${api}/attachments/${file}/content`)).status()).toBe(404)
      }

      const photoName = `${run.name}-repair.png`
      const pdfName = `${run.name}-support.pdf`
      for (const file of [
        { group: "Completion photos", name: photoName, type: "COMPLETION_PHOTO", mimeType: "image/png", buffer: png },
        { group: "Supporting documents", name: pdfName, type: "SUPPORTING_DOCUMENT", mimeType: "application/pdf", buffer: await readFile(uploadFixturePath) },
      ]) {
        const group = run.worker.getByRole("region", { name: file.group })
        const input = group.locator('input[type="file"]')
        await expect(input).toBeEnabled()
        const [upload] = await Promise.all([
          run.worker.waitForResponse((response) => response.request().method() === "POST"
            && response.url() === `${stagingBackendUrl()}${api}/attachments/upload?attachmentType=${file.type}`),
          input.setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: file.buffer }),
        ])
        await expectApiStatus(upload, `Upload ${file.group} fixture`, 201)
        await expect(group.getByText(file.name, { exact: true })).toBeVisible()
      }
      const detail = await json<{ attachments: Attachment[] }>(await run.workerCall("GET", api), "Load worker repair details")
      expect(detail.attachments.map(({ originalFilename }) => originalFilename).sort()).toEqual([photoName, pdfName].sort())
      await expect(run.worker.getByRole("region", { name: "Completion photos" }).getByText(photoName, { exact: true })).toBeVisible()
      await expect(run.worker.getByRole("region", { name: "Supporting documents" }).getByText(pdfName, { exact: true })).toBeVisible()
      await expect(attachmentSummary.getByLabel("2 attachments", { exact: true })).toBeVisible()
      const photo = detail.attachments.find(({ originalFilename }) => originalFilename === photoName)!.fileId
      const pdf = detail.attachments.find(({ originalFilename }) => originalFilename === pdfName)!.fileId
      await run.worker.getByRole("button", { name: photoName, exact: true }).click()
      await expect(run.worker.getByRole("dialog").getByRole("img", { name: photoName })).toBeVisible()
      await run.worker.keyboard.press("Escape")
      const download = run.worker.waitForEvent("download")
      await run.worker.getByRole("button", { name: `Download ${pdfName}`, exact: true }).click()
      expect((await download).suggestedFilename()).toBe(pdfName)
      const fileResponse = await run.workerCall("GET", `${api}/attachments/${pdf}/content`)
      expect(fileResponse.status()).toBe(200)
      expect(fileResponse.headers()["content-type"]).toContain("application/pdf")
      expect((await fileResponse.body()).equals(await readFile(uploadFixturePath))).toBe(true)

      const denied: [string, string, object?][] = [
        ["POST", "/api/maintenance", maintenanceCreateInput(`${title} denied create`, run.a.id)],
        ["PATCH", api, maintenanceFields(title)], ["POST", `${api}/approve`, {}],
        ["PATCH", `${api}/status`, { status: "CANCELLED" }], ["POST", `${api}/archive`],
        ["POST", `${api}/reopen-completed`], ["DELETE", `${api}/permanent`],
        ["DELETE", `${api}/attachments/${photo}`], ["PUT", `${api}/attachments/${photo}`, { fileId: pdf, attachmentType: "COMPLETION_PHOTO" }],
      ]
      for (const [method, endpoint, data] of denied) {
        const response = await run.workerCall(method, endpoint, data)
        if (endpoint === "/api/maintenance" && response.ok()) run.own("maintenance", (await response.json() as { id: string }).id)
        await expectApiStatus(response, `Deny worker ${method} ${endpoint}`, 403)
      }
      await run.worker.getByPlaceholder("Add a progress update, question, or note…").fill("Synthetic repair progress")
      await clickAndWaitForApi(run.worker, run.worker.getByRole("button", { name: "Add comment" }),
        { label: "Worker comment", method: "POST", path: `${api}/comments` })
      for (const [button, state] of [["Mark In Progress", "In Progress"], ["Mark Waiting", "Waiting"], ["Mark Complete", "Completed"]]) {
        await clickAndWaitForApi(run.worker, run.worker.getByRole("button", { name: button, exact: true }),
          { label: button, method: "PATCH", path: `${api}/status` })
        await expect(workflowProgress(run.worker, "Maintenance", state)).toBeVisible()
      }
      await run.worker.goto("/maintenance")
      await run.worker.getByRole("textbox", { name: "Search maintenance requests", exact: true }).fill(title)
      await expect(run.worker.getByRole("link").and(run.worker.locator(`a[href="${path}"]`))).toBeVisible()
      await expectApiStatus(await run.ownerCall("POST", `${api}/archive`), "Archive repair fixture", 200)
      expect((await run.workerCall("GET", api)).status()).toBe(404)
      expect((await run.workerCall("GET", `${api}/attachments/${photo}/content`)).status()).toBe(404)
    } finally {
      try { await setOnboardingState(request, credentials, originalTour) } finally { await director.context().close() }
    }
  })

  test("Worker session and notifications follow a location reassignment", async ({ run, request }) => {
    const create = async (location: Location, suffix: string) => {
      const item = await json<{ id: string; requestNumber: number }>(await run.ownerCall("POST", "/api/maintenance",
        maintenanceCreateInput(`${run.name} ${suffix}`, location.id)), `Create Maintenance location ${suffix} fixture`, 201)
      run.own("maintenance", item.id)
      return item
    }
    const [a, b] = [await create(run.a, "A"), await create(run.b, "B")]
    const ap = `/api/maintenance/${a.id}`
    const bp = `/api/maintenance/${b.id}`
    const content = `${ap}/attachments/${await run.addStaffFile(a.id, `${run.name}-support.pdf`, "SUPPORTING_DOCUMENT")}/content`
    expect((await run.workerCall("GET", ap)).status()).toBe(200)
    expect((await run.workerCall("GET", content)).status()).toBe(200)
    const blocked = run.worker.waitForResponse((response) => response.request().method() === "GET"
      && response.url() === `${stagingBackendUrl()}${bp}`)
    await run.worker.goto(`/maintenance/${b.id}`)
    expect((await blocked).status()).toBe(403)
    await expect(run.worker.getByRole("heading", { name: `${run.name} B`, exact: true })).toHaveCount(0)
    for (const [page, endpoint] of [["/supply-requests", "/api/supply-requests"], ["/records", "/api/records"],
      ["/dashboard", "/api/dashboard/summary"], ["/admin/users", "/api/admin/users"]]) {
      await run.worker.goto(page)
      await expect(run.worker).toHaveURL(/\/maintenance\/?$/)
      expect((await run.workerCall("GET", endpoint)).status()).toBe(403)
    }
    await expectApiStatus(await run.ownerCall("PATCH", ap, { ...maintenanceFields(`${run.name} A`), assignedUserId: run.workerId }), "Assign location A fixture", 200)
    await expectApiStatus(await run.ownerCall("POST", `${ap}/comments`, { body: `Update for @${run.name}`, mentionedUserIds: [run.workerId] }), "Mention worker on location A fixture", 201)
    const notifications = async () => (await json<{ content: Notification[] }>(await run.workerCall("GET", "/api/notifications"), "List worker notifications")).content
    await expect.poll(async () => (await notifications()).filter(({ entityId }) => entityId === a.id).map(({ type }) => type).sort())
      .toEqual(["MAINTENANCE_ASSIGNED", "MAINTENANCE_MENTION"])
    const mention = (await notifications()).find(({ type, entityId }) => type === "MAINTENANCE_MENTION" && entityId === a.id)!
    await run.worker.getByRole("button", { name: /^Notifications/ }).click()
    await run.worker.getByText(mention.title, { exact: true }).click()
    await expect(run.worker).toHaveURL(new RegExp(`/maintenance/${a.id}$`))
    await run.confirmMentionEmail(a.requestNumber)

    const supply = await json<{ id: string }>(await run.ownerCall("POST", "/api/supply-requests", {
      title: `${run.name} unrelated`, locationId: run.a.id, quantity: 1, category: "SUPPLIES", priority: "MEDIUM",
    }), "Create unrelated supply fixture", 201)
    run.own("supply-requests", supply.id)
    const rejected = await run.ownerCall("POST", `/api/supply-requests/${supply.id}/comments`,
      { body: `Unrelated @${run.name}`, mentionedUserIds: [run.workerId] })
    expect(rejected.status()).toBe(400)
    expect((await rejected.json() as { code: string }).code).toBe("INVALID_MENTION")
    expect((await notifications()).some(({ entityId }) => entityId === supply.id)).toBe(false)

    await expectApiStatus(await run.ownerCall("PATCH", `/api/admin/users/${run.workerId}`, { role: "MAINTENANCE", locationIds: [run.b.id] }), "Reassign worker to location B", 200)
    expect((await run.workerCall("GET", ap)).status()).toBe(403)
    expect((await run.workerCall("GET", content)).status()).toBe(403)
    expect((await run.workerCall("GET", bp)).status()).toBe(200)
    expect((await notifications()).some(({ entityId }) => entityId === a.id)).toBe(false)
    for (const action of ["read", "dismiss"]) {
      expect((await run.workerCall("POST", `/api/notifications/${mention.id}/${action}`)).status()).toBe(404)
    }
    await run.worker.reload()
    await expect(run.worker.getByRole("heading", { name: `${run.name} A`, exact: true })).toHaveCount(0)
    await run.worker.goto("/maintenance")
    await expect(run.worker.getByRole("link", { name: `${run.name} B`, exact: true })).toBeVisible()
    await expect(run.worker.getByRole("link", { name: `${run.name} A`, exact: true })).toHaveCount(0)
    // Use the original bearer token after reassigning the open browser session.
    expect((await stagingRequest(request, run.workerToken, "GET", bp)).status()).toBe(200)
  })
})

function maintenanceFields(title: string) {
  return { title, description: "Synthetic staging test", area: "Kitchen",
    category: "BUILDING_FACILITY", priority: "MEDIUM" }
}

function maintenanceCreateInput(title: string, locationId: string) {
  return { ...maintenanceFields(title), locationId, approvalRequired: false }
}
