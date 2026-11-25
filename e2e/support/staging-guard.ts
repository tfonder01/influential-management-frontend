import type { BrowserContext } from "@playwright/test"
import { stagingBackendUrl, stagingBaseUrl } from "./env.ts"

const guarded = new WeakMap<BrowserContext, string>()

export function guardedApiOrigin(context: BrowserContext) {
  return guarded.get(context)
}

export async function guardStagingContext(context: BrowserContext) {
  if (guarded.has(context)) return
  const frontend = stagingBaseUrl()
  const backend = stagingBackendUrl()
  await context.route("**/*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const api = url.pathname.startsWith("/api/") || Boolean(request.headers().authorization)
    if (api) {
      if (url.origin !== backend) return route.abort()
      const response = await route.fetch({ maxRedirects: 0 }).catch(() => null)
      if (!response) return route.abort()
      try {
        if (response.status() >= 300 && response.status() < 400 && response.headers().location) return route.abort()
        return await route.fulfill({ response })
      } finally {
        await response.dispose()
      }
    }
    if (request.isNavigationRequest() && url.protocol !== "blob:" && url.origin !== frontend) return route.abort()
    await route.continue()
  })
  guarded.set(context, backend)
}
