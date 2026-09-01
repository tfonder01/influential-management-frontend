"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Send,
  Archive,
  RotateCcw,
  Upload,
  Wrench,
  Package,
  MapPin,
  Loader2,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { LOCATIONS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { getRecordWorkspace } from "@/lib/record-workspaces"
import { listActivity, type ApiActivityItem, type ApiActivityModule } from "@/lib/activity-api"

/**
 * Activity timestamps must render in the viewer's own browser/device timezone (not the server's
 * or a hard-coded zone), unlike `lib/format-date.ts`'s `fmtDate`/`fmtTime`, which intentionally
 * read UTC calendar/clock fields so server- and client-rendered HTML always match byte-for-byte.
 * That UTC-field behavior is exactly wrong for Activity: it displays the timestamp's UTC clock
 * digits mislabeled as if they were already local, so anyone outside UTC sees the wrong time.
 * `toLocaleDateString`/`toLocaleTimeString` (no explicit `timeZone` option) resolve to the
 * runtime's local zone automatically, which is safe here because Activity data is always fetched
 * client-side after mount (see `ProductionActivityFeed`), so there is no static/SSR HTML for
 * these values to mismatch against during hydration.
 */
function fmtLocalTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function fmtLocalDateHeading(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Same as {@link fmtLocalDateHeading} but for a bare "YYYY-MM-DD" grouping key (no time-of-day,
 * as used by the demo feed's date grouping) - constructed via the local-time Date constructor so
 * it can never shift to an adjacent calendar day depending on the viewer's UTC offset. */
function fmtLocalDateOnlyHeading(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const EVENT_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; iconClass: string }
> = {
  created: { icon: Upload, label: "Record created", iconClass: "bg-blue-100 text-blue-600" },
  edited: { icon: RefreshCw, label: "Record edited", iconClass: "bg-slate-100 text-slate-600" },
  status_changed: { icon: CheckCircle2, label: "Status changed", iconClass: "bg-emerald-100 text-emerald-600" },
  comment_added: { icon: Send, label: "Comment added", iconClass: "bg-violet-100 text-violet-600" },
  file_uploaded: { icon: FileText, label: "File uploaded", iconClass: "bg-sky-100 text-sky-600" },
  archived: { icon: Archive, label: "Archived", iconClass: "bg-slate-100 text-slate-500" },
  restored: { icon: RotateCcw, label: "Restored", iconClass: "bg-teal-100 text-teal-600" },
}

// Icon/color config per module for the production feed. Falls back to a generic action-based
// icon (e.g. archive/restore) when it materially changes the visual meaning.
const MODULE_CONFIG: Record<ApiActivityModule, { icon: React.ElementType; iconClass: string; label: string }> = {
  RECORDS: { icon: FileText, iconClass: "bg-blue-100 text-blue-600", label: "Records" },
  MAINTENANCE: { icon: Wrench, iconClass: "bg-amber-100 text-amber-600", label: "Maintenance" },
  SUPPLY: { icon: Package, iconClass: "bg-violet-100 text-violet-600", label: "Supply" },
  OTHER: { icon: RefreshCw, iconClass: "bg-slate-100 text-slate-600", label: "Other" },
}

function iconForAction(item: ApiActivityItem): { icon: React.ElementType; iconClass: string } {
  const action = item.action
  if (action.endsWith("ARCHIVED")) return { icon: Archive, iconClass: "bg-slate-100 text-slate-500" }
  if (action.endsWith("RESTORED") || action.endsWith("REOPENED")) return { icon: RotateCcw, iconClass: "bg-teal-100 text-teal-600" }
  if (action.includes("COMMENT")) return { icon: Send, iconClass: "bg-violet-100 text-violet-600" }
  if (action.includes("ATTACHMENT")) return { icon: FileText, iconClass: "bg-sky-100 text-sky-600" }
  if (action.includes("APPROVED") || action.includes("COMPLETED") || action.includes("RECEIVED")) {
    return { icon: CheckCircle2, iconClass: "bg-emerald-100 text-emerald-600" }
  }
  return MODULE_CONFIG[item.module]
}

/** Calendar-day comparison (browser-local) used purely for the Today/Yesterday/date grouping headers. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return fmtLocalDateHeading(iso)
}

const MODULE_FILTERS: { key: "ALL" | ApiActivityModule; label: string }[] = [
  { key: "ALL", label: "All Activity" },
  { key: "RECORDS", label: "Records" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "SUPPLY", label: "Supply" },
]

function ProductionActivityFeed() {
  const { role, locations } = useApp()
  const [moduleFilter, setModuleFilter] = useState<"ALL" | ApiActivityModule>("ALL")
  const [locationFilter, setLocationFilter] = useState<string>("ALL")
  const [items, setItems] = useState<ApiActivityItem[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const result = await listActivity({
          module: moduleFilter === "ALL" ? undefined : moduleFilter,
          locationId: locationFilter === "ALL" ? undefined : locationFilter,
          page: pageToLoad,
          size: 20,
        })
        setItems((prev) => (append ? [...prev, ...result.content] : result.content))
        setTotalPages(result.totalPages)
        setPage(pageToLoad)
      } catch {
        setError("Couldn't load activity right now. Please try again.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [moduleFilter, locationFilter]
  )

  useEffect(() => {
    fetchPage(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, locationFilter])

  // Group into Today / Yesterday / date sections, preserving newest-first order from the API.
  const grouped: { label: string; events: ApiActivityItem[] }[] = []
  items.forEach((item) => {
    const label = dayLabel(item.createdAt)
    const last = grouped[grouped.length - 1]
    if (last && last.label === label) {
      last.events.push(item)
    } else {
      grouped.push({ label, events: [item] })
    }
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {MODULE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setModuleFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                moduleFilter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {role === "owner" && locations.length > 1 && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ALL">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No recent activity</p>
          <p className="mt-1 text-xs text-muted-foreground">Record, maintenance, and supply changes will appear here.</p>
        </div>
      )}

      {!loading &&
        !error &&
        grouped.map((group) => (
          <section key={group.label} className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm sm:px-6">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="space-y-0.5">
              {group.events.map((item, i) => {
                const { icon: Icon, iconClass } = iconForAction(item)
                const isLast = i === group.events.length - 1
                const Row = (
                  <div className="flex-1 pb-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="text-sm font-medium text-foreground leading-snug">{item.message}</p>
                        {(item.locationName || item.entityDisplayNumber) && (
                          <p className="text-[11px] text-muted-foreground">
                            {item.locationName}
                            {item.locationName && item.entityDisplayNumber ? " · " : ""}
                            {item.entityDisplayNumber}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-left sm:block sm:text-right">
                        <p className="text-xs font-medium text-foreground">{item.actorDisplayName ?? "System"}</p>
                        {item.actorRole && (
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {item.actorRole.replace(/_/g, " ").toLowerCase()}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{fmtLocalTime(item.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                )
                return (
                  <div key={item.id} className="interactive-row relative -mx-2 flex gap-4 rounded-lg px-2 pt-1">
                    {!isLast && <div className="absolute left-6 top-9 h-full w-px bg-border" />}
                    <div className={cn("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", iconClass)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {item.route ? (
                      <Link
                        href={item.route}
                        className="flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {Row}
                      </Link>
                    ) : (
                      Row
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

      {!loading && !error && page + 1 < totalPages && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchPage(page + 1, true)}
            disabled={loadingMore}
            className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}

function DemoActivityFeed() {
  const { activity, records, maintenanceRequests, supplyRequests } = useApp()

  const sorted = [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Group by date
  const grouped: Record<string, typeof sorted> = {}
  sorted.forEach((evt) => {
    const date = evt.timestamp.split("T")[0]
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(evt)
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {sorted.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No recent activity</p>
          <p className="mt-1 text-xs text-muted-foreground">Record changes and comments will appear here.</p>
        </div>
      )}
      {Object.entries(grouped).map(([date, events]) => (
        <section key={date} className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {fmtLocalDateOnlyHeading(date)}
            </p>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="space-y-0.5">
            {events.map((evt, i) => {
              const config = EVENT_CONFIG[evt.type] ?? EVENT_CONFIG.created
              const Icon = config.icon
              const record = records.find((r) => r.id === evt.recordId)
              const maintenanceRequest = maintenanceRequests.find((request) => request.id === evt.recordId)
              const supplyRequest = supplyRequests.find((request) => request.id === evt.recordId)
              const entity = record ?? maintenanceRequest ?? supplyRequest
              const location = entity
                ? LOCATIONS.find((l) => l.id === entity.locationId)
                : null
              const isLast = i === events.length - 1

              return (
                <div key={evt.id} className="interactive-row relative -mx-2 flex gap-4 rounded-lg px-2 pt-1">
                  {!isLast && (
                    <div className="absolute left-6 top-9 h-full w-px bg-border" />
                  )}
                  <div
                    className={cn(
                      "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                      config.iconClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {evt.detail}
                        </p>
                        {record && (
                          <Link
                            href={`/records/${record.id}`}
                            className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {record.title}
                          </Link>
                        )}
                        {maintenanceRequest && (
                          <Link
                            href={`/maintenance/${maintenanceRequest.id}`}
                            className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {maintenanceRequest.title}
                          </Link>
                        )}
                        {supplyRequest && <Link href={`/supply-requests/${supplyRequest.id}`} className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{supplyRequest.itemName}</Link>}
                        {location && (
                          <p className="text-[11px] text-muted-foreground">
                            {location.name} &middot; {supplyRequest ? "Supply Request" : maintenanceRequest ? "Maintenance" : record && getRecordWorkspace(record) === "operations" ? "Operations" : "Compliance"}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-left sm:block sm:text-right">
                        <p className="text-xs font-medium text-foreground">{evt.user}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">{evt.role.replace("_", " ")}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtLocalTime(evt.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function ActivityPage() {
  const { isDemoMode } = useApp()
  return isDemoMode ? <DemoActivityFeed /> : <ProductionActivityFeed />
}
