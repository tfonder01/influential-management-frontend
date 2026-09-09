import { resolveApiUrl } from "./api-origin"

export interface ApiLocation {
  id: string
  name: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  phone?: string
  active: boolean
}

export type ApiRole = "OWNER" | "DIRECTOR" | "ASSISTANT_DIRECTOR"

export interface SessionUser {
  id: string
  organizationId: string
  organizationName: string
  email: string
  firstName: string
  lastName: string
  role: ApiRole
  locations: ApiLocation[]
}

interface AuthResponse {
  accessToken: string
  tokenType: "Bearer"
  expiresInSeconds: number
  user: SessionUser
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string
  ) {
    super(message)
  }
}

/**
 * Preserve the configured API origin in deployed environments. The only hostname
 * reconciliation allowed is localhost <-> 127.0.0.1 for local development, where the
 * refresh cookie and browser page must use the same loopback hostname.
 */
const API_URL = resolveApiUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  typeof window === "undefined" ? undefined : window.location.hostname
)
let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse> | null = null

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; code?: string; requestId?: string } | null
  return new ApiClientError(body?.message ?? "Request failed", response.status, body?.code, body?.requestId)
}

/**
 * Wraps the raw fetch() call so network-level failures (offline, DNS failure, connection
 * refused, CORS block, etc.) are normalized into an ApiClientError at the exact point they
 * occur, instead of letting the browser's native TypeError("Failed to fetch") escape the
 * API boundary un-normalized. fetch() rejections are otherwise a distinct, uncontrolled
 * error shape that can surface as an unhandled runtime exception (e.g. the Next.js dev
 * overlay) even when a caller several async hops away already catches it — handling it
 * here, at the source, ensures every consumer only ever deals with one typed error.
 */
async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw new ApiClientError("Unable to reach the server", 0, "NETWORK_ERROR")
  }
}

async function authRequest(path: string, init: RequestInit = {}) {
  const response = await safeFetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  if (!response.ok) throw await parseError(response)
  return response
}

async function refresh(): Promise<AuthResponse> {
  if (!refreshInFlight) {
    refreshInFlight = authRequest("/api/auth/refresh", { method: "POST" })
      .then((response) => response.json() as Promise<AuthResponse>)
      .then((session) => {
        accessToken = session.accessToken
        return session
      })
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export const apiClient = {
  async login(email: string, password: string) {
    const response = await authRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    const session = await response.json() as AuthResponse
    accessToken = session.accessToken
    return session
  },

  async validateSetupToken(token: string) {
    await authRequest("/api/auth/setup-account/validate", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  },

  async setupAccount(token: string, password: string, confirmPassword: string) {
    await authRequest("/api/auth/setup-account", {
      method: "POST",
      body: JSON.stringify({ token, password, confirmPassword }),
    })
  },

  restoreSession: refresh,

  async logout() {
    try { await authRequest("/api/auth/logout", { method: "POST" }) }
    finally { accessToken = null }
  },

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!accessToken) await refresh()
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")
    const response = await safeFetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" })
    if (response.status === 401 && retry) {
      await refresh()
      return this.request<T>(path, init, false)
    }
    if (!response.ok) throw await parseError(response)
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  },

  /** For binary endpoints (e.g. file downloads) that don't return JSON. */
  async requestBlob(path: string, init: RequestInit = {}, retry = true): Promise<Blob> {
    if (!accessToken) await refresh()
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    const response = await safeFetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" })
    if (response.status === 401 && retry) {
      await refresh()
      return this.requestBlob(path, init, false)
    }
    if (!response.ok) throw await parseError(response)
    return response.blob()
  },
}
