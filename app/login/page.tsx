"use client"

import Link from "next/link"
import { FormEvent, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ClipboardCheck, Eye, EyeOff, Loader2, MapPinned, Wrench } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { authenticatedDestination } from "@/lib/auth-navigation"
import { ApiClientError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthCard, AuthFooterNote } from "@/components/auth/auth-card"
import { AuthBranding } from "@/components/auth/auth-branding"

const capabilities = [
  {
    label: "Compliance Records",
    description: "Keep critical records organized and ready for review.",
    icon: ClipboardCheck,
  },
  {
    label: "Maintenance & Supplies",
    description: "Coordinate requests, approvals, and progress in one place.",
    icon: Wrench,
  },
  {
    label: "Multi-Location Visibility",
    description: "Stay aligned across every location you oversee.",
    icon: MapPinned,
  },
]

/** Generic, non-technical copy — never reveals whether a specific account exists. */
function describeLoginFailure(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    if (cause.code === "NETWORK_ERROR") {
      return "We couldn't reach the server. Check your connection and try again."
    }
    if (cause.status === 401 || cause.status === 400 || cause.status === 403) {
      return "The email or password you entered is incorrect."
    }
    if (cause.status >= 500) {
      return "We're having trouble reaching the server. Please try again shortly."
    }
    return "Something went wrong. Please try again."
  }
  // Defense in depth: api-client normalizes fetch()'s raw network-failure exceptions into
  // ApiClientError, but fall back to the same friendly copy for any other unexpected error.
  return "We couldn't reach the server. Check your connection and try again."
}

export default function LoginPage() {
  const { login, status, isProductionMode } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [resetComplete, setResetComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const errorId = useId()

  useEffect(() => {
    setResetComplete(new URLSearchParams(window.location.search).get("reset") === "success")
    if (!isProductionMode || status === "authenticated") {
      router.replace(authenticatedDestination(window.location.search))
    }
  }, [isProductionMode, status, router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Guard against duplicate submissions (rapid Enter presses / double-click) beyond
    // just the disabled button state, since state updates are asynchronous.
    if (submittingRef.current) return
    submittingRef.current = true
    setError("")
    setSubmitting(true)
    try {
      await login(email, password)
      router.replace(authenticatedDestination(window.location.search))
    } catch (cause) {
      setError(describeLoginFailure(cause))
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  return (
    <AuthShell contentClassName="max-w-5xl">
      <AuthCard className="grid overflow-hidden p-0 lg:min-h-[640px] lg:grid-cols-[1.08fr_0.92fr]" aria-labelledby="login-title">
        <aside className="relative hidden overflow-hidden bg-sidebar px-12 py-14 text-sidebar-foreground lg:flex lg:flex-col" aria-label="Portal capabilities">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 18% 14%, oklch(0.68 0.13 295 / 0.28), transparent 28%), radial-gradient(circle at 88% 86%, oklch(0.62 0.14 230 / 0.22), transparent 34%), linear-gradient(145deg, transparent 35%, oklch(0.4 0.075 295 / 0.22))",
            }}
          />
          <div aria-hidden="true" className="absolute -right-20 top-16 h-64 w-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-6 top-28 h-40 w-40 rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-bold tracking-wide ring-1 ring-white/15">
              IM
            </div>
            <div className="mt-auto">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">Your operational workspace</p>
              <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight">
                Clear visibility for confident day-to-day operations.
              </h2>
              <ul className="mt-9 space-y-5">
                {capabilities.map(({ label, description, icon: Icon }) => (
                  <li key={label} className="flex gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-sidebar-foreground/65">{description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <AuthBranding className="mb-7" />
          <h2 id="login-title" className="text-center text-xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="mb-6 mt-1.5 text-center text-sm leading-relaxed text-muted-foreground">
            Sign in to your operations and compliance workspace.
          </p>
          {resetComplete && (
            <p role="status" className="mb-5 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Your password has been reset. Sign in with your new password.
            </p>
          )}
          <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                disabled={submitting}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={submitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
          </div>
          {error && (
            <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in&hellip;
              </>
            ) : (
              "Sign in"
            )}
          </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help?{" "}
            <a href="mailto:support@sentrypointsystems.com" className="font-medium text-primary hover:underline">
              Contact support
            </a>
          </p>
          <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
        </div>
      </AuthCard>
    </AuthShell>
  )
}
