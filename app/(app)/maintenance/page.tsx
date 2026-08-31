"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  Plus,
  Search,
  ChevronRight,
  SlidersHorizontal,
  Wrench,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { MAINTENANCE_AREAS, MAINTENANCE_CATEGORIES } from "@/lib/mock-data"
import type { MaintenanceApprovalStatus, MaintenanceStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NewMaintenanceRequestModal } from "@/components/new-maintenance-request-modal"
import { hasPotentialRepeatHistory } from "@/lib/maintenance-history"
import { maintenanceDisplayId } from "@/lib/maintenance-display"
import {
  ApprovalStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
  RepeatIssueBadge,
} from "@/components/maintenance-badges"

const approvalOptions: MaintenanceApprovalStatus[] = ["Not Required", "Awaiting Approval", "Approved", "Declined"]
const statusOptions: MaintenanceStatus[] = ["Submitted", "Approved / Ready", "In Progress", "Waiting", "Completed", "Cancelled"]
const selectClass = "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
    </div>
  )
}

export default function MaintenancePage() {
  const {
    maintenanceRequests,
    maintenanceRequestsLoading,
    maintenanceRequestsError,
    refreshMaintenanceRequests,
    locations,
    isDemoMode,
  } = useApp()
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [areaFilter, setAreaFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [approvalFilter, setApprovalFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const active = maintenanceRequests.filter((request) => !request.archived)
  const completedMonth = active.reduce((latest, request) => request.completedAt && request.completedAt > latest ? request.completedAt : latest, "").slice(0, 7)
  const completedThisMonth = active.filter((request) => request.maintenanceStatus === "Completed" && request.completedAt?.startsWith(completedMonth))
  const totalCostThisMonth = completedThisMonth.reduce((sum, request) => sum + (request.finalCost ?? 0), 0)
  const awaitingApprovalCount = active.filter((request) => request.approvalStatus === "Awaiting Approval").length
  const additionalFilterCount = Number(areaFilter !== "all") + Number(categoryFilter !== "all")
  const filtersActive = Boolean(search.trim())
    || locationFilter !== "all"
    || approvalFilter !== "all"
    || statusFilter !== "all"
    || additionalFilterCount > 0

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return active.filter((request) => {
      const location = locations.find((item) => item.id === request.locationId)
      const matchesSearch = !needle || [request.title, request.description, request.area, request.category, request.submittedBy, request.vendor, location?.name]
        .some((value) => value?.toLowerCase().includes(needle))
      return matchesSearch
        && (locationFilter === "all" || request.locationId === locationFilter)
        && (areaFilter === "all" || request.area === areaFilter)
        && (categoryFilter === "all" || request.category === categoryFilter)
        && (approvalFilter === "all" || request.approvalStatus === approvalFilter)
        && (statusFilter === "all" || request.maintenanceStatus === statusFilter)
    }).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
  }, [active, search, locations, locationFilter, areaFilter, categoryFilter, approvalFilter, statusFilter])

  const resetFilters = () => {
    setSearch("")
    setLocationFilter("all")
    setAreaFilter("all")
    setCategoryFilter("all")
    setApprovalFilter("all")
    setStatusFilter("all")
    setMoreFiltersOpen(false)
  }

  const showInitialLoading = !isDemoMode && maintenanceRequestsLoading && maintenanceRequests.length === 0
  const showInitialError = !isDemoMode && maintenanceRequestsError && maintenanceRequests.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Wrench className="h-4.5 w-4.5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Maintenance</h2>
              <p className="text-sm text-muted-foreground">Report issues, route approvals, and preserve repair and cost history.</p>
            </div>
          </div>
        </div>
        <Button className="gap-2 sm:shrink-0" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />New Maintenance Request</Button>
      </div>

      {!isDemoMode && maintenanceRequestsError && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{maintenanceRequestsError}</span>
          </div>
          <Button variant="outline" size="sm" className="border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => void refreshMaintenanceRequests()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Open Requests" value={active.filter((request) => !["Completed", "Cancelled"].includes(request.maintenanceStatus)).length} icon={Wrench} accent="bg-blue-50 text-blue-700" />
        <SummaryCard label="Awaiting Approval" value={awaitingApprovalCount} icon={AlertCircle} accent={awaitingApprovalCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"} />
        <SummaryCard label="In Progress" value={active.filter((request) => request.maintenanceStatus === "In Progress").length} icon={Clock3} accent="bg-indigo-50 text-indigo-700" />
        <SummaryCard label="Completed This Month" value={completedThisMonth.length} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-700" />
        <div className="min-[390px]:col-span-2 lg:col-span-1"><SummaryCard label="Cost This Month" value={money.format(totalCostThisMonth)} icon={CircleDollarSign} accent="bg-violet-50 text-violet-700" /></div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-9 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issue, location, vendor, or submitted by…" aria-label="Search maintenance requests" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <select className={selectClass} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter by location">
              <option value="all">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>{statusOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select className={selectClass} value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} aria-label="Filter by approval">
              <option value="all">All approvals</option>{approvalOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={() => setMoreFiltersOpen((open) => !open)}
              aria-expanded={moreFiltersOpen}
              aria-controls="maintenance-more-filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More filters
              {additionalFilterCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">{additionalFilterCount}</span>}
            </Button>
            {filtersActive && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={resetFilters}>Reset filters</Button>}
          </div>
          {moreFiltersOpen && (
            <div id="maintenance-more-filters" className="mt-2 grid gap-2 rounded-lg border border-border bg-muted/25 p-3 sm:grid-cols-2">
              <select className={selectClass} value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} aria-label="Filter by classroom or area">
                <option value="all">All classrooms / areas</option>{MAINTENANCE_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
              <select className={selectClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                <option value="all">All categories</option>{MAINTENANCE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-border bg-muted/25 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">{filtered.length} of {active.length} requests</p>
          <div className="flex items-center gap-3">
            {!isDemoMode && maintenanceRequestsLoading && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Refreshing…</span>}
            <p className="hidden text-[11px] text-muted-foreground sm:block">Approval and maintenance progress are tracked separately</p>
          </div>
        </div>

        {showInitialLoading ? (
          <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Loading maintenance requests…</p>
          </div>
        ) : showInitialError ? (
          <div className="py-14 text-center"><p className="text-sm font-medium text-foreground">Maintenance requests could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void refreshMaintenanceRequests()}>Retry</Button></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center"><p className="text-sm font-medium text-foreground">No matching requests</p><p className="mt-1 text-xs text-muted-foreground">Try clearing one or more filters.</p></div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((request) => {
                const location = locations.find((item) => item.id === request.locationId)
                return (
                  <Link key={request.id} href={`/maintenance/${request.id}`} className="interactive-row block p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold leading-snug text-foreground">{request.title}</p><p className="mt-0.5 text-[11px] font-medium text-muted-foreground/80">{maintenanceDisplayId(request)}</p><p className="mt-1 text-xs text-muted-foreground">{location?.name} · {request.area}</p></div><PriorityBadge priority={request.priority} /></div>
                    <div className="mt-3 flex flex-wrap gap-1.5"><ApprovalStatusBadge status={request.approvalStatus} /><MaintenanceStatusBadge status={request.maintenanceStatus} />{hasPotentialRepeatHistory(request) ? <RepeatIssueBadge /> : null}</div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{request.category}</span><span className="font-medium text-foreground">{request.finalCost != null ? money.format(request.finalCost) : request.estimatedCost != null ? `Est. ${money.format(request.estimatedCost)}` : "—"}</span></div>
                  </Link>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3 text-left">Request / Issue</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Classroom / Area</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Submitted By</th><th className="px-4 py-3 text-left">Submitted</th><th className="px-4 py-3 text-left">Approval</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-left">Last Updated</th><th className="w-10"><span className="sr-only">Open</span></th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((request) => {
                    const location = locations.find((item) => item.id === request.locationId)
                    return (
                      <tr
                        key={request.id}
                        onClick={() => router.push(`/maintenance/${request.id}`)}
                        className="group cursor-pointer transition-colors duration-150 ease-out hover:bg-muted/55"
                      >
                        <td className="px-4 py-3.5"><Link href={`/maintenance/${request.id}`} onClick={(event) => event.stopPropagation()} className="block max-w-[280px] truncate rounded-sm text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{request.title}</Link><p className="mt-0.5 text-[11px] font-medium text-muted-foreground/80">{maintenanceDisplayId(request)}</p><div className="mt-1.5 flex items-center gap-1.5"><PriorityBadge priority={request.priority} />{hasPotentialRepeatHistory(request) ? <RepeatIssueBadge /> : null}</div></td>
                        <td className="px-4 py-3.5 text-xs text-foreground">{location?.name ?? "—"}</td>
                        <td className="px-4 py-3.5 text-xs text-foreground">{request.area}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{request.category}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{request.submittedBy}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        <td className="px-4 py-3.5"><ApprovalStatusBadge status={request.approvalStatus} /></td>
                        <td className="px-4 py-3.5"><MaintenanceStatusBadge status={request.maintenanceStatus} /></td>
                        <td className="px-4 py-3.5 text-right text-xs font-medium tabular-nums text-foreground">{request.finalCost != null ? money.format(request.finalCost) : request.estimatedCost != null ? <span className="text-muted-foreground">Est. {money.format(request.estimatedCost)}</span> : "—"}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(request.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                        <td className="px-2 py-3.5 text-muted-foreground"><ChevronRight className="h-4 w-4 opacity-35 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-80" aria-hidden="true" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <NewMaintenanceRequestModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}
