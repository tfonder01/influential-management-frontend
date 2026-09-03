"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckSquare2, ChevronDown, ChevronsUpDown, ChevronUp, FileText, Search } from "lucide-react"
import { useApp } from "@/lib/store"
import { CLASSROOM_AGE_GROUPS, OPERATIONS_RECORD_TYPES } from "@/lib/mock-data"
import { isOperationsRecord } from "@/lib/record-workspaces"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { RecordStatus } from "@/lib/types"

const STATUSES: RecordStatus[] = ["New", "Reviewed", "Needs Attention"]

type SortField = "title" | "location" | "recordType" | "uploadDate" | "status" | "lastUpdated"
type SortDir = "asc" | "desc"

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-foreground" />
    : <ChevronDown className="h-3.5 w-3.5 text-foreground" />
}

export default function OperationsPage() {
  const { records, locations } = useApp()
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [classroomFilter, setClassroomFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>("uploadDate")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((current) => current === "asc" ? "desc" : "asc")
    else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const operationsRecords = useMemo(() => {
    let result = records.filter(isOperationsRecord).filter((record) => record.status !== "Archived")
    if (search) {
      const query = search.toLowerCase()
      result = result.filter((record) =>
        record.title.toLowerCase().includes(query) ||
        record.recordType?.toLowerCase().includes(query) ||
        record.area?.toLowerCase().includes(query) ||
        record.uploadedBy.toLowerCase().includes(query)
      )
    }
    if (locationFilter !== "all") result = result.filter((record) => record.locationId === locationFilter)
    if (typeFilter !== "all") result = result.filter((record) => record.recordType === typeFilter)
    if (classroomFilter !== "all") result = result.filter((record) => record.classroomAgeGroup === classroomFilter)
    if (statusFilter !== "all") result = result.filter((record) => record.status === statusFilter)

    return [...result].sort((a, b) => {
      let first = ""
      let second = ""
      if (sortField === "title") { first = a.title; second = b.title }
      else if (sortField === "location") {
        first = locations.find((location) => location.id === a.locationId)?.name ?? ""
        second = locations.find((location) => location.id === b.locationId)?.name ?? ""
      }
      else if (sortField === "recordType") { first = a.recordType ?? ""; second = b.recordType ?? "" }
      else if (sortField === "uploadDate") { first = a.uploadDate; second = b.uploadDate }
      else if (sortField === "status") { first = a.status; second = b.status }
      else if (sortField === "lastUpdated") { first = a.lastUpdated; second = b.lastUpdated }
      const comparison = first.localeCompare(second)
      return sortDir === "asc" ? comparison : -comparison
    })
  }, [records, locations, search, locationFilter, typeFilter, classroomFilter, statusFilter, sortField, sortDir])

  const HeaderCell = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">{children}<SortIcon field={field} sortField={sortField} sortDir={sortDir} /></span>
    </th>
  )

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-blue-200/70 bg-blue-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <CheckSquare2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Recurring operational records</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Opening, closing, playground, and location-specific operational documentation.</p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700">
          Shared review &amp; archive workflow
        </span>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search operations..." className="h-9 pl-9 text-sm" />
        </div>

        <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[180px]">
            <SelectValue>{locationFilter === "all" ? "All Locations" : locations.find((location) => location.id === locationFilter)?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[190px]">
            <SelectValue>{typeFilter === "all" ? "All Record Types" : typeFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Record Types</SelectItem>
            {OPERATIONS_RECORD_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={classroomFilter} onValueChange={(value) => setClassroomFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[180px]">
            <SelectValue>{classroomFilter === "all" ? "All Classrooms" : classroomFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classrooms</SelectItem>
            {CLASSROOM_AGE_GROUPS.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-9 w-full text-sm sm:w-[160px]">
            <SelectValue>{statusFilter === "all" ? "All Statuses" : statusFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">{operationsRecords.length} record{operationsRecords.length === 1 ? "" : "s"}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <HeaderCell field="title" className="w-[34%] min-w-[280px]">Record Title</HeaderCell>
                <HeaderCell field="location">Location</HeaderCell>
                <HeaderCell field="recordType" className="hidden lg:table-cell">Record Type</HeaderCell>
                <th className="hidden min-w-[160px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">Classroom / Area</th>
                <HeaderCell field="uploadDate" className="hidden md:table-cell">Uploaded</HeaderCell>
                <HeaderCell field="status">Status</HeaderCell>
                <HeaderCell field="lastUpdated" className="hidden xl:table-cell">Last Updated</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operationsRecords.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No Operations records match your filters.</td></tr>
              ) : operationsRecords.map((record) => {
                const location = locations.find((item) => item.id === record.locationId)
                const context = [record.classroomAgeGroup ? `${record.classroomAgeGroup} Classroom` : "", record.area ?? ""].filter(Boolean).join(" · ") || "Whole location"
                return (
                  <tr key={record.id} className="group transition-colors duration-150 hover:bg-muted/50 focus-within:bg-muted/50">
                    <td className="px-4 py-3.5">
                      <Link href={`/records/${record.id}`} className="flex min-w-0 items-start gap-3" aria-label={`Open ${record.title}`}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50">
                          <FileText className="h-3.5 w-3.5 text-blue-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 max-w-[460px] whitespace-normal break-words font-medium leading-5 text-foreground group-hover:text-primary" title={record.title}>{record.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{record.uploadedBy}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-foreground">{location?.name ?? "—"}</td>
                    <td className="hidden px-4 py-3.5 lg:table-cell">
                      <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{record.recordType ?? "Operations Record"}</span>
                    </td>
                    <td className="hidden px-4 py-3.5 text-xs text-muted-foreground md:table-cell">{context}</td>
                    <td className="hidden px-4 py-3.5 text-xs text-muted-foreground md:table-cell">{new Date(record.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                    <td className="hidden px-4 py-3.5 text-xs text-muted-foreground xl:table-cell">{new Date(record.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
