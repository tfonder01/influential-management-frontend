"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  copyPermanentDeleteConfirmation,
  createPermanentDeleteSubmissionGuard,
  isPermanentDeleteConfirmed,
  PERMANENT_DELETE_CONFIRMATION,
} from "@/lib/permanent-delete"

interface PermanentDeleteDialogProps {
  open: boolean
  recordLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function PermanentDeleteDialog({ open, recordLabel, onOpenChange, onConfirm }: PermanentDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submissionGuard = useRef(createPermanentDeleteSubmissionGuard()).current

  useEffect(() => {
    if (!open) return
    setConfirmation("")
    setSubmitting(false)
    setCopied(false)
    setError(null)
  }, [open, recordLabel])

  const handleCopy = async () => {
    setError(null)
    try {
      await copyPermanentDeleteConfirmation(navigator.clipboard)
      setCopied(true)
    } catch {
      setError("Could not copy DELETE. Type it exactly as shown instead.")
    }
  }

  const handleConfirm = async () => {
    if (!isPermanentDeleteConfirmed(confirmation)) return
    await submissionGuard(async () => {
      setSubmitting(true)
      setError(null)
      try {
        await onConfirm()
        onOpenChange(false)
      } catch (caught) {
        setError(caught instanceof Error && caught.message ? caught.message : "The record could not be permanently deleted.")
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-md" showCloseButton={!submitting}>
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Permanently delete this record?</DialogTitle>
              <DialogDescription className="mt-1 break-words">
                This removes <span className="font-medium text-foreground">{recordLabel}</span> from the portal and cannot be undone through the application.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">To confirm, type:</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2">
            <code className="font-mono text-sm font-bold tracking-widest text-destructive">{PERMANENT_DELETE_CONFIRMATION}</code>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void handleCopy()} disabled={submitting}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <label htmlFor="permanent-delete-confirmation" className="sr-only">Type DELETE to confirm permanent deletion</label>
          <Input
            id="permanent-delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Type DELETE"
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "permanent-delete-error" : undefined}
          />
          {error && <p id="permanent-delete-error" role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={submitting || !isPermanentDeleteConfirmed(confirmation)}
          >
            {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {submitting ? "Deleting…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}