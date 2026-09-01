import type { SupplyApprovalStatus, SupplyPriority, SupplyStatus } from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { cn } from "@/lib/utils"
const base = "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4"
const APPROVAL_STYLES: Record<SupplyApprovalStatus, string> = {
  "Not Required": "border-slate-200 bg-slate-50 text-slate-600",
  "Awaiting Approval": "border-amber-200 bg-amber-50 text-amber-700",
  "Needs Information": "border-orange-200 bg-orange-50 text-orange-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Declined: "border-rose-200 bg-rose-50 text-rose-700",
}
const STATUS_STYLES: Record<SupplyStatus, string> = {
  Submitted: "border-slate-200 bg-slate-50 text-slate-600",
  "Approved / Ready": "border-blue-200 bg-blue-50 text-blue-700",
  Ordered: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Waiting / In Transit": "border-cyan-200 bg-cyan-50 text-cyan-700",
  Received: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelled: "border-rose-200 bg-rose-50 text-rose-700",
}
const PRIORITY_STYLES: Record<SupplyPriority, string> = {
  Low: "border-slate-200 bg-transparent text-slate-500",
  Medium: "border-blue-200 bg-blue-50/60 text-blue-600",
  High: "border-amber-200 bg-amber-50 text-amber-700",
  Urgent: "border-rose-200 bg-rose-50 text-rose-700",
}
export function SupplyApprovalBadge({ status, className }: { status: SupplyApprovalStatus; className?: string }) { return <span className={cn(base, APPROVAL_STYLES[status], className)}>{status}</span> }
export function SupplyStatusBadge({ status, className }: { status: SupplyStatus; className?: string }) { return <span className={cn(base, STATUS_STYLES[status], className)}>{status}</span> }
export function SupplyPriorityBadge({ priority, className }: { priority: SupplyPriority; className?: string }) { return <span className={cn(base, PRIORITY_STYLES[priority], className)}>{priorityLabel(priority)}</span> }
