"use client"

import Link from "next/link"
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  ClipboardCheck,
  Wrench,
  Package,
  Loader2,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { StatusBadge } from "@/components/status-badge"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { isRecordActionable } from "@/lib/needs-review"
import { listActivity, type ApiActivityItem } from "@/lib/activity-api"

function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  href,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  iconClassName: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="interactive-card group flex min-h-28 min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 sm:min-h-32 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-current/10 ${iconClassName}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-auto text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
    </Link>
  )
}

export default function DashboardPage() {
  const {
    records,
    activity: demoActivity,
    locations,
    dashboardSummary,
    dashboardSummaryLoading,
    dashboardSummaryError,
    refreshDashboardSummary,
    isDemoMode,
  } = useApp()
  const [now, setNow] = useState<number | null>(null)
  const [productionActivity, setProductionActivity] = useState<ApiActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(!isDemoMode)
  const [activityError, setActivityError] = useState<string | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  const refreshRecentActivity = useCallback(async () => {
    if (isDemoMode) return

    setActivityLoading(true)
    setActivityError(null)
    try {
      const result = await listActivity({ page: 0, size: 5 })
      setProductionActivity(result.content)
    } catch {
      setActivityError("Couldn't load recent activity right now.")
    } finally {
      setActivityLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    void refreshRecentActivity()
  }, [refreshRecentActivity])

  const recentUploads = records
    .filter((record) => record.status !== "Archived")
    .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate))
    .slice(0, 5)

  const needsReviewRecords = records
    .filter(isRecordActionable)
    .slice(0, 5)

  const recentDemoActivity = [...demoActivity]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)

  const metricValue = (value: number | undefined) =>
    value ?? (dashboardSummaryLoading ? "…" : "—")
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Summary Cards */}
      {!isDemoMode && dashboardSummaryError && (
        <div className="order-1 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{dashboardSummaryError}</span>
          <Button variant="outline" size="sm" className="border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => void refreshDashboardSummary()}>
            Retry
          </Button>
        </div>
      )}
      <div className="order-1 grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="New Records"
          value={metricValue(dashboardSummary?.records.newCount)}
          icon={Upload}
          iconClassName="bg-blue-50 text-blue-600"
          href="/records?status=New"
        />
        <StatCard
          label="Needs Review"
          value={metricValue(dashboardSummary?.needsReview.total)}
          icon={AlertCircle}
          iconClassName="bg-amber-50 text-amber-600"
          href="/needs-review"
        />
        <StatCard
          label="Needs Attention"
          value={metricValue(dashboardSummary?.records.needsAttention)}
          icon={AlertCircle}
          iconClassName="bg-amber-50 text-amber-600"
          href="/records?status=Needs%20Attention"
        />
        <StatCard
          label="Reviewed Records"
          value={metricValue(dashboardSummary?.records.reviewed)}
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-600"
          href="/records?status=Reviewed"
        />
      </div>

      <div className="order-3 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-6">
        {/* Recent Uploads */}
        <div className="contents">
          <div className="order-4 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:col-span-4">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Recent Uploads</h2>
              <Link
                href="/records"
                className="arrow-link flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentUploads.map((rec) => {
                const location = locations.find((l) => l.id === rec.locationId)
                return (
                  <Link
                    key={rec.id}
                    href={`/records/${rec.id}`}
                    className="interactive-row flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{rec.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {location?.name} &middot; {rec.uploadedBy} &middot;{" "}
                        {new Date(rec.uploadDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={rec.status} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Needs Review Queue */}
          <div className="order-2 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:order-1 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Records Needing Review</h2>
              <Link
                href="/needs-review"
                className="arrow-link flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {needsReviewRecords.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                No Compliance or Operations records need review.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {needsReviewRecords.map((rec) => {
                  const location = locations.find((l) => l.id === rec.locationId)
                  const daysAgo =
                    now !== null
                      ? Math.floor((now - new Date(rec.uploadDate).getTime()) / 86400000)
                      : null
                  return (
                    <Link
                      key={rec.id}
                      href={`/records/${rec.id}`}
                      className="interactive-row flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{rec.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {location?.name} &middot; {rec.category}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={rec.status} />
                        {daysAgo !== null && (
                          <span className="text-[10px] text-muted-foreground">{daysAgo}d ago</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="contents">
          {/* Recent Activity */}
          <div className="order-5 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:order-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <Link
                href="/activity"
                className="arrow-link flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {!isDemoMode && activityLoading && (
              <div className="flex items-center justify-center gap-2 px-5 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent activity...
              </div>
            )}
            {!isDemoMode && !activityLoading && activityError && (
              <div className="flex flex-col items-center gap-3 px-5 py-7 text-center">
                <p className="text-xs text-muted-foreground">{activityError}</p>
                <Button variant="outline" size="sm" onClick={() => void refreshRecentActivity()}>
                  Retry
                </Button>
              </div>
            )}
            {!isDemoMode && !activityLoading && !activityError && productionActivity.length === 0 && (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">No recent activity.</p>
            )}
            {!isDemoMode && !activityLoading && !activityError && productionActivity.length > 0 && (
              <div className="divide-y divide-border">
                {productionActivity.map((evt) => {
                  const row = (
                    <div className="px-5 py-3 transition-colors duration-150 hover:bg-muted/30">
                      <p className="text-xs font-medium leading-snug text-foreground">{evt.message}</p>
                      {(evt.locationName || evt.entityDisplayNumber) && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {evt.locationName}
                          {evt.locationName && evt.entityDisplayNumber ? " · " : ""}
                          {evt.entityDisplayNumber}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {evt.actorDisplayName ?? "System"}
                        {evt.actorRole && (
                          <>
                            {" · "}
                            <span className="capitalize">{evt.actorRole.replace(/_/g, " ").toLowerCase()}</span>
                          </>
                        )}
                        {" · "}
                        {new Date(evt.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )

                  return evt.route ? (
                    <Link
                      key={evt.id}
                      href={evt.route}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={evt.id}>{row}</div>
                  )
                })}
              </div>
            )}
            {isDemoMode && recentDemoActivity.length === 0 && (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">No recent activity.</p>
            )}
            {isDemoMode && recentDemoActivity.length > 0 && (
              <div className="divide-y divide-border">
                {recentDemoActivity.map((evt) => (
                  <div key={evt.id} className="px-5 py-3 transition-colors duration-150 hover:bg-muted/30">
                    <p className="text-xs font-medium text-foreground leading-snug">{evt.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {evt.user} &middot;{" "}
                      {new Date(evt.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="order-3 min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:order-2 lg:col-span-2">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Workspaces</h2>
            </div>
            <div className="divide-y divide-border">
              <Link href="/operations" className="interactive-row group flex min-h-20 min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Operations</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{metricValue(dashboardSummary?.records.operations)}</span> operations records
                    <span aria-hidden="true"> &middot; </span>
                    <span className="font-semibold tabular-nums text-blue-700">{metricValue(dashboardSummary?.records.compliance)}</span> compliance
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/maintenance" className="interactive-row group flex min-h-20 min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Maintenance</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{metricValue(dashboardSummary?.maintenance.open)}</span> open
                    <span aria-hidden="true"> &middot; </span>
                    <span className="font-semibold tabular-nums text-orange-700">{metricValue(dashboardSummary?.maintenance.awaitingApproval)}</span> awaiting approval
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {metricValue(dashboardSummary?.maintenance.completedThisMonth)} completed this month
                    <span aria-hidden="true"> &middot; </span>
                    {dashboardSummary ? money.format(dashboardSummary.maintenance.costThisMonth) : "—"} final cost
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/supply-requests" className="interactive-row group flex min-h-20 min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Supply Requests</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{metricValue(dashboardSummary?.supply.open)}</span> open
                    <span aria-hidden="true"> &middot; </span>
                    <span className="font-semibold tabular-nums text-teal-700">{metricValue(dashboardSummary?.supply.awaitingApproval)}</span> awaiting approval
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {metricValue(dashboardSummary?.supply.receivedThisMonth)} received this month
                    <span aria-hidden="true"> &middot; </span>
                    {dashboardSummary ? money.format(dashboardSummary.supply.spendThisMonth) : "—"} final spend
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
