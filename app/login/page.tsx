"use client"

import { FormEvent, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { ApiClientError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthCard, AuthFooterNote } from "@/components/auth/auth-card"
import { AuthBranding } from "@/components/auth/auth-branding"

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
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const errorId = useId()

  useEffect(() => {
    if (!isProductionMode || status === "authenticated") router.replace("/dashboard")
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
      router.replace("/dashboard")
    } catch (cause) {
      setError(describeLoginFailure(cause))
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  return (
    <AuthShell>
      <AuthBranding className="mb-6" />
      <AuthCard aria-labelledby="login-title">
        <h2 id="login-title" className="sr-only">
          Sign in
        </h2>
        <p className="mb-6 text-center text-sm leading-relaxed text-muted-foreground">
          Secure access to your organization&rsquo;s operations and compliance workspace.
        </p>
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
      </AuthCard>
      <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
    </AuthShell>
  )
}
