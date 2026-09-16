"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { loginHrefFor, protectedRouteDecision } from "@/lib/auth-navigation"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, isProductionMode } = useAuth()
  const router = useRouter()
  const decision = protectedRouteDecision(isProductionMode, status)

  useEffect(() => {
    if (decision !== "redirect") return
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    router.replace(loginHrefFor(returnTo))
  }, [decision, router])

  if (decision !== "allow") {
    return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Checking your session…</main>
  }
  return children
}
