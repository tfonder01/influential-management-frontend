"use client"

import Link from "next/link"
import { FormEvent, Suspense, useEffect, useId, useRef, useState } from "react"
import { CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { AuthBranding } from "@/components/auth/auth-branding"
import { AuthCard, AuthFooterNote } from "@/components/auth/auth-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiClientError, apiClient } from "@/lib/api-client"

function setupError(error: unknown) {
  if (error instanceof ApiClientError && error.code === "NETWORK_ERROR") {
    return "We couldn't reach the server. Check your connection and try again."
  }
  return "This setup link has expired or is no longer valid."
}

function submissionError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_SETUP_TOKEN" || error.code === "NETWORK_ERROR") return setupError(error)
    if (error.code === "PASSWORD_MISMATCH") return "Passwords do not match."
    return error.message || "Your account could not be activated. Please try again."
  }
  return "Your account could not be activated. Please try again."
}

function SetupAccountForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const [linkState, setLinkState] = useState<"checking" | "valid" | "invalid">("checking")
  const [linkError, setLinkError] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const submittingRef = useRef(false)
  const errorId = useId()

  useEffect(() => {
    let active = true
    if (!token) {
      setLinkState("invalid")
      setLinkError("This setup link has expired or is no longer valid.")
      return
    }
    apiClient.validateSetupToken(token)
      .then(() => { if (active) setLinkState("valid") })
      .catch((cause) => {
        if (active) {
          setLinkState("invalid")
          setLinkError(setupError(cause))
        }
      })
    return () => { active = false }
  }, [token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    setError("")
    if (!password.trim()) {
      setError("Password cannot be blank or only spaces.")
      return
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      await apiClient.setupAccount(token, password, confirmPassword)
      setComplete(true)
    } catch (cause) {
      const message = submissionError(cause)
      setError(message)
      if (cause instanceof ApiClientError && cause.code === "INVALID_SETUP_TOKEN") setLinkState("invalid")
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  return (
    <AuthShell>
      <AuthBranding className="mb-6" />
      <AuthCard aria-labelledby="setup-title">
        {linkState === "checking" && (
          <div className="flex min-h-40 flex-col items-center justify-center text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <h2 id="setup-title" className="mt-4 text-lg font-semibold">Checking your setup link</h2>
            <p className="mt-1 text-sm text-muted-foreground">This will only take a moment.</p>
          </div>
        )}

        {linkState === "invalid" && (
          <div className="py-4 text-center">
            <TriangleAlert className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
            <h2 id="setup-title" className="mt-4 text-lg font-semibold">Setup link unavailable</h2>
            <p role="alert" className="mt-2 text-sm leading-relaxed text-muted-foreground">{linkError || error || "This setup link has expired or is no longer valid."}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Ask your organization Owner to resend your invitation.</p>
            <Button render={<Link href="/login" />} nativeButton={false} variant="outline" className="mt-6 w-full">Return to sign in</Button>
          </div>
        )}

        {linkState === "valid" && complete && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
            <h2 id="setup-title" className="mt-4 text-lg font-semibold">Your account is ready</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your password has been created. Sign in to continue to your workspace.</p>
            <Button render={<Link href="/login" />} nativeButton={false} className="mt-6 w-full">Continue to sign in</Button>
          </div>
        )}

        {linkState === "valid" && !complete && (
          <>
            <h2 id="setup-title" className="text-center text-xl font-semibold">Set up your account</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">Create a password to activate your Influential Management account.</p>
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={200} value={password} onChange={(event) => { setPassword(event.target.value); setError("") }} disabled={submitting} aria-invalid={!!error} aria-describedby={`${errorId}-requirements ${error ? errorId : ""}`} className="pr-9" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={submitting} aria-label={showPassword ? "Hide passwords" : "Show passwords"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p id={`${errorId}-requirements`} className="text-xs text-muted-foreground">Use at least 12 characters; the password cannot be blank or only spaces.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={200} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError("") }} disabled={submitting} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
              </div>
              {error && <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={submitting || password.length < 12 || confirmPassword.length < 12}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Activating account&hellip;</> : "Activate account"}
              </Button>
            </form>
          </>
        )}
      </AuthCard>
      <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
    </AuthShell>
  )
}

export default function SetupAccountPage() {
  return <Suspense fallback={<AuthShell><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></AuthShell>}><SetupAccountForm /></Suspense>
}
