import type { ComplianceRecord, RecordWorkspace } from "./types"
import { getRecordWorkspace } from "./record-workspaces"

const PAGE_ROUTES = [
  { href: "/dashboard", title: "Dashboard" },
  { href: "/records", title: "Compliance", uploadWorkspace: "compliance" as const },
  { href: "/operations", title: "Operations", uploadWorkspace: "operations" as const },
  { href: "/maintenance", title: "Maintenance" },
  { href: "/supply-requests", title: "Supply Requests" },
  { href: "/locations", title: "Locations" },
  { href: "/needs-review", title: "Needs Review" },
  { href: "/activity", title: "Activity" },
  { href: "/archived", title: "Archived Records" },
  { href: "/admin/users", title: "Users" },
  { href: "/settings", title: "Settings" },
]

export interface AppNavigationContext {
  title: string
  activeHref?: string
  uploadWorkspace?: RecordWorkspace
}

export function resolveAppNavigation(pathname: string, records: ComplianceRecord[]): AppNavigationContext {
  const detailMatch = pathname.match(/^\/records\/([^/]+)\/?$/)
  if (detailMatch) {
    const recordId = decodeURIComponent(detailMatch[1])
    const record = records.find((item) => item.id === recordId)
    if (!record) return { title: "Record" }

    const workspace = getRecordWorkspace(record)
    return {
      title: workspace === "operations" ? "Operations" : "Compliance",
      activeHref: workspace === "operations" ? "/operations" : "/records",
      uploadWorkspace: workspace,
    }
  }

  const route = PAGE_ROUTES.find(({ href }) => pathname === href || pathname.startsWith(href + "/"))
  return route
    ? { title: route.title, activeHref: route.href, uploadWorkspace: route.uploadWorkspace }
    : { title: "Influential Management" }
}
