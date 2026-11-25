export interface TestCredentials {
  email: string
  password: string
}

export function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`)
  return value
}

function httpsOrigin(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Invalid staging origin")
  }
  if (url.protocol !== "https:" || url.username || url.password || raw.replace(/\/$/, "") !== url.origin) {
    throw new Error("Expected an exact HTTPS staging origin")
  }
  return url.origin
}

function stagingOrigins() {
  const approved = new Set(required("PLAYWRIGHT_APPROVED_STAGING_ORIGINS").split(",").map((value) => httpsOrigin(value.trim())))
  const frontend = httpsOrigin(required("PLAYWRIGHT_BASE_URL"))
  const backend = httpsOrigin(required("PLAYWRIGHT_BACKEND_URL"))
  const stagingHostname = /(^|[.-])(stg|staging)([.-]|$)/i
  if (frontend === backend || approved.size !== 2 || !approved.has(frontend) || !approved.has(backend)
    || !stagingHostname.test(new URL(frontend).hostname)) {
    throw new Error("Frontend and backend must match the two approved staging origins")
  }
  return { frontend, backend }
}

export function stagingBaseUrl(): string {
  return stagingOrigins().frontend
}

export function stagingBackendUrl(): string {
  return stagingOrigins().backend
}

export function ownerCredentials(): TestCredentials {
  return {
    email: required("PLAYWRIGHT_OWNER_EMAIL"),
    password: required("PLAYWRIGHT_OWNER_PASSWORD"),
  }
}

export function directorCredentials(): TestCredentials {
  return {
    email: required("PLAYWRIGHT_DIRECTOR_EMAIL"),
    password: required("PLAYWRIGHT_DIRECTOR_PASSWORD"),
  }
}

export function stagingMailMode(): "disabled" | "capture" {
  const mode = process.env.PLAYWRIGHT_STAGING_MAIL_MODE?.trim() || "disabled"
  if (mode !== "disabled" && mode !== "capture") throw new Error("Staging mail mode must be disabled or capture")
  return mode
}

export function assistantDirectorCredentials(): TestCredentials {
  return {
    email: required("PLAYWRIGHT_ASSISTANT_DIRECTOR_EMAIL"),
    password: required("PLAYWRIGHT_ASSISTANT_DIRECTOR_PASSWORD"),
  }
}

export function locationFixtures() {
  return {
    directorLocationName: required("PLAYWRIGHT_DIRECTOR_LOCATION_NAME"),
    restrictedLocationName: required("PLAYWRIGHT_RESTRICTED_LOCATION_NAME"),
  }
}
