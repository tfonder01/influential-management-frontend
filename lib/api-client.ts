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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse> | null = null

async function parseError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; code?: string; requestId?: string } | null
  return new ApiClientError(body?.message ?? "Request failed", response.status, body?.code, body?.requestId)
}

async function authRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
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
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" })
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
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" })
    if (response.status === 401 && retry) {
      await refresh()
      return this.requestBlob(path, init, false)
    }
    if (!response.ok) throw await parseError(response)
    return response.blob()
  },
}
