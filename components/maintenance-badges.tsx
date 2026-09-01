import type {
  MaintenanceApprovalStatus,
  MaintenancePriority,
  MaintenanceStatus,
} from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { cn } from "@/lib/utils"

const base = "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors duration-200 motion-reduce:duration-0"

export function MaintenanceStatusBadge({ status, className }: { status: MaintenanceStatus; className?: string }) {
  const styles: Record<MaintenanceStatus, string> = {
    Submitted: "border-slate-200 bg-slate-50/80 text-slate-600",
    "Approved / Ready": "border-blue-200 bg-blue-50/80 text-blue-700",
    "In Progress": "border-indigo-200 bg-indigo-50/80 text-indigo-700",
    Waiting: "border-amber-200 bg-amber-50/80 text-amber-700",
    Completed: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    Cancelled: "border-rose-200/80 bg-rose-50/60 text-rose-700",
  }
  return <span className={cn(base, styles[status], className)}>{status}</span>
}

export function ApprovalStatusBadge({ status, className }: { status: MaintenanceApprovalStatus; className?: string }) {
  const styles: Record<MaintenanceApprovalStatus, string> = {
    "Not Required": "border-slate-200 bg-slate-50/70 text-slate-600",
    "Awaiting Approval": "border-amber-200 bg-amber-50/80 text-amber-700",
    Approved: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    "Needs Information": "border-orange-200 bg-orange-50/80 text-orange-700",
    Declined: "border-rose-200 bg-rose-50/80 text-rose-700",
  }
  return <span className={cn(base, styles[status], className)}>{status}</span>
}

export function PriorityBadge({ priority, className }: { priority: MaintenancePriority; className?: string }) {
  const styles: Record<MaintenancePriority, string> = {
    Low: "border-slate-200 bg-transparent text-slate-500",
    Medium: "border-blue-200/80 bg-blue-50/55 text-blue-600",
    High: "border-amber-200 bg-amber-50/70 text-amber-700",
    Urgent: "border-rose-200 bg-rose-50/75 text-rose-700",
  }
  return <span className={cn(base, styles[priority], className)}>{priorityLabel(priority)}</span>
}

export function RepeatIssueBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(base, "border-orange-200 bg-orange-50/45 text-orange-700", className)}
      title="Based on prior maintenance records for this item or area."
    >
      Potential repeat issue
    </span>
  )
}
