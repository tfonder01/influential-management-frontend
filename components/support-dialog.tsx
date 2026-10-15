"use client"

import { forwardRef, useImperativeHandle, useReducer } from "react"
import { CheckCircle2, Lightbulb, Loader2, Map, MessageCircleWarning } from "lucide-react"
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
import { useOnboarding } from "@/components/onboarding-provider"

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
  const { locations, isDemoMode } = useApp()
  const { startManualTour } = useOnboarding()

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
  const previewTour = () => {
    close()
    queueMicrotask(startManualTour)
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => open ? dispatch({ type: "OPEN" }) : close()}>
      <DialogContent className="min-w-0 max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
        {isDemoMode ? (
          <div className="min-w-0 py-2">
            <DialogHeader>
              <DialogTitle>Help &amp; support</DialogTitle>
              <DialogDescription>
                Demo mode does not send support requests or save walkthrough progress.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Map className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">Preview the product walkthrough</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">Launch the tour for the currently selected demo role. Completing or skipping it will not be saved.</p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={close}>Close</Button>
              <Button type="button" onClick={previewTour}>Preview walkthrough</Button>
            </DialogFooter>
          </div>
        ) : state.status === "success" ? (
          <div className="min-w-0 py-3 text-center sm:py-5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle className="mt-4">Message sent</DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-sm break-words">
              Your message was sent to support. We can reply using the email address on your account.
            </DialogDescription>
            <Button className="mt-6" onClick={close}>Done</Button>
          </div>
        ) : (
          <form className="min-w-0 max-w-full" onSubmit={handleSubmit} noValidate>
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words">Help &amp; support</DialogTitle>
              <DialogDescription className="break-words">
                Report a portal problem or share an idea with SentryPoint support.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Product walkthrough</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Replay the tour for your current role.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={previewTour}>Restart</Button>
            </div>

            <fieldset className="mt-5 min-w-0 max-w-full">
              <legend className="text-sm font-medium text-foreground">Type</legend>
              <div className="mt-2 grid min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex min-w-0 max-w-full cursor-pointer gap-3 rounded-lg border p-3 transition-colors focus-within:ring-3 focus-within:ring-ring/50",
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
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="mt-1 block break-words text-xs leading-4 text-muted-foreground">{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 min-w-0 max-w-full space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={state.message}
                onChange={(event) => dispatch({ type: "SET_MESSAGE", value: event.target.value })}
                placeholder={state.type === "PROBLEM"
                  ? "What happened, and what were you trying to do?"
                  : "What would you like the portal to help you do?"}
                rows={6}
                wrap="soft"
                maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
                aria-invalid={Boolean(state.error)}
                aria-describedby={state.error ? "support-message-error support-message-help" : "support-message-help"}
                disabled={state.status === "submitting"}
                className="min-h-32 min-w-0 max-w-full resize-y whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                style={{ fieldSizing: "fixed" }}
              />
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <p id="support-message-help" className="min-w-0 flex-1 break-words">
                  {selectedType.value === "PROBLEM"
                    ? "For problems, tell us what happened and what you were trying to do."
                    : "Describe the improvement and how it would help your work."}
                </p>
                <span className="shrink-0 tabular-nums">{state.message.length}/{SUPPORT_MESSAGE_MAX_LENGTH}</span>
              </div>
              {state.error && <p id="support-message-error" role="alert" className="max-w-full break-words text-sm text-destructive">{state.error}</p>}
            </div>

            <DialogFooter className="mt-6 min-w-0">
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
