import { request } from "@playwright/test"
import { stagingBackendUrl } from "./support/env"

const READINESS_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 3_000
// A cold or busy hosted STG service can take longer than a local request, while
// the overall deadline still prevents readiness from blocking indefinitely.
const REQUEST_TIMEOUT_MS = 30_000

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({ baseURL: stagingBackendUrl() })
  const startedAt = Date.now()
  const deadline = startedAt + READINESS_TIMEOUT_MS
  let attempts = 0
  let lastResult = "no response received"

  try {
    while (Date.now() < deadline) {
      attempts += 1
      try {
        const response = await api.get("/actuator/health", {
          timeout: Math.min(REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now())),
        })
        const body = await response.json().catch(() => null) as { status?: unknown } | null

        if (response.ok() && body?.status === "UP") {
          console.log(`[e2e] STG backend is UP after ${attempts} readiness attempt(s).`)
          return
        }

        lastResult = `HTTP ${response.status()} with health status ${String(body?.status ?? "unavailable")}`
      } catch (error) {
        lastResult = error instanceof Error ? error.message : "unknown network error"
      }

      const remaining = deadline - Date.now()
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS, remaining)))
      }
    }
  } finally {
    await api.dispose()
  }

  throw new Error(
    `STG backend did not report UP at /actuator/health within ${READINESS_TIMEOUT_MS / 1000}s `
      + `after ${attempts} attempt(s). Last result: ${lastResult}`
  )
}
