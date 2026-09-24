"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { rootRouteDecision } from "@/lib/auth-navigation"

export default function HomePage() {
  const { isProductionMode, status } = useAuth()
  const router = useRouter()
  const decision = rootRouteDecision(isProductionMode, status)

  useEffect(() => {
    if (decision === "dashboard") router.replace("/dashboard")
    if (decision === "login") router.replace("/login")
  }, [decision, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background" aria-label="Opening portal">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Opening portal</span>
    </main>
  )
}
