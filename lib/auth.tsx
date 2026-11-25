"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiClient, ApiClientError, type SessionUser } from "./api-client"
import type { AuthStatus } from "./auth-navigation"

interface AuthContextValue {
  status: AuthStatus
  user: SessionUser | null
  isProductionMode: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
export const isProductionAuthMode = process.env.NEXT_PUBLIC_APP_MODE === "production"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isProductionAuthMode ? "loading" : "authenticated")
  const [user, setUser] = useState<SessionUser | null>(null)

  const refreshSession = useCallback(async () => {
    const session = await apiClient.restoreSession()
    setUser(session.user)
    setStatus("authenticated")
  }, [])

  useEffect(() => {
    if (!isProductionAuthMode) return
    const unsubscribe = apiClient.onSessionRefresh(setUser)
    refreshSession().catch(() => { setUser(null); setStatus("anonymous") })
    return unsubscribe
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiClient.login(email, password)
    setUser(session.user)
    setStatus("authenticated")
    return session.user
  }, [])

  useEffect(() => {
    if (!isProductionAuthMode || status !== "authenticated") return
    let active = true
    const synchronize = () => {
      void apiClient.request<SessionUser>("/api/auth/me").then((current) => {
        if (active) setUser(current)
      }).catch((error: unknown) => {
        if (active && error instanceof ApiClientError && error.status === 401) {
          setUser(null)
          setStatus("anonymous")
        }
      })
    }
    window.addEventListener("focus", synchronize)
    return () => {
      active = false
      window.removeEventListener("focus", synchronize)
    }
  }, [status])

  const logout = useCallback(async () => {
    await apiClient.logout()
    setUser(null)
    setStatus("anonymous")
  }, [])

  const value = useMemo(() => ({ status, user, isProductionMode: isProductionAuthMode, login, logout, refreshSession }), [status, user, login, logout, refreshSession])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}
