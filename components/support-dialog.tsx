"use client"

import { forwardRef, useImperativeHandle, useReducer } from "react"
import { CheckCircle2, Lightbulb, Loader2, MessageCircleWarning } from "lucide-react"
import { usePathname } from "next/navigation"
import { ApiClientError } from "@/lib/api-client"
import {
  inferSupportLocationId,
  initialSupportFormState,
  SUPPORT_MESSAGE_MAX_LENGTH,
  supportFormReducer,
  supportMessageError,
} from "@/lib/support-form"
import { submitSupport, type SupportSubmissionType } from "@/lib/support-api"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface SupportDialogHandle {
  open: () => void
}

const TYPE_OPTIONS: Array<{
  value: SupportSubmissionType
  label: string
  description: string
  icon: typeof MessageCircleWarning
}> = [
  {
    value: "PROBLEM",
    label: "Report a problem",
    description: "Something is not working as expected.",
    icon: MessageCircleWarning,
  },
  {
    value: "FEATURE_SUGGESTION",
    label: "Suggest a feature",
    description: "Share an idea that could improve the portal.",
    icon: Lightbulb,
  },
]

export const SupportDialog = forwardRef<SupportDialogHandle>(function SupportDialog(_, ref) {
  const [state, dispatch] = useReducer(supportFormReducer, initialSupportFormState)
  const pathname = usePathname()
  const { locations } = useApp()

  useImperativeHandle(ref, () => ({ open: () => dispatch({ type: "OPEN" }) }), [])

  const close = () => {
    if (state.status !== "submitting") dispatch({ type: "CLOSE" })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = supportMessageError(state.message)
    if (validationError) {
      dispatch({ type: "SUBMIT_FAILURE", error: validationError })
      return
    }

    dispatch({ type: "SUBMIT_START" })
    try {
      await submitSupport({
        type: state.type,
        message: state.message.trim(),
        currentPath: pathname,
        locationId: inferSupportLocationId(locations),
      })
      dispatch({ type: "SUBMIT_SUCCESS" })
    } catch (error) {
      dispatch({
        type: "SUBMIT_FAILURE",
        error: error instanceof ApiClientError
          ? error.message
          : "We couldn't send your message right now. Please try again.",
      })
    }
  }

  const selectedType = TYPE_OPTIONS.find((option) => option.value === state.type)!

  return (
    <Dialog open={state.open} onOpenChange={(open) => open ? dispatch({ type: "OPEN" }) : close()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
        {state.status === "success" ? (
          <div className="py-3 text-center sm:py-5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle className="mt-4">Message sent</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-sm">
              Your message was sent to support. We can reply using the email address on your account.
            </DialogDescription>
            <Button className="mt-6" onClick={close}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Help &amp; support</DialogTitle>
              <DialogDescription>
                Report a portal problem or share an idea with SentryPoint support.
              </DialogDescription>
            </DialogHeader>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Type</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors focus-within:ring-3 focus-within:ring-ring/50",
                      state.type === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="support-type"
                      value={value}
                      checked={state.type === value}
                      onChange={() => dispatch({ type: "SET_SUBMISSION_TYPE", value })}
                      disabled={state.status === "submitting"}
                    />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="mt-1 block text-xs leading-4 text-muted-foreground">{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={state.message}
                onChange={(event) => dispatch({ type: "SET_MESSAGE", value: event.target.value })}
                placeholder={state.type === "PROBLEM"
                  ? "What happened, and what were you trying to do?"
                  : "What would you like the portal to help you do?"}
                rows={6}
                maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
                aria-invalid={Boolean(state.error)}
                aria-describedby={state.error ? "support-message-error support-message-help" : "support-message-help"}
                disabled={state.status === "submitting"}
                className="min-h-32 resize-y"
              />
              <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                <p id="support-message-help">
                  {selectedType.value === "PROBLEM"
                    ? "For problems, tell us what happened and what you were trying to do."
                    : "Describe the improvement and how it would help your work."}
                </p>
                <span className="shrink-0 tabular-nums">{state.message.length}/{SUPPORT_MESSAGE_MAX_LENGTH}</span>
              </div>
              {state.error && <p id="support-message-error" role="alert" className="text-sm text-destructive">{state.error}</p>}
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={close} disabled={state.status === "submitting"}>
                Cancel
              </Button>
              <Button type="submit" disabled={state.status === "submitting"}>
                {state.status === "submitting" && <Loader2 className="animate-spin" aria-hidden="true" />}
                {state.status === "submitting" ? "Sending…" : "Send to support"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
})
