export interface TestCredentials {
  email: string
  password: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`)
  return value
}

export function stagingBaseUrl(): string {
  const raw = required("PLAYWRIGHT_BASE_URL")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("PLAYWRIGHT_BASE_URL must be an absolute staging URL")
  }

  const stagingHostname = /(^|[.-])(stg|staging)([.-]|$)/i.test(url.hostname)
  if (url.protocol !== "https:" || !stagingHostname) {
    throw new Error(
      `Refusing to run E2E tests against non-staging URL: ${url.origin}. ` +
        "Use an HTTPS hostname containing a stg or staging segment."
    )
  }

  return url.origin
}

export function stagingBackendUrl(): string {
  const raw = required("PLAYWRIGHT_BACKEND_URL")

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("PLAYWRIGHT_BACKEND_URL must be an absolute STG URL")
  }

  if (url.protocol !== "https:") {
    throw new Error(`Refusing to poll a non-HTTPS STG backend URL: ${url.origin}`)
  }

  return url.origin
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

export function locationFixtures() {
  return {
    directorLocationName: required("PLAYWRIGHT_DIRECTOR_LOCATION_NAME"),
    restrictedLocationName: required("PLAYWRIGHT_RESTRICTED_LOCATION_NAME"),
  }
}
