"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiClient, type SessionUser } from "./api-client"

type AuthStatus = "loading" | "authenticated" | "anonymous"
interface AuthContextValue {
  status: AuthStatus
  user: SessionUser | null
  isProductionMode: boolean
  login: (email: string, password: string) => Promise<void>
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
    refreshSession().catch(() => { setUser(null); setStatus("anonymous") })
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiClient.login(email, password)
    setUser(session.user)
    setStatus("authenticated")
  }, [])

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
