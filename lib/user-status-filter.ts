import type { AdminUserStatus } from "./user-admin-api"
export const USER_STATUS_FILTERS = [
  { value: "current", label: "Active & Invited", statuses: ["ACTIVE", "INVITED"] },
  { value: "all", label: "All Users", statuses: [] },
  { value: "active", label: "Active", statuses: ["ACTIVE"] },
  { value: "invited", label: "Invited", statuses: ["INVITED"] },
  { value: "disabled", label: "Disabled", statuses: ["DISABLED"] },
] as const satisfies readonly { value: string; label: string; statuses: readonly AdminUserStatus[] }[]
export type UserStatusFilter = typeof USER_STATUS_FILTERS[number]["value"]
export function statusesForFilter(filter: UserStatusFilter): readonly AdminUserStatus[] {
  return USER_STATUS_FILTERS.find((option) => option.value === filter)!.statuses
}
export function matchesUserStatus(status: AdminUserStatus, filter: UserStatusFilter) {
  const statuses = statusesForFilter(filter)
  return statuses.length === 0 || statuses.includes(status)
}
export function userStatusEmptyMessage(filter: UserStatusFilter) {
  return { current: "No active or invited users found", all: "No users found", active: "No active users found",
    invited: "No invited users found", disabled: "No disabled users found" }[filter]
}
