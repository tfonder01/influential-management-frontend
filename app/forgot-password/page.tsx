"use client"

import Link from "next/link"
import { FormEvent, useId, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { AuthBranding } from "@/components/auth/auth-branding"
import { AuthCard, AuthFooterNote } from "@/components/auth/auth-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiClientError, apiClient } from "@/lib/api-client"
import { PASSWORD_RESET_SUCCESS } from "@/lib/password-recovery"

function describeFailure(cause: unknown) {
  if (cause instanceof ApiClientError && cause.code === "NETWORK_ERROR") {
    return "We couldn't reach the server. Check your connection and try again."
  }
  return "We couldn't submit your request. Please try again shortly."
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const errorId = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError("")
    try {
      await apiClient.requestPasswordReset(email)
      setComplete(true)
    } catch (cause) {
      setError(describeFailure(cause))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <AuthBranding className="mb-6" />
      <AuthCard aria-labelledby="forgot-password-title">
        {complete ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
            <h2 id="forgot-password-title" className="mt-4 text-xl font-semibold">Check your email</h2>
            <p role="status" className="mt-2 text-sm leading-relaxed text-muted-foreground">{PASSWORD_RESET_SUCCESS}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Check your spam folder if you do not see it. Reset links are one-time use and expire.
            </p>
            <Button render={<Link href="/login" />} nativeButton={false} className="mt-6 w-full">Return to sign in</Button>
          </div>
        ) : (
          <>
            <h2 id="forgot-password-title" className="text-center text-xl font-semibold">Reset your password</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              Enter your account email and we&rsquo;ll send reset instructions if the account is eligible.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError("") }}
                  disabled={submitting}
                  aria-invalid={!!error}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              {error && <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" type="submit" disabled={submitting || !email.trim()}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Sending&hellip;</> : "Send reset link"}
              </Button>
            </form>
            <Button render={<Link href="/login" />} nativeButton={false} variant="ghost" className="mt-3 w-full">Return to sign in</Button>
          </>
        )}
      </AuthCard>
      <AuthFooterNote>Powered by SentryPoint Systems</AuthFooterNote>
    </AuthShell>
  )
}
