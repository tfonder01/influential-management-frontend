"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"
import { viewFileApi, isApiClientError } from "@/lib/records-api"

interface FilePreviewModalProps {
  open: boolean
  onClose: () => void
  fileId: string | null
  filename: string
}

/**
 * Authorized inline preview for images and PDFs. Fetches the file content through the same
 * authorized endpoint as download (just with `disposition=inline`), so access control is always
 * identical between "View" and "Download" — this never renders a public storage URL.
 */
export function FilePreviewModal({ open, onClose, fileId, filename }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<{ url: string; contentType: string } | null>(null)

  useEffect(() => {
    if (!open || !fileId) return
    let cancelled = false
    setLoading(true)
    setError("")
    setPreview(null)
    viewFileApi(fileId)
      .then((result) => { if (!cancelled) setPreview(result) })
      .catch((err) => { if (!cancelled) setError(isApiClientError(err) ? err.message : "This file could not be loaded.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, fileId])

  // Revoke the object URL once it's no longer needed, whether the modal closes or a new file loads.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview.url)
  }, [preview])

  const isImage = preview?.contentType.startsWith("image/")
  const isPdf = preview?.contentType === "application/pdf"

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">{filename}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[50vh] items-center justify-center overflow-auto rounded-lg bg-muted/30">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && preview && isImage && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived blob object URL, not a remote/static asset next/image can optimize.
            <img src={preview.url} alt={filename} className="max-h-[75vh] w-auto max-w-full object-contain" />
          )}

          {!loading && !error && preview && isPdf && (
            <iframe src={preview.url} title={filename} className="h-[75vh] w-full rounded-lg border-0" />
          )}

          {!loading && !error && preview && !isImage && !isPdf && (
            <p className="py-16 text-sm text-muted-foreground">
              This file type can&apos;t be previewed. Please use Download instead.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
