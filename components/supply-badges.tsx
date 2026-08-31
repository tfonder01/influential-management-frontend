import type { SupplyApprovalStatus, SupplyPriority, SupplyStatus } from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { cn } from "@/lib/utils"

const base = "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4"

export function SupplyApprovalBadge({ status, className }: { status: SupplyApprovalStatus; className?: string }) {
  const styles: Record<SupplyApprovalStatus, string> = {
    "Not Required": "border-slate-200 bg-slate-50 text-slate-600",
    "Awaiting Approval": "border-amber-200 bg-amber-50 text-amber-700",
    Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Needs Information": "border-orange-200 bg-orange-50 text-orange-700",
    Declined: "border-rose-200 bg-rose-50 text-rose-700",
  }
  return <span className={cn(base, styles[status], className)}>{status}</span>
}

export function SupplyStatusBadge({ status, className }: { status: SupplyStatus; className?: string }) {
  const styles: Record<SupplyStatus, string> = {
    Submitted: "border-slate-200 bg-slate-50 text-slate-600",
    "Ready to Order": "border-blue-200 bg-blue-50 text-blue-700",
    Ordered: "border-indigo-200 bg-indigo-50 text-indigo-700",
    Received: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  }
  return <span className={cn(base, styles[status], className)}>{status}</span>
}

export function SupplyPriorityBadge({ priority, className }: { priority: SupplyPriority; className?: string }) {
  const styles: Record<SupplyPriority, string> = {
    Low: "border-slate-200 bg-transparent text-slate-500",
    Normal: "border-blue-200 bg-blue-50/60 text-blue-600",
    High: "border-amber-200 bg-amber-50 text-amber-700",
    Urgent: "border-rose-200 bg-rose-50 text-rose-700",
  }
  return <span className={cn(base, styles[priority], className)}>{priorityLabel(priority)}</span>
}
