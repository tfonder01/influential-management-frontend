"use client"

import Link from "next/link"
import { FormEvent, Suspense, useEffect, useId, useRef, useState } from "react"
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthBranding } from "@/components/auth/auth-branding"
import { AuthCard, AuthFooterNote } from "@/components/auth/auth-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiClientError, apiClient } from "@/lib/api-client"
import { validateNewPassword } from "@/lib/password-recovery"

function linkError(cause: unknown) {
  if (cause instanceof ApiClientError && cause.code === "NETWORK_ERROR") {
    return "We couldn't reach the server. Check your connection and try again."
  }
  return "This password reset link has expired or is no longer valid."
}

function completionError(cause: unknown) {
  if (cause instanceof ApiClientError) {
    if (cause.code === "INVALID_RESET_TOKEN" || cause.code === "NETWORK_ERROR") return linkError(cause)
    if (cause.code === "PASSWORD_MISMATCH") return "Passwords do not match."
    if (cause.code === "INVALID_PASSWORD") return "Password must be at least 12 characters and cannot be blank."
  }
  return "Your password could not be reset. Please try again."
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""
  const [linkState, setLinkState] = useState<"checking" | "valid" | "invalid">("checking")
  const [linkMessage, setLinkMessage] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const errorId = useId()

  useEffect(() => {
    let active = true
    if (!token) {
      setLinkState("invalid")
      setLinkMessage("This password reset link has expired or is no longer valid.")
      return
    }
    apiClient.validatePasswordResetToken(token)
      .then(() => { if (active) setLinkState("valid") })
      .catch((cause) => {
        if (active) {
          setLinkState("invalid")
          setLinkMessage(linkError(cause))
        }
      })
    return () => { active = false }
  }, [token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    setError("")
    const validationError = validateNewPassword(password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      await apiClient.resetPassword(token, password, confirmPassword)
      router.replace("/login?reset=success")
    } catch (cause) {
      const message = completionError(cause)
      setError(message)
      if (cause instanceof ApiClientError && cause.code === "INVALID_RESET_TOKEN") {
        setLinkState("invalid")
        setLinkMessage(message)
      }
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  return (
    <AuthShell>
      <AuthBranding className="mb-6" />
      <AuthCard aria-labelledby="reset-password-title">
        {linkState === "checking" && (
          <div className="flex min-h-40 flex-col items-center justify-center text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <h2 id="reset-password-title" className="mt-4 text-lg font-semibold">Checking your reset link</h2>
            <p className="mt-1 text-sm text-muted-foreground">This will only take a moment.</p>
          </div>
        )}

        {linkState === "invalid" && (
          <div className="py-4 text-center">
            <TriangleAlert className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
            <h2 id="reset-password-title" className="mt-4 text-lg font-semibold">Reset link unavailable</h2>
            <p role="alert" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {linkMessage || "This password reset link has expired or is no longer valid."}
            </p>
            <Button render={<Link href="/forgot-password" />} nativeButton={false} className="mt-6 w-full">Request a new link</Button>
            <Button render={<Link href="/login" />} nativeButton={false} variant="ghost" className="mt-2 w-full">Return to sign in</Button>
          </div>
        )}

        {linkState === "valid" && (
          <>
            <h2 id="reset-password-title" className="text-center text-xl font-semibold">Choose a new password</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              Resetting your password signs you out of all existing sessions.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={200}
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); setError("") }}
                    disabled={submitting}
                    aria-invalid={!!error}
                    aria-describedby={`${errorId}-requirements ${error ? errorId : ""}`}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={submitting}
                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p id={`${errorId}-requirements`} className="text-xs text-muted-foreground">
                  Use at least 12 characters; the password cannot be blank or only spaces.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={200}
                  value={confirmPassword}
                  onChange={(event) => { setConfirmPassword(event.target.value); setError("") }}
                  disabled={submitting}
                  aria-invalid={!!error}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              {error && <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={submitting || password.length < 12 || confirmPassword.length < 12}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Resetting password&hellip;</> : "Reset password"}
              </Button>
            </form>
          </>
        )}
      </AuthCard>
      <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></AuthShell>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
