"use client"

import { use, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquareMore,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Wrench,
  XCircle,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { MAINTENANCE_VENDORS, MAINTENANCE_CATEGORIES } from "@/lib/mock-data"
import type { Comment, MaintenanceAttachment, MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApprovalStatusBadge, MaintenanceStatusBadge, PriorityBadge, RepeatIssueBadge } from "@/components/maintenance-badges"
import { FilePreviewModal } from "@/components/file-preview-modal"
import { cn } from "@/lib/utils"
import { hasPotentialRepeatHistory } from "@/lib/maintenance-history"
import { maintenanceDisplayId } from "@/lib/maintenance-display"
import { roleLabel } from "@/lib/role-labels"
import {
  getMaintenanceDetail,
  isApiClientError,
  type ApiMaintenanceAttachmentType,
  downloadFileApi,
  uploadFileApi,
  viewFileApi,
} from "@/lib/maintenance-api"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
const timelineIcons: Record<string, React.ElementType> = {
  created: Wrench,
  edited: Building2,
  status_changed: CheckCircle2,
  comment_added: MessageSquareMore,
  file_uploaded: Upload,
  archived: Archive,
  restored: RotateCcw,
}
const ATTACHMENT_TYPES: Record<"originalPhotos" | "completionPhotos" | "invoices", ApiMaintenanceAttachmentType> = {
  originalPhotos: "ISSUE_PHOTO",
  completionPhotos: "COMPLETION_PHOTO",
  invoices: "INVOICE",
}

function Meta({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return <div><dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</dt><dd className="mt-1 text-sm text-foreground">{children}</dd></div>
}

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    maintenanceRequests,
    maintenanceRequestsLoading,
    locations,
    comments,
    activity,
    currentUser,
    role,
    updateMaintenanceRequest,
    archiveMaintenanceRequest,
    restoreMaintenanceRequest,
    addMaintenanceFile,
    addComment,
    addMaintenanceComment,
    showToast,
    isDemoMode,
    upsertMaintenanceRequest,
    loadMaintenanceComments,
    updateProductionMaintenanceRequest,
    changeProductionMaintenanceStatus,
    approveProductionMaintenanceRequest,
    declineProductionMaintenanceRequest,
    requestMaintenanceInfoProduction,
    resubmitProductionMaintenanceApproval,
    reopenProductionMaintenanceApproval,
    addProductionMaintenanceAttachment,
    removeProductionMaintenanceAttachment,
    replaceProductionMaintenanceAttachment,
    renameProductionMaintenanceAttachment,
  } = useApp()
  const router = useRouter()
  const request = maintenanceRequests.find((item) => item.id === id)
  const [commentText, setCommentText] = useState("")
  const [detailLoading, setDetailLoading] = useState(!isDemoMode)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<{ fileId: string; name: string } | null>(null)
  const [attachmentAction, setAttachmentAction] = useState<string | null>(null)
  const [fileActionKey, setFileActionKey] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState("")
  const [renameTarget, setRenameTarget] = useState<MaintenanceAttachment | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const [replaceContext, setReplaceContext] = useState<{ attachment: MaintenanceAttachment; field: "originalPhotos" | "completionPhotos" | "invoices"; accept: string } | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [approvalAction, setApprovalAction] = useState<string | null>(null)
  const [infoNoteOpen, setInfoNoteOpen] = useState(false)
  const [infoNoteValue, setInfoNoteValue] = useState("")
  const [statusAction, setStatusAction] = useState<string | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [vendor, setVendor] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [vendorContact, setVendorContact] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [finalCost, setFinalCost] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editArea, setEditArea] = useState("")
  const [editCategory, setEditCategory] = useState<MaintenanceCategory | "">("")
  const [editPriority, setEditPriority] = useState<MaintenancePriority>("Normal")
  const [editEstimatedCost, setEditEstimatedCost] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  useEffect(() => {
    if (!request) return
    setVendor(request.vendor ?? "")
    setAssignedTo(request.assignedTo ?? "")
    setVendorContact(request.vendorContact ?? "")
    setScheduledDate(request.scheduledDate ?? "")
    setEstimatedCost(request.estimatedCost?.toString() ?? "")
    setFinalCost(request.finalCost?.toString() ?? "")
  }, [request])

  useEffect(() => {
    if (isDemoMode) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    getMaintenanceDetail(id)
      .then((detail) => {
        if (!cancelled) upsertMaintenanceRequest(detail.request)
      })
      .catch((error) => {
        if (cancelled) return
        setDetailError(isApiClientError(error) ? error.message : "This maintenance request could not be loaded.")
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    void loadMaintenanceComments(id)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDemoMode])

  if (!isDemoMode && (detailLoading || (maintenanceRequestsLoading && !request))) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Loading maintenance request…</p>
      </div>
    )
  }

  if (!request || detailError) {
    return <div className="flex flex-col items-center gap-4 py-16"><p className="text-sm text-muted-foreground">{detailError ?? "Maintenance request not found or unavailable for this role."}</p><Button render={<Link href="/maintenance" />} nativeButton={false} variant="outline">Back to Maintenance</Button></div>
  }

  const location = locations.find((item) => item.id === request.locationId)
  const requestComments = comments.filter((comment) => comment.recordId === id).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const requestActivity = activity.filter((event) => event.recordId === id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const canEdit = !request.archived
  const canManageAttachments = !isDemoMode && canEdit
  const canChangeProgress = canEdit
    && request.approvalStatus !== "Awaiting Approval"
    && request.approvalStatus !== "Needs Information"
    && request.approvalStatus !== "Declined"
  const canReopenApprovalReview = request.maintenanceStatus === "Submitted" || request.maintenanceStatus === "Approved / Ready"
  const potentialRepeatIssue = hasPotentialRepeatHistory(request)
  const progressSteps = ["Submitted", "Approved / Ready", "In Progress", "Completed"] as const
  const progressStopped = request.approvalStatus === "Declined" || request.maintenanceStatus === "Cancelled"
  const progressIndex = request.approvalStatus === "Awaiting Approval" || request.approvalStatus === "Needs Information" || request.approvalStatus === "Declined"
    ? 0
    : request.maintenanceStatus === "Completed"
      ? 3
      : request.maintenanceStatus === "In Progress" || request.maintenanceStatus === "Waiting"
        ? 2
        : request.maintenanceStatus === "Approved / Ready"
          ? 1
          : request.maintenanceStatus === "Cancelled" && request.approvalStatus === "Approved"
            ? 1
            : 0
  // Approval state and repair progress are separate backend concepts, but the header shows only
  // one primary workflow pill at a time: the approval decision takes visual priority while it is
  // pending/blocking (Awaiting Approval / Needs Information / Declined); once approval is settled
  // (Approved or Not Required) the header instead shows repair progress.
  const showsApprovalAsPrimaryState = request.approvalStatus === "Awaiting Approval"
    || request.approvalStatus === "Needs Information"
    || request.approvalStatus === "Declined"

  const updateStatus = async (status: MaintenanceStatus) => {
    if (statusAction || approvalAction) return
    if (isDemoMode) {
      updateMaintenanceRequest(id, {
        maintenanceStatus: status,
        completedAt: status === "Completed" ? new Date().toISOString() : request.completedAt,
      }, `Maintenance status changed to ${status}.`)
      return
    }
    if (status !== "In Progress" && status !== "Waiting" && status !== "Completed" && status !== "Cancelled") return
    setStatusAction(status)
    try {
      await changeProductionMaintenanceStatus(id, status)
    } catch {
      // Toast handled in the store action.
    } finally {
      setStatusAction(null)
    }
  }

  const addRequestComment = async () => {
    if (!commentText.trim() || commentSubmitting) return
    const comment: Comment = {
      id: `mcmt_${Date.now()}`,
      recordId: id,
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      isUnread: false,
    }
    if (isDemoMode) {
      addComment(comment)
      setCommentText("")
      return
    }
    setCommentSubmitting(true)
    try {
      await addMaintenanceComment(comment)
      setCommentText("")
    } catch {
      // Toast handled in the store action.
    } finally {
      setCommentSubmitting(false)
    }
  }

  const openEditDialog = () => {
    if (!canEdit) return
    setEditTitle(request.title)
    setEditDescription(request.description ?? "")
    setEditArea(request.area ?? "")
    setEditCategory(request.category)
    setEditPriority(request.priority)
    setEditEstimatedCost(request.estimatedCost?.toString() ?? "")
    setEditError("")
    setEditOpen(true)
  }

  const saveRequestDetails = async () => {
    if (editSaving) return
    if (!editTitle.trim() || !editCategory) {
      setEditError("Title and category are required.")
      return
    }
    setEditSaving(true)
    setEditError("")
    if (isDemoMode) {
      updateMaintenanceRequest(id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        area: editArea.trim() || undefined,
        category: editCategory as MaintenanceCategory,
        priority: editPriority,
        estimatedCost: editEstimatedCost ? Number(editEstimatedCost) : undefined,
      }, "Request details updated.")
      setEditSaving(false)
      setEditOpen(false)
      return
    }
    try {
      await updateProductionMaintenanceRequest(id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory,
        priority: editPriority,
        classroomAgeGroup: request.classroomAgeGroup,
        area: editArea.trim() || undefined,
        assignedTo: assignedTo || undefined,
        vendorName: vendor || undefined,
        vendorContact: vendorContact || undefined,
        scheduledDate: scheduledDate || undefined,
        estimatedCost: editEstimatedCost ? Number(editEstimatedCost) : undefined,
        finalCost: finalCost ? Number(finalCost) : undefined,
      })
      setEditOpen(false)
    } catch (error) {
      setEditError(isApiClientError(error) ? error.message : "Failed to update request details. Please try again.")
    } finally {
      setEditSaving(false)
    }
  }

  const saveRepairDetails = async () => {
    if (savingDetails) return
    if (isDemoMode) {
      updateMaintenanceRequest(id, {
        vendor: vendor || undefined,
        assignedTo: assignedTo || undefined,
        vendorContact: vendorContact || undefined,
        scheduledDate: scheduledDate || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        finalCost: finalCost ? Number(finalCost) : undefined,
      }, "Vendor, assignment, and cost details updated.")
      return
    }
    setSavingDetails(true)
    try {
      await updateProductionMaintenanceRequest(id, {
        title: request.title,
        description: request.description || undefined,
        category: request.category,
        priority: request.priority,
        classroomAgeGroup: request.classroomAgeGroup,
        area: request.area || undefined,
        assignedTo: assignedTo || undefined,
        vendorName: vendor || undefined,
        vendorContact: vendorContact || undefined,
        scheduledDate: scheduledDate || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        finalCost: finalCost ? Number(finalCost) : undefined,
      })
    } catch {
      // Toast handled in the store action.
    } finally {
      setSavingDetails(false)
    }
  }

  const fileHandler = (field: "originalPhotos" | "completionPhotos" | "invoices") => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || attachmentAction) return
    if (isDemoMode) {
      addMaintenanceFile(id, field, file.name)
      return
    }
    setAttachmentAction(field)
    setAttachmentError("")
    try {
      const uploaded = await uploadFileApi(file, request.locationId)
      await addProductionMaintenanceAttachment(id, uploaded.id, ATTACHMENT_TYPES[field])
    } catch (error) {
      setAttachmentError(isApiClientError(error) ? error.message : "Attachment upload failed. Please try again.")
    } finally {
      setAttachmentAction(null)
    }
  }

  const runApprovalAction = async (key: string, action: () => Promise<void>) => {
    if (approvalAction) return
    setApprovalAction(key)
    try {
      await action()
    } catch {
      // Toast handled in the store action.
    } finally {
      setApprovalAction(null)
    }
  }

  const submitInfoRequest = async () => {
    const note = infoNoteValue.trim()
    if (!note || approvalAction) return
    if (isDemoMode) {
      updateMaintenanceRequest(id, { approvalStatus: "Needs Information", needsMoreInfo: true, approvalNote: note }, "Owner requested more information.")
      setInfoNoteOpen(false)
      setInfoNoteValue("")
      return
    }
    await runApprovalAction("more-info", () => requestMaintenanceInfoProduction(id, note).then(() => undefined))
    setInfoNoteOpen(false)
    setInfoNoteValue("")
  }

  const handleAttachmentClick = (attachment: MaintenanceAttachment) => {
    if (!attachment.fileId) {
      showToast(`Attachment ready: ${attachment.name}`)
      return
    }
    setPreviewFile({ fileId: attachment.fileId, name: attachment.displayName ?? attachment.name })
  }

  const handleOpenInNewTab = async (attachment: MaintenanceAttachment) => {
    if (!attachment.fileId) {
      showToast("Preview is not available for this file.")
      return
    }
    try {
      const { url } = await viewFileApi(attachment.fileId)
      window.open(url, "_blank", "noopener")
    } catch (error) {
      showToast(isApiClientError(error) ? error.message : "Unable to open file. Please try again.")
    }
  }

  const handleDownloadAttachment = async (attachment: MaintenanceAttachment) => {
    if (!attachment.fileId) {
      showToast(`Download ready: ${attachment.name}`)
      return
    }
    try {
      await downloadFileApi(attachment.fileId, attachment.displayName ?? attachment.name)
    } catch (error) {
      showToast(isApiClientError(error) ? error.message : "Download failed. Please try again.")
    }
  }

  const handleRemoveAttachment = async (attachment: MaintenanceAttachment) => {
    if (!attachment.fileId || fileActionKey) return
    if (!window.confirm(`Remove ${attachment.displayName ?? attachment.name} from this request?`)) return
    setFileActionKey(`remove:${attachment.fileId}`)
    try {
      await removeProductionMaintenanceAttachment(id, attachment.fileId)
    } catch {
      // Toast handled in the store action.
    } finally {
      setFileActionKey(null)
    }
  }

  const handleReplaceAttachment = async (
    attachment: MaintenanceAttachment,
    field: "originalPhotos" | "completionPhotos" | "invoices",
    file: File
  ) => {
    if (!attachment.fileId || fileActionKey || !request) return
    setFileActionKey(`replace:${attachment.fileId}`)
    try {
      const uploaded = await uploadFileApi(file, request.locationId)
      await replaceProductionMaintenanceAttachment(id, attachment.fileId, uploaded.id, ATTACHMENT_TYPES[field])
    } catch {
      // Toast handled in the store action.
    } finally {
      setFileActionKey(null)
    }
  }

  const openRenameDialog = (attachment: MaintenanceAttachment) => {
    setRenameTarget(attachment)
    setRenameValue(attachment.displayName ?? attachment.name)
  }

  const triggerReplace = (attachment: MaintenanceAttachment, field: "originalPhotos" | "completionPhotos" | "invoices", accept: string) => {
    setReplaceContext({ attachment, field, accept })
    // The input's accept attribute is applied on the next render; defer the click one tick.
    requestAnimationFrame(() => replaceInputRef.current?.click())
  }

  const handleReplaceInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file && replaceContext) void handleReplaceAttachment(replaceContext.attachment, replaceContext.field, file)
  }

  const submitRename = async () => {
    if (!renameTarget?.fileId || renameSubmitting) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    setRenameSubmitting(true)
    try {
      await renameProductionMaintenanceAttachment(id, renameTarget.fileId, trimmed)
      setRenameTarget(null)
    } catch {
      // Toast handled in the store action.
    } finally {
      setRenameSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/maintenance" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" />Back to Maintenance</Link>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Maintenance request</span>{potentialRepeatIssue ? <RepeatIssueBadge /> : null}</div>
              <h1 className="mt-2 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{request.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Request {maintenanceDisplayId(request)} · Last updated {new Date(request.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={request.priority} />
              {showsApprovalAsPrimaryState ? <ApprovalStatusBadge status={request.approvalStatus} /> : <MaintenanceStatusBadge status={request.maintenanceStatus} />}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-muted/15 px-4 py-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Maintenance progress</p>
          </div>
          <ol className="grid grid-cols-4" aria-label={`Maintenance progress: ${request.maintenanceStatus}`}>
            {progressSteps.map((step, index) => {
              const completed = index < progressIndex
              const current = index === progressIndex
              const finished = request.maintenanceStatus === "Completed" && index === progressSteps.length - 1
              return (
                <li key={step} className="relative flex min-w-0 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                  {index < progressSteps.length - 1 && (
                    <span
                      className={cn(
                        "absolute left-[calc(50%+0.875rem)] top-[13px] h-0.5 w-[calc(100%-1.75rem)] transition-colors duration-200 motion-reduce:duration-0",
                        index < progressIndex ? (progressStopped ? "bg-slate-300" : "bg-emerald-500") : "bg-slate-200"
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-[background-color,border-color,color] duration-200 motion-reduce:duration-0",
                      completed && !progressStopped && "border-emerald-600 bg-emerald-600 text-white",
                      completed && progressStopped && "border-slate-300 bg-slate-100 text-slate-600",
                      current && !progressStopped && !finished && "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100",
                      current && finished && "border-emerald-600 bg-emerald-600 text-white ring-4 ring-emerald-100",
                      current && progressStopped && "border-rose-300 bg-rose-50 text-rose-700 ring-4 ring-rose-100/70",
                      !completed && !current && "border-slate-200 bg-card text-slate-400"
                    )}
                  >
                    {completed || finished ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn("mt-2 max-w-24 text-[10px] font-medium leading-tight sm:text-xs", current ? "text-foreground" : completed ? "text-slate-700" : "text-muted-foreground")}>{step}</span>
                  <span className="sr-only">{completed ? "Completed" : current ? "Current step" : "Not started"}</span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {potentialRepeatIssue && (
        <section className="rounded-xl border border-orange-200 bg-orange-50/45 p-4 shadow-sm">
          <div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700"><AlertTriangle className="h-4.5 w-4.5" /></div><div><p className="text-sm font-semibold text-foreground">Potential repeat issue · {request.assetName}</p><p className="mt-1 text-sm text-muted-foreground">{request.repeatRepairCount} repairs recorded in the last {request.repeatRepairPeriodMonths} months · <span className="font-semibold text-foreground">{money.format(request.repeatRecordedCost ?? 0)}</span> total recorded repair cost</p><p className="mt-1 text-xs text-muted-foreground">Based on prior maintenance records for this item and area.</p></div></div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="contents lg:col-span-2 lg:block lg:space-y-5">
          <section className="order-1 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Request details</h2>
              {canEdit && <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
              <Meta icon={MapPin} label="Location">{location?.name ?? "—"}</Meta>
              <Meta icon={Building2} label="Classroom / Area">{request.area}</Meta>
              <Meta icon={Wrench} label="Category">{request.category}</Meta>
              <Meta icon={User} label="Submitted by">{request.submittedBy}</Meta>
              <Meta icon={CalendarDays} label="Submitted">{new Date(request.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Meta>
              <Meta icon={ShieldCheck} label="Approval"><ApprovalStatusBadge status={request.approvalStatus} /></Meta>
            </dl>
            <div className="mt-5 rounded-lg bg-muted/40 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1.5 text-sm leading-relaxed text-foreground">{request.description}</p></div>
          </section>

          <section className="order-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Photos and invoices</h2><p className="mt-0.5 text-xs text-muted-foreground">{isDemoMode ? "Prototype attachments preserve filenames and upload history." : "Authorized uploads are attached directly to this maintenance request."}</p></div></div>
            {attachmentError && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2.5 text-sm text-red-700">{attachmentError}</div>}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { title: "Original photos", field: "originalPhotos" as const, items: request.originalPhotos, icon: Camera, accept: "image/*" },
                { title: "Completion photos", field: "completionPhotos" as const, items: request.completionPhotos, icon: ImageIcon, accept: "image/*" },
                { title: "Invoices", field: "invoices" as const, items: request.invoices, icon: FileText, accept: ".pdf,image/*" },
              ].map(({ title, field, items, icon: Icon, accept }) => (
                <div key={field} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-semibold text-foreground">{title}</p><span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span></div>
                  <div className="mt-3 space-y-1.5">
                    {items.map((item) => {
                      const key = `${item.fileId ?? item.name}-${item.uploadedAt}`
                      const label = item.displayName ?? item.name
                      const busy = item.fileId ? fileActionKey === `remove:${item.fileId}` || fileActionKey === `replace:${item.fileId}` : false
                      return (
                        <div key={key} className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1">
                          <button type="button" onClick={() => handleAttachmentClick(item)} className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-xs text-foreground transition-colors hover:text-primary" title={label}>{label}</button>
                          <button type="button" onClick={() => void handleDownloadAttachment(item)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Download ${label}`} title="Download"><Download className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => void handleOpenInNewTab(item)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${label} in new tab`} title="Open in new tab"><ExternalLink className="h-3.5 w-3.5" /></button>
                          {canManageAttachments && item.fileId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<button type="button" disabled={busy} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" aria-label={`More actions for ${label}`} title="More actions" />}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openRenameDialog(item)}><Pencil className="h-3.5 w-3.5" />Rename</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => triggerReplace(item, field, accept)}><RefreshCw className="h-3.5 w-3.5" />Replace</DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => void handleRemoveAttachment(item)}><Trash2 className="h-3.5 w-3.5" />Remove</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                    {items.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">None attached</p>}
                  </div>
                  {canEdit && <label className={cn("mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5", attachmentAction && "pointer-events-none opacity-60")}><Upload className={cn("h-3.5 w-3.5", attachmentAction === field && "animate-pulse")} />Upload<input type="file" className="sr-only" accept={accept} disabled={Boolean(attachmentAction)} onChange={(event) => { void fileHandler(field)(event) }} /></label>}
                </div>
              ))}
            </div>
            <input ref={replaceInputRef} type="file" className="sr-only" accept={replaceContext?.accept} onChange={handleReplaceInputChange} />
          </section>

          <section className="order-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Comments and notes <span className="font-normal text-muted-foreground">({requestComments.length})</span></h2>
            <div className="mt-4 space-y-4">{requestComments.map((comment) => <div key={comment.id} className="flex gap-3"><div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", comment.role === "owner" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700")}>{comment.user.split(" ").map((part) => part[0]).join("")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="text-sm font-medium text-foreground">{comment.user}</span><span className="text-[10px] text-muted-foreground">{roleLabel(comment.role)}</span><span className="ml-auto text-[10px] text-muted-foreground">{new Date(comment.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div><p className="mt-1 rounded-lg bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground">{comment.text}</p></div></div>)}{requestComments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}</div>
            {canEdit && <div className="mt-4 flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{currentUser.initials}</div><div className="flex-1"><Textarea rows={3} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a progress update, question, or note…" disabled={commentSubmitting} /><Button size="sm" className="mt-2 gap-1.5" onClick={() => void addRequestComment()} disabled={!commentText.trim() || commentSubmitting}>{commentSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Add comment</Button></div></div>}
          </section>
        </div>

        <aside className="contents lg:block lg:space-y-5">
          <div className="order-2 space-y-3 lg:order-2">
            <div className="flex items-center gap-2 px-1"><Wrench className="h-3.5 w-3.5 text-muted-foreground" /><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work Details</h2></div>
          {!request.archived && (role === "owner" || request.approvalStatus === "Needs Information" || request.approvalStatus === "Declined") && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-foreground">Owner approval</h2>
              <p className="mt-1 text-xs text-muted-foreground">Approval is separate from repair progress.</p>
              <div className="mt-3 space-y-2">
                {request.approvalStatus === "Awaiting Approval" && role === "owner" && (
                  <>
                    <Button className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-600/90" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateMaintenanceRequest(id, { approvalStatus: "Approved", maintenanceStatus: request.maintenanceStatus === "Submitted" ? "Approved / Ready" : request.maintenanceStatus, needsMoreInfo: false, approvalNote: "Approved by Owner." }, "Owner approved the maintenance request.")) : runApprovalAction("approve", () => approveProductionMaintenanceRequest(id, "Approved by Owner.").then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve</Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-amber-700" size="sm" onClick={() => setInfoNoteOpen(true)} disabled={Boolean(approvalAction)}><MessageSquareMore className="h-4 w-4" />Request more information</Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-rose-700" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateMaintenanceRequest(id, { approvalStatus: "Declined", approvalNote: "Declined by Owner." }, "Owner declined the maintenance request.")) : runApprovalAction("decline", () => declineProductionMaintenanceRequest(id, "Declined by Owner.").then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Decline</Button>
                  </>
                )}

                {request.approvalStatus === "Awaiting Approval" && role !== "owner" && (
                  <p className="text-sm text-muted-foreground">Awaiting Owner approval decision.</p>
                )}

                {request.approvalStatus === "Needs Information" && role === "owner" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3"><p className="text-xs font-semibold text-orange-800">Information requested</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-sm text-muted-foreground">Waiting for staff response.</p>
                  </>
                )}

                {request.approvalStatus === "Needs Information" && role !== "owner" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3"><p className="text-xs font-semibold text-orange-800">Information requested</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-xs text-muted-foreground">Update the request with the requested information, then send it back to the Owner for review.</p>
                    <Button className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateMaintenanceRequest(id, { approvalStatus: "Awaiting Approval", needsMoreInfo: false }, "Response submitted for review.")) : runApprovalAction("resubmit", () => resubmitProductionMaintenanceApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "resubmit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Response for Review</Button>
                  </>
                )}

                {request.approvalStatus === "Declined" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3"><p className="text-xs font-semibold text-rose-800">Declined</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-xs text-muted-foreground">Declined. Repair progress is on hold.</p>
                    {role === "owner" && <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateMaintenanceRequest(id, { approvalStatus: "Awaiting Approval" }, "Approval reopened. Awaiting Owner decision.")) : runApprovalAction("reopen", () => reopenProductionMaintenanceApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Return to Awaiting Approval</Button>}
                  </>
                )}

                {request.approvalStatus === "Approved" && (
                  <>
                    <p className="text-sm text-emerald-700">Approved.</p>
                    {role === "owner" && canReopenApprovalReview && (
                      <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateMaintenanceRequest(id, { approvalStatus: "Awaiting Approval", maintenanceStatus: request.maintenanceStatus === "Approved / Ready" ? "Submitted" : request.maintenanceStatus }, "Approval review reopened. Awaiting Owner decision.")) : runApprovalAction("reopen-review", () => reopenProductionMaintenanceApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "reopen-review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Reopen Approval Review</Button>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Repair progress</h2>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("In Progress")} disabled={!canChangeProgress || request.maintenanceStatus === "In Progress" || Boolean(statusAction)}>{statusAction === "In Progress" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 text-indigo-600" />}Mark In Progress</Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("Waiting")} disabled={!canChangeProgress || request.maintenanceStatus === "Waiting" || Boolean(statusAction)}>{statusAction === "Waiting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4 text-amber-600" />}Mark Waiting</Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("Completed")} disabled={!canChangeProgress || request.maintenanceStatus === "Completed" || Boolean(statusAction)}>{statusAction === "Completed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}Mark Complete</Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Vendor, assignment and cost</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5"><Label htmlFor="assigned-to">Assigned To</Label><Input id="assigned-to" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Person or team" disabled={!canEdit || savingDetails} /></div>
              <div className="space-y-1.5"><Label htmlFor="vendor">Vendor</Label><select id="vendor" className={fieldClass} value={vendor} onChange={(event) => setVendor(event.target.value)} disabled={!canEdit || savingDetails}><option value="">Not assigned</option>{MAINTENANCE_VENDORS.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="vendor-contact">Vendor Contact <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="vendor-contact" value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} placeholder="Phone or email" disabled={!canEdit || savingDetails} /></div>
              <div className="space-y-1.5"><Label htmlFor="scheduled-date">Scheduled Date</Label><Input id="scheduled-date" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} disabled={!canEdit || savingDetails} /></div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="estimated-cost">Estimated</Label><Input id="estimated-cost" type="number" min="0" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} disabled={!canEdit || savingDetails} /></div><div className="space-y-1.5"><Label htmlFor="final-cost">Final</Label><Input id="final-cost" type="number" min="0" step="0.01" value={finalCost} onChange={(event) => setFinalCost(event.target.value)} disabled={!canEdit || savingDetails} /></div></div>
              {canEdit && <Button size="sm" className="w-full gap-2" onClick={() => void saveRepairDetails()} disabled={savingDetails}>{savingDetails && <Loader2 className="h-4 w-4 animate-spin" />}Save repair details</Button>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Estimated</p><p className="mt-1 text-sm font-semibold tabular-nums">{request.estimatedCost != null ? money.format(request.estimatedCost) : "—"}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Final</p><p className="mt-1 text-sm font-semibold tabular-nums">{request.finalCost != null ? money.format(request.finalCost) : "—"}</p></div>
              <div className="col-span-2 rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Completion Date</p><p className="mt-1 text-sm font-semibold">{request.completedAt ? new Date(request.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not completed yet"}</p></div>
            </div>
          </section>
          </div>


          <section className="order-7 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Activity timeline</h2>
            <div className="mt-4 space-y-4">{requestActivity.map((event, index) => { const Icon = timelineIcons[event.type] ?? Clock3; return <div key={event.id} className="relative flex gap-3">{index < requestActivity.length - 1 && <span className="absolute left-3.5 top-7 h-full w-px bg-border" />}<span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card"><Icon className="h-3 w-3 text-muted-foreground" /></span><div className="pb-1"><p className="text-xs font-medium leading-snug text-foreground">{event.detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{event.user} · {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div></div>})}{requestActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity available.</p>}</div>
          </section>

          {role === "owner" && (
            <section className="order-8 rounded-xl border border-border bg-card p-4 shadow-sm">
              {request.archived ? <Button variant="outline" className="w-full justify-start gap-2" onClick={() => restoreMaintenanceRequest(id)}><RotateCcw className="h-4 w-4" />Restore request</Button> : <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => { archiveMaintenanceRequest(id); router.push("/archived") }}><Archive className="h-4 w-4" />Archive request</Button>}
              <p className="mt-2 text-[11px] text-muted-foreground">No permanent delete. Repair history remains intact.</p>
            </section>
          )}
        </aside>
      </div>

      <FilePreviewModal
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        fileId={previewFile?.fileId ?? null}
        filename={previewFile?.name ?? "Attachment preview"}
      />

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open) setRenameTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename attachment</DialogTitle>
            <DialogDescription>Only the display label changes. The original file and filename are preserved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="attachment-display-name">Display name</Label>
            <Input
              id="attachment-display-name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={255}
              disabled={renameSubmitting}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={renameSubmitting}>Cancel</Button>
            <Button onClick={() => void submitRename()} disabled={!renameValue.trim() || renameSubmitting} className="gap-2">{renameSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoNoteOpen} onOpenChange={(open) => { if (!open && approvalAction !== "more-info") { setInfoNoteOpen(false); setInfoNoteValue("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more information</DialogTitle>
            <DialogDescription>Explain what additional information or changes are needed before this request can be approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="info-note">Note to submitter</Label>
            <Textarea id="info-note" rows={3} value={infoNoteValue} onChange={(event) => setInfoNoteValue(event.target.value)} placeholder="e.g. Please provide a vendor quote before approval." disabled={approvalAction === "more-info"} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInfoNoteOpen(false); setInfoNoteValue("") }} disabled={approvalAction === "more-info"}>Cancel</Button>
            <Button onClick={() => void submitInfoRequest()} disabled={!infoNoteValue.trim() || approvalAction === "more-info"} className="gap-2">{approvalAction === "more-info" && <Loader2 className="h-4 w-4 animate-spin" />}Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open && !editSaving) setEditOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit request details</DialogTitle>
            <DialogDescription>Update the practical details of this maintenance request. Location, submitter, and approval state are not changed here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="edit-title">Title</Label><Input id="edit-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={editSaving} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={editSaving} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="edit-area">Classroom / Area</Label><Input id="edit-area" value={editArea} onChange={(event) => setEditArea(event.target.value)} disabled={editSaving} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <select id="edit-category" className={fieldClass} value={editCategory} onChange={(event) => setEditCategory(event.target.value as MaintenanceCategory)} disabled={editSaving}>
                  {MAINTENANCE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Priority</Label>
                <select id="edit-priority" className={fieldClass} value={editPriority} onChange={(event) => setEditPriority(event.target.value as MaintenancePriority)} disabled={editSaving}>
                  {(["Low", "Normal", "High", "Urgent"] as MaintenancePriority[]).map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="edit-estimated-cost">Estimated cost</Label><Input id="edit-estimated-cost" type="number" min="0" step="0.01" value={editEstimatedCost} onChange={(event) => setEditEstimatedCost(event.target.value)} disabled={editSaving} /></div>
            </div>
            {editError && <p className="text-sm text-red-700">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
            <Button onClick={() => void saveRequestDetails()} disabled={editSaving || !editTitle.trim()} className="gap-2">{editSaving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
