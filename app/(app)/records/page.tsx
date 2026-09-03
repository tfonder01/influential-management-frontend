"use client"

import { Suspense, useState, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, FileText, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { useApp } from "@/lib/store"
import { CLASSROOM_AGE_GROUPS, COMPLIANCE_CATEGORIES } from "@/lib/mock-data"
import { StatusBadge } from "@/components/status-badge"
import { CategoryBadge } from "@/components/category-badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RecordStatus } from "@/lib/types"
import { isComplianceRecord } from "@/lib/record-workspaces"

const STATUSES: RecordStatus[] = ["New", "Reviewed", "Needs Attention"]

type SortField = "title" | "location" | "category" | "uploadDate" | "status" | "lastUpdated"
type SortDir = "asc" | "desc"

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sortDir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-foreground" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-foreground" />
  )
}

function RecordsContent() {
  const { records, locations } = useApp()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState(searchParams.get("location") ?? "all")
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "all")
  const [classroomFilter, setClassroomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all")
  const [sortField, setSortField] = useState<SortField>("uploadDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const filtered = useMemo(() => {
    let result = records.filter(isComplianceRecord).filter((record) => record.status !== "Archived")
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.uploadedBy.toLowerCase().includes(q)
      )
    }
    if (locationFilter !== "all") result = result.filter((r) => r.locationId === locationFilter)
    if (categoryFilter !== "all") result = result.filter((r) => r.category === categoryFilter)
    if (classroomFilter !== "all") result = result.filter((r) => r.classroomAgeGroup === classroomFilter)
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter)

    return [...result].sort((a, b) => {
      let av = ""
      let bv = ""
      if (sortField === "title") { av = a.title; bv = b.title }
      else if (sortField === "location") {
        av = locations.find((l) => l.id === a.locationId)?.name ?? ""
        bv = locations.find((l) => l.id === b.locationId)?.name ?? ""
      }
      else if (sortField === "category") { av = a.category; bv = b.category }
      else if (sortField === "uploadDate") { av = a.uploadDate; bv = b.uploadDate }
      else if (sortField === "status") { av = a.status; bv = b.status }
      else if (sortField === "lastUpdated") { av = a.lastUpdated; bv = b.lastUpdated }
      const cmp = av.localeCompare(bv)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [records, locations, search, locationFilter, categoryFilter, classroomFilter, statusFilter, sortField, sortDir])

  const ThCell = ({
    field,
    children,
    className = "",
  }: {
    field: SortField
    children: React.ReactNode
    className?: string
  }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </div>
    </th>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Monthly classroom observation cadence</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Approximately 11 observation uploads are expected each month across locations and age groups.</p>
        </div>
        <button
          type="button"
          onClick={() => setCategoryFilter("Classroom Observations")}
          className="w-fit rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          View observations
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[180px]">
            <SelectValue>
              {locationFilter === "all"
                ? "All Locations"
                : locations.find((l) => l.id === locationFilter)?.name ?? "All Locations"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[190px]">
            <SelectValue>
              {categoryFilter === "all" ? "All Categories" : categoryFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {COMPLIANCE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={classroomFilter} onValueChange={(value) => setClassroomFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[180px]">
            <SelectValue>
              {classroomFilter === "all" ? "All Classrooms" : classroomFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classrooms</SelectItem>
            {CLASSROOM_AGE_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[160px]">
            <SelectValue>
              {statusFilter === "all" ? "All Statuses" : statusFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <ThCell field="title" className="w-[42%] min-w-[280px]">Record Title</ThCell>
                <ThCell field="location">Location</ThCell>
                <ThCell field="category" className="hidden lg:table-cell">Category</ThCell>
                <ThCell field="uploadDate" className="hidden md:table-cell">Uploaded</ThCell>
                <ThCell field="status">Status</ThCell>
                <ThCell field="lastUpdated" className="hidden xl:table-cell">Last Updated</ThCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const location = locations.find((l) => l.id === rec.locationId)
                  return (
                    <tr
                      key={rec.id}
                      className="group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-within:bg-muted/50"
                    >
                      <td className="px-4 py-3.5">
                        <Link href={`/records/${rec.id}`} className="flex min-w-0 items-start gap-3" aria-label={`Open ${rec.title}`}>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="line-clamp-2 max-w-[460px] whitespace-normal break-words font-medium leading-5 text-foreground group-hover:text-primary"
                              title={rec.title}
                            >
                              {rec.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{rec.uploadedBy}</p>
                            {rec.classroomAgeGroup && (
                              <p className="mt-0.5 text-[11px] font-medium text-emerald-700">{rec.classroomAgeGroup} classroom</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/records/${rec.id}`}>
                          <p className="text-xs text-foreground">{location?.name ?? "—"}</p>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        <Link href={`/records/${rec.id}`}>
                          <CategoryBadge category={rec.category} />
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-xs text-muted-foreground md:table-cell">
                        <Link href={`/records/${rec.id}`}>
                          {new Date(rec.uploadDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/records/${rec.id}`}>
                          <StatusBadge status={rec.status} />
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 text-xs text-muted-foreground xl:table-cell">
                        <Link href={`/records/${rec.id}`}>
                          {new Date(rec.lastUpdated).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function RecordsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-label="Loading records">
          <div className="h-9 w-full max-w-xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="h-96 animate-pulse rounded-xl border border-border bg-card motion-reduce:animate-none" />
        </div>
      }
    >
      <RecordsContent />
    </Suspense>
  )
}
