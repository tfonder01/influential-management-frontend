import type { ChangeEvent, ElementType, ReactNode } from "react"
import { FileText, Loader2, Upload } from "lucide-react"

import { cn } from "@/lib/utils"

export const attachmentActionButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"

export function AttachmentSectionHeader({
  title,
  helper,
  count,
}: {
  title: string
  helper: string
  count: number
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" aria-label={`${count} attachments`}>
        {count}
      </span>
    </div>
  )
}

export function AttachmentRow({
  label,
  onOpen,
  actions,
  badge,
  icon: Icon = FileText,
}: {
  label: string
  onOpen: () => void
  actions: ReactNode
  badge?: ReactNode
  icon?: ElementType
}) {
  return (
    <div className="group flex min-h-12 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {badge && <div className="mb-0.5 flex">{badge}</div>}
        <button
          type="button"
          onClick={onOpen}
          className="block min-h-8 w-full truncate rounded px-1 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={label}
        >
          {label}
        </button>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>
    </div>
  )
}

export function AttachmentEmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function AttachmentUploadControl({
  label,
  accept,
  disabled,
  busy,
  onChange,
}: {
  label: string
  accept: string
  disabled?: boolean
  busy?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      className={cn(
        "mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
      {label}
      <input type="file" className="sr-only" accept={accept} disabled={disabled} onChange={onChange} />
    </label>
  )
}

export function AttachmentGroup({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string
  count: number
  icon: ElementType
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-muted/10 p-3 sm:p-4" aria-label={title}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" aria-label={`${count} attachments`}>
          {count}
        </span>
      </div>
      {children}
    </section>
  )
}
