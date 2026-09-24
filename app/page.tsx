"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Loader2, MapPinned, Wrench } from "lucide-react"
import { AuthBranding } from "@/components/auth/auth-branding"
import { AuthFooterNote } from "@/components/auth/auth-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { rootRouteDecision } from "@/lib/auth-navigation"

const capabilities = [
  { label: "Compliance Records", icon: ClipboardCheck },
  { label: "Maintenance & Supplies", icon: Wrench },
  { label: "Multi-Location Visibility", icon: MapPinned },
]

export default function HomePage() {
  const { isProductionMode, status } = useAuth()
  const router = useRouter()
  const decision = rootRouteDecision(isProductionMode, status)

  useEffect(() => {
    if (decision === "redirect") router.replace("/dashboard")
  }, [decision, router])

  if (decision !== "public") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background" aria-label="Opening portal">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Opening portal</span>
      </main>
    )
  }

  return (
    <AuthShell>
      <AuthBranding className="mb-7" />
      <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-lg shadow-slate-950/5 sm:p-8" aria-labelledby="entry-heading">
        <h2 id="entry-heading" className="sr-only">Portal access</h2>
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          Secure access to your organization&rsquo;s operations and compliance workspace.
        </p>
        <ul className="my-6 grid gap-2" aria-label="Portal capabilities">
          {capabilities.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-sm text-foreground">
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
          Sign In
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need help?{" "}
          <a href="mailto:support@sentrypointsystems.com" className="font-medium text-primary hover:underline">
            support@sentrypointsystems.com
          </a>
        </p>
      </section>
      <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
    </AuthShell>
  )
}
