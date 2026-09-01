"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, ChevronRight, CircleDollarSign, Loader2, Package, PackageCheck, Plus, Search, ShoppingCart, SlidersHorizontal } from "lucide-react"
import { useApp } from "@/lib/store"
import { SUPPLY_AREAS, SUPPLY_CATEGORIES } from "@/lib/mock-data"
import type { SupplyApprovalStatus, SupplyStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NewSupplyRequestModal } from "@/components/new-supply-request-modal"
import { SupplyApprovalBadge, SupplyPriorityBadge, SupplyStatusBadge } from "@/components/supply-badges"

const approvals: SupplyApprovalStatus[] = ["Not Required", "Awaiting Approval", "Needs Information", "Approved", "Declined"]
const statuses: SupplyStatus[] = ["Submitted", "Approved / Ready", "Ordered", "Waiting / In Transit", "Received", "Cancelled"]
const selectClass = "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}><Icon className="h-4 w-4" /></div></div><p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</p></div>
}

export default function SupplyRequestsPage() {
  const { supplyRequests, supplyRequestsLoading, supplyRequestsError, refreshSupplyRequests, locations, isDemoMode } = useApp()
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [approvalFilter, setApprovalFilter] = useState("all")
  const [areaFilter, setAreaFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const active = supplyRequests.filter((request) => !request.archived)
  const receivedMonth = active.reduce((latest, request) => request.receivedAt && request.receivedAt > latest ? request.receivedAt : latest, "").slice(0, 7)
  const additionalFilters = Number(areaFilter !== "all") + Number(categoryFilter !== "all")
  const filtersActive = Boolean(search.trim()) || [locationFilter, statusFilter, approvalFilter, areaFilter, categoryFilter].some((value) => value !== "all")
  const showInitialLoading = !isDemoMode && supplyRequestsLoading && supplyRequests.length === 0
  const showInitialError = !isDemoMode && supplyRequestsError && supplyRequests.length === 0

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return active.filter((request) => {
      const location = locations.find((item) => item.id === request.locationId)
      const matchesSearch = !needle || [request.itemName, request.description, request.area, request.category, request.requestedBy, request.vendor, location?.name].some((value) => value?.toLowerCase().includes(needle))
      return matchesSearch && (locationFilter === "all" || request.locationId === locationFilter) && (statusFilter === "all" || request.fulfillmentStatus === statusFilter) && (approvalFilter === "all" || request.approvalStatus === approvalFilter) && (areaFilter === "all" || request.area === areaFilter) && (categoryFilter === "all" || request.category === categoryFilter)
    }).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
  }, [active, search, locations, locationFilter, statusFilter, approvalFilter, areaFilter, categoryFilter])

  const reset = () => { setSearch(""); setLocationFilter("all"); setStatusFilter("all"); setApprovalFilter("all"); setAreaFilter("all"); setCategoryFilter("all"); setMoreOpen(false) }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Package className="h-4.5 w-4.5" /></div><div><h2 className="text-lg font-semibold">Supply Requests</h2><p className="text-sm text-muted-foreground">Request supplies and equipment, route approvals, and track ordering through receipt.</p></div></div><Button className="gap-2 sm:shrink-0" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />New Supply Request</Button></div>

    {!isDemoMode && supplyRequestsError && (
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{supplyRequestsError}</span>
        </div>
        <Button variant="outline" size="sm" className="border-red-200 bg-white text-red-700 hover:bg-red-50" onClick={() => void refreshSupplyRequests()}>
          Retry
        </Button>
      </div>
    )}

    <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-6">
      <SummaryCard label="Open Requests" value={active.filter((r) => !["Received", "Cancelled"].includes(r.fulfillmentStatus)).length} icon={Package} accent="bg-blue-50 text-blue-700" />
      <SummaryCard label="Awaiting Approval" value={active.filter((r) => r.approvalStatus === "Awaiting Approval").length} icon={AlertCircle} accent="bg-amber-50 text-amber-700" />
      <SummaryCard label="Approved" value={active.filter((r) => r.approvalStatus === "Approved").length} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-700" />
      <SummaryCard label="Ordered" value={active.filter((r) => r.fulfillmentStatus === "Ordered").length} icon={ShoppingCart} accent="bg-indigo-50 text-indigo-700" />
      <SummaryCard label="Received This Month" value={active.filter((r) => r.receivedAt?.startsWith(receivedMonth)).length} icon={PackageCheck} accent="bg-teal-50 text-teal-700" />
      <SummaryCard label="Estimated Spend" value={money.format(active.reduce((sum, r) => sum + r.estimatedTotal, 0))} icon={CircleDollarSign} accent="bg-violet-50 text-violet-700" />
    </div>

    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, location, vendor, or requester…" aria-label="Search supply requests" /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><select className={selectClass} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} aria-label="Filter by location"><option value="all">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><select className={selectClass} value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} aria-label="Filter by approval"><option value="all">All approvals</option>{approvals.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}><SlidersHorizontal className="h-3.5 w-3.5" />More filters{additionalFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">{additionalFilters}</span>}</Button>{filtersActive && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={reset}>Reset filters</Button>}</div>
        {moreOpen && <div className="mt-2 grid gap-2 rounded-lg border border-border bg-muted/25 p-3 sm:grid-cols-2"><select className={selectClass} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}><option value="all">All classrooms / areas</option>{SUPPLY_AREAS.map((value) => <option key={value}>{value}</option>)}</select><select className={selectClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{SUPPLY_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></div>}
      </div>
      <div className="flex items-center justify-between border-b border-border bg-muted/25 px-4 py-3"><p className="text-xs font-medium text-muted-foreground">{filtered.length} of {active.length} requests</p><div className="flex items-center gap-3">{!isDemoMode && supplyRequestsLoading && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Refreshing…</span>}<p className="hidden text-[11px] text-muted-foreground sm:block">Approval and fulfillment are tracked separately</p></div></div>
      {showInitialLoading ? <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><p className="text-sm">Loading supply requests…</p></div> : showInitialError ? <div className="py-14 text-center"><p className="text-sm font-medium text-foreground">Supply requests could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void refreshSupplyRequests()}>Retry</Button></div> : filtered.length === 0 ? <div className="py-14 text-center"><p className="text-sm font-medium">No matching requests</p><p className="mt-1 text-xs text-muted-foreground">Try clearing one or more filters.</p></div> : <>
        <div className="divide-y divide-border md:hidden">{filtered.map((request) => { const location = locations.find((item) => item.id === request.locationId); return <Link key={request.id} href={`/supply-requests/${request.id}`} className="interactive-row block p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold leading-snug">{request.title}</p><p className="mt-1 text-xs text-muted-foreground">{location?.name}{request.area ? ` · ${request.area}` : ""}</p></div><SupplyPriorityBadge priority={request.priority} /></div><div className="mt-3 flex flex-wrap gap-1.5"><SupplyApprovalBadge status={request.approvalStatus} /><SupplyStatusBadge status={request.fulfillmentStatus} /></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{request.quantity} item(s)</span><span className="font-semibold text-foreground">{money.format(request.estimatedTotal)}</span></div></Link> })}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1120px] text-sm"><thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 text-left">Request / Item</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Classroom / Area</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Requested By</th><th className="px-4 py-3 text-left">Quantity</th><th className="px-4 py-3 text-right">Estimated Cost</th><th className="px-4 py-3 text-left">Approval</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Last Updated</th><th className="w-10"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-border">{filtered.map((request) => { const location = locations.find((item) => item.id === request.locationId); return <tr key={request.id} onClick={() => router.push(`/supply-requests/${request.id}`)} className="group cursor-pointer hover:bg-muted/55"><td className="px-4 py-3.5"><Link href={`/supply-requests/${request.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[270px] truncate font-semibold">{request.title}</Link><div className="mt-1.5"><SupplyPriorityBadge priority={request.priority} /></div></td><td className="px-4 py-3.5 text-xs">{location?.name ?? "—"}</td><td className="px-4 py-3.5 text-xs">{request.area ?? "—"}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{request.category}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{request.submittedBy}</td><td className="px-4 py-3.5 text-xs">{request.quantity}</td><td className="px-4 py-3.5 text-right text-xs font-medium tabular-nums">{money.format(request.estimatedTotal)}</td><td className="px-4 py-3.5"><SupplyApprovalBadge status={request.approvalStatus} /></td><td className="px-4 py-3.5"><SupplyStatusBadge status={request.fulfillmentStatus} /></td><td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(request.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td className="px-2 py-3.5"><ChevronRight className="h-4 w-4 opacity-35 group-hover:translate-x-0.5 group-hover:opacity-80" /></td></tr> })}</tbody></table></div>
      </>}
    </div>
    <NewSupplyRequestModal open={modalOpen} onOpenChange={setModalOpen} />
  </div>
}
