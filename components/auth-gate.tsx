"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { loginHrefFor, maintenanceRouteAllowed, protectedRouteDecision } from "@/lib/auth-navigation"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, isProductionMode, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const restricted = status === "authenticated" && user?.role === "MAINTENANCE" && !maintenanceRouteAllowed(pathname)

  useEffect(() => {
    if (restricted) router.replace("/maintenance")
  }, [restricted, router])
  const decision = protectedRouteDecision(isProductionMode, status)

  useEffect(() => {
    if (decision !== "redirect") return
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.replace(loginHrefFor(returnTo))
  }, [decision, router])

  if (decision !== "allow" || restricted) {
    return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Checking your session…</main>
  }
  return children
}
