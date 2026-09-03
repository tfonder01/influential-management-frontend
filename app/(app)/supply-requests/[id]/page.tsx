"use client"

import { use, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquareMore,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  User,
  XCircle,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { SUPPLY_AREAS, SUPPLY_CATEGORIES } from "@/lib/mock-data"
import type { Comment, SupplyAttachment, SupplyCategory, SupplyPriority, SupplyStatus } from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MentionCommentComposer, MentionText } from "@/components/comment-mentions"
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
import { SupplyApprovalBadge, SupplyPriorityBadge, SupplyStatusBadge } from "@/components/supply-badges"
import { FilePreviewModal } from "@/components/file-preview-modal"
import { cn } from "@/lib/utils"
import { roleLabel } from "@/lib/role-labels"
import {
  ATTACHMENT_TYPE_TO_API,
  downloadFileApi,
  getSupplyDetail,
  isApiClientError,
  uploadFileApi,
  viewFileApi,
} from "@/lib/supply-api"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
const progressSteps = ["Submitted", "Approved / Ready", "Ordered", "Received"] as const
const timelineIcons: Record<string, React.ElementType> = {
  created: Package,
  edited: Building2,
  status_changed: CheckCircle2,
  comment_added: MessageSquareMore,
  file_uploaded: Upload,
  archived: Archive,
  restored: RotateCcw,
}

function Meta({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return <div><dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</dt><dd className="mt-1 text-sm text-foreground">{children}</dd></div>
}

export default function SupplyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    supplyRequests,
    supplyRequestsLoading,
    locations,
    comments,
    activity,
    currentUser,
    role,
    updateSupplyRequest,
    archiveSupplyRequest,
    restoreSupplyRequest,
    addSupplyPhoto,
    addComment,
    addSupplyComment,
    showToast,
    isDemoMode,
    upsertSupplyRequest,
    loadSupplyComments,
    updateProductionSupplyRequest,
    changeProductionSupplyStatus,
    approveProductionSupplyRequest,
    declineProductionSupplyRequest,
    requestSupplyInfoProduction,
    resubmitProductionSupplyApproval,
    reopenProductionSupplyApproval,
    reopenReceivedProductionSupplyRequest,
    reopenCancelledProductionSupplyRequest,
    addProductionSupplyAttachment,
    removeProductionSupplyAttachment,
    replaceProductionSupplyAttachment,
    renameProductionSupplyAttachment,
  } = useApp()
  const router = useRouter()
  const request = supplyRequests.find((item) => item.id === id)
  const [commentText, setCommentText] = useState("")
  const [detailLoading, setDetailLoading] = useState(!isDemoMode)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<{ fileId: string; name: string } | null>(null)
  const [attachmentAction, setAttachmentAction] = useState(false)
  const [fileActionKey, setFileActionKey] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState("")
  const [renameTarget, setRenameTarget] = useState<SupplyAttachment | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<SupplyAttachment | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [approvalAction, setApprovalAction] = useState<string | null>(null)
  const [infoNoteOpen, setInfoNoteOpen] = useState(false)
  const [infoNoteValue, setInfoNoteValue] = useState("")
  const [statusAction, setStatusAction] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)
  const [removeAttachmentTarget, setRemoveAttachmentTarget] = useState<SupplyAttachment | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [vendor, setVendor] = useState("")
  const [vendorContact, setVendorContact] = useState("")
  const [orderDate, setOrderDate] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [receivedDate, setReceivedDate] = useState("")
  const [finalCost, setFinalCost] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editArea, setEditArea] = useState("")
  const [editCategory, setEditCategory] = useState<SupplyCategory | "">("")
  const [editQuantity, setEditQuantity] = useState("1")
  const [editPriority, setEditPriority] = useState<SupplyPriority>("Medium")
  const [editEstimatedCost, setEditEstimatedCost] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  useEffect(() => {
    if (!request) return
    setVendor(request.vendor ?? "")
    setVendorContact(request.vendorContact ?? "")
    setOrderDate(request.orderedAt?.slice(0, 10) ?? "")
    setExpectedDeliveryDate(request.expectedDeliveryAt?.slice(0, 10) ?? "")
    setReceivedDate(request.receivedAt?.slice(0, 10) ?? "")
    setFinalCost(request.finalTotal?.toString() ?? "")
  }, [request])

  useEffect(() => {
    if (isDemoMode) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    getSupplyDetail(id)
      .then((detail) => {
        if (!cancelled) upsertSupplyRequest(detail.request)
      })
      .catch((error) => {
        if (cancelled) return
        setDetailError(isApiClientError(error) ? error.message : "This supply request could not be loaded.")
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    void loadSupplyComments(id)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDemoMode])

  if (!isDemoMode && (detailLoading || (supplyRequestsLoading && !request))) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Loading supply request…</p>
      </div>
    )
  }

  if (!request || detailError) {
    return <div className="flex flex-col items-center gap-4 py-16"><p className="text-sm text-muted-foreground">{detailError ?? "Supply request not found or unavailable for this role."}</p><Button render={<Link href="/supply-requests" />} nativeButton={false} variant="outline">Back to Supply Requests</Button></div>
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
    && request.fulfillmentStatus !== "Cancelled"
  // Cancelling is a withdraw action available regardless of where the approval decision stands
  // (unlike Ordered/Waiting/Received, which require approval to be resolved first).
  const canCancel = canEdit && request.fulfillmentStatus !== "Cancelled" && request.fulfillmentStatus !== "Received"
  const canReopenApprovalReview = request.fulfillmentStatus === "Submitted" || request.fulfillmentStatus === "Approved / Ready"
  const progressStopped = request.approvalStatus === "Declined" || request.fulfillmentStatus === "Cancelled"
  const progressIndex = request.approvalStatus === "Awaiting Approval" || request.approvalStatus === "Needs Information" || request.approvalStatus === "Declined"
    ? 0
    : request.fulfillmentStatus === "Received"
      ? 3
      : request.fulfillmentStatus === "Ordered" || request.fulfillmentStatus === "Waiting / In Transit"
        ? 2
        : request.fulfillmentStatus === "Approved / Ready"
          ? 1
          : 0
  // Approval and fulfillment are separate backend concepts, but the header shows only one primary
  // workflow pill at a time: approval takes visual priority while pending/blocking (Awaiting
  // Approval / Needs Information / Declined); once approval is settled the header shows fulfillment progress.
  const showsApprovalAsPrimaryState = request.approvalStatus === "Awaiting Approval"
    || request.approvalStatus === "Needs Information"
    || request.approvalStatus === "Declined"

  const updateStatus = async (status: Exclude<SupplyStatus, "Submitted">) => {
    if (statusAction || approvalAction) return
    if (isDemoMode) {
      updateSupplyRequest(id, {
        fulfillmentStatus: status,
        orderedAt: status === "Ordered" ? new Date().toISOString() : request.orderedAt,
        receivedAt: status === "Received" ? new Date().toISOString() : request.receivedAt,
      }, status === "Ordered" ? "Item ordered." : status === "Waiting / In Transit" ? "Marked waiting / in transit." : status === "Received" ? "Item received." : status === "Cancelled" ? "Supply request cancelled." : "Request marked Approved / Ready.")
      return
    }
    setStatusAction(status)
    try {
      await changeProductionSupplyStatus(id, status)
    } catch {
      // Toast handled in the store action.
    } finally {
      setStatusAction(null)
    }
  }

  const reopenReceivedRequest = async () => {
    if (statusAction || approvalAction) return
    if (isDemoMode) {
      updateSupplyRequest(id, { fulfillmentStatus: "Ordered", receivedAt: undefined }, "Supply request reopened. Status set to Ordered.")
      return
    }
    setStatusAction("reopen-received")
    try {
      await reopenReceivedProductionSupplyRequest(id)
    } catch {
      // Toast handled in the store action.
    } finally {
      setStatusAction(null)
    }
  }

  const reopenCancelledRequest = async () => {
    if (statusAction || approvalAction) return
    if (isDemoMode) {
      const target = request.approvalStatus === "Approved" || request.approvalStatus === "Not Required" ? "Approved / Ready" : "Submitted"
      updateSupplyRequest(id, { fulfillmentStatus: target }, "Supply request reopened.")
      return
    }
    setStatusAction("reopen-cancelled")
    try {
      await reopenCancelledProductionSupplyRequest(id)
    } catch {
      // Toast handled in the store action.
    } finally {
      setStatusAction(null)
    }
  }

  const confirmCancel = async () => {
    setCancelDialogOpen(false)
    await updateStatus("Cancelled")
  }

  const addRequestComment = async (mentionedUserIds: string[]) => {
    if (!commentText.trim() || commentSubmitting) return
    const comment: Comment = {
      id: `scmt_${Date.now()}`,
      recordId: id,
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      isUnread: false,
      mentionedUserIds,
    }
    if (isDemoMode) {
      addComment(comment)
      setCommentText("")
      return
    }
    setCommentSubmitting(true)
    try {
      await addSupplyComment(comment)
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
    setEditQuantity(request.quantity.toString())
    setEditPriority(request.priority)
    setEditEstimatedCost(request.estimatedTotal?.toString() ?? "")
    setEditError("")
    setEditOpen(true)
  }

  const saveRequestDetails = async () => {
    if (editSaving) return
    if (!editTitle.trim() || !editCategory || !editQuantity || Number(editQuantity) <= 0) {
      setEditError("Title, category, and a valid quantity are required.")
      return
    }
    setEditSaving(true)
    setEditError("")
    if (isDemoMode) {
      updateSupplyRequest(id, {
        title: editTitle.trim(),
        itemName: editTitle.trim(),
        description: editDescription.trim() || undefined,
        area: editArea.trim() || undefined,
        category: editCategory as SupplyCategory,
        quantity: Number(editQuantity),
        priority: editPriority,
        estimatedTotal: editEstimatedCost ? Number(editEstimatedCost) : request.estimatedTotal,
      }, "Request details updated.")
      setEditSaving(false)
      setEditOpen(false)
      return
    }
    try {
      await updateProductionSupplyRequest(id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory as SupplyCategory,
        quantity: Number(editQuantity),
        priority: editPriority,
        classroomAgeGroup: request.classroomAgeGroup,
        area: editArea.trim() || undefined,
        vendorName: vendor || undefined,
        vendorContact: vendorContact || undefined,
        estimatedCost: editEstimatedCost ? Number(editEstimatedCost) : undefined,
        finalCost: finalCost ? Number(finalCost) : undefined,
        orderDate: orderDate || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        receivedDate: receivedDate || undefined,
      })
      setEditOpen(false)
    } catch (error) {
      setEditError(isApiClientError(error) ? error.message : "Failed to update request details. Please try again.")
    } finally {
      setEditSaving(false)
    }
  }

  const savePurchaseDetails = async () => {
    if (savingDetails) return
    if (isDemoMode) {
      updateSupplyRequest(id, {
        vendor: vendor || undefined,
        vendorContact: vendorContact || undefined,
        orderedAt: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedDeliveryAt: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        receivedAt: receivedDate ? new Date(receivedDate).toISOString() : undefined,
        finalTotal: finalCost ? Number(finalCost) : undefined,
      }, "Purchase and vendor details updated.")
      return
    }
    setSavingDetails(true)
    try {
      await updateProductionSupplyRequest(id, {
        title: request.title,
        description: request.description || undefined,
        category: request.category,
        quantity: request.quantity,
        priority: request.priority,
        classroomAgeGroup: request.classroomAgeGroup,
        area: request.area || undefined,
        vendorName: vendor || undefined,
        vendorContact: vendorContact || undefined,
        estimatedCost: request.estimatedTotal,
        finalCost: finalCost ? Number(finalCost) : undefined,
        orderDate: orderDate || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        receivedDate: receivedDate || undefined,
      })
    } catch {
      // Toast handled in the store action.
    } finally {
      setSavingDetails(false)
    }
  }

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || attachmentAction) return
    if (isDemoMode) {
      addSupplyPhoto(id, file.name)
      return
    }
    setAttachmentAction(true)
    setAttachmentError("")
    try {
      const uploaded = await uploadFileApi(file, request.locationId)
      await addProductionSupplyAttachment(id, uploaded.id, "REQUEST_PHOTO")
    } catch (error) {
      setAttachmentError(isApiClientError(error) ? error.message : "Attachment upload failed. Please try again.")
    } finally {
      setAttachmentAction(false)
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
      updateSupplyRequest(id, { approvalStatus: "Needs Information", needsMoreInfo: true, approvalNote: note }, "Owner requested more information.")
      setInfoNoteOpen(false)
      setInfoNoteValue("")
      return
    }
    await runApprovalAction("more-info", () => requestSupplyInfoProduction(id, note).then(() => undefined))
    setInfoNoteOpen(false)
    setInfoNoteValue("")
  }

  const handleAttachmentClick = (attachment: SupplyAttachment) => {
    if (!attachment.fileId) {
      showToast(`Attachment ready: ${attachment.name}`)
      return
    }
    setPreviewFile({ fileId: attachment.fileId, name: attachment.displayName ?? attachment.name })
  }

  const handleOpenInNewTab = async (attachment: SupplyAttachment) => {
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

  const handleDownloadAttachment = async (attachment: SupplyAttachment) => {
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

  const requestRemoveAttachment = (attachment: SupplyAttachment) => {
    if (!attachment.fileId || fileActionKey) return
    setRemoveAttachmentTarget(attachment)
  }

  const confirmRemoveAttachment = async () => {
    const attachment = removeAttachmentTarget
    if (!attachment?.fileId || fileActionKey) return
    setRemoveAttachmentTarget(null)
    setFileActionKey(`remove:${attachment.fileId}`)
    try {
      await removeProductionSupplyAttachment(id, attachment.fileId)
    } catch {
      // Toast handled in the store action.
    } finally {
      setFileActionKey(null)
    }
  }

  const handleReplaceAttachment = async (attachment: SupplyAttachment, file: File) => {
    if (!attachment.fileId || fileActionKey || !request) return
    setFileActionKey(`replace:${attachment.fileId}`)
    try {
      const uploaded = await uploadFileApi(file, request.locationId)
      const type = attachment.attachmentType ? ATTACHMENT_TYPE_TO_API[attachment.attachmentType] : undefined
      await replaceProductionSupplyAttachment(id, attachment.fileId, uploaded.id, type)
    } catch {
      // Toast handled in the store action.
    } finally {
      setFileActionKey(null)
    }
  }

  const openRenameDialog = (attachment: SupplyAttachment) => {
    setRenameTarget(attachment)
    setRenameValue(attachment.displayName ?? attachment.name)
  }

  const triggerReplace = (attachment: SupplyAttachment) => {
    setReplaceTarget(attachment)
    requestAnimationFrame(() => replaceInputRef.current?.click())
  }

  const handleReplaceInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file && replaceTarget) void handleReplaceAttachment(replaceTarget, file)
  }

  const submitRename = async () => {
    if (!renameTarget?.fileId || renameSubmitting) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    setRenameSubmitting(true)
    try {
      await renameProductionSupplyAttachment(id, renameTarget.fileId, trimmed)
      setRenameTarget(null)
    } catch {
      // Toast handled in the store action.
    } finally {
      setRenameSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/supply-requests" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4" />Back to Supply Requests</Link>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">Supply request</span>
              <h1 className="mt-2 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{request.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Request {request.requestNumber ? `SUP-${request.requestNumber}` : request.id} · Last updated {new Date(request.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SupplyPriorityBadge priority={request.priority} />
              {showsApprovalAsPrimaryState ? <SupplyApprovalBadge status={request.approvalStatus} /> : <SupplyStatusBadge status={request.fulfillmentStatus} />}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-muted/15 px-4 py-4 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supply fulfillment</p>
          </div>
          <ol className="grid grid-cols-4" aria-label={`Supply progress: ${request.fulfillmentStatus}`}>
            {progressSteps.map((step, index) => {
              const completed = index < progressIndex
              const current = index === progressIndex
              const finished = request.fulfillmentStatus === "Received" && index === progressSteps.length - 1
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="contents lg:col-span-2 lg:block lg:space-y-5">
          <section className="order-1 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Request details</h2>
              {canEdit && <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
              <Meta icon={MapPin} label="Location">{location?.name ?? "—"}</Meta>
              <Meta icon={Building2} label="Classroom / Area">{request.area || "Not specified"}</Meta>
              <Meta icon={Package} label="Category">{request.category}</Meta>
              <Meta icon={User} label="Submitted by">{request.submittedBy}</Meta>
              <Meta icon={CalendarDays} label="Submitted">{new Date(request.requestedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Meta>
              <Meta icon={ShieldCheck} label="Approval"><SupplyApprovalBadge status={request.approvalStatus} /></Meta>
            </dl>
            <div className="mt-5 rounded-lg bg-muted/40 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1.5 text-sm leading-relaxed text-foreground">{request.description}</p></div>
          </section>

          <section className="order-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Attachments</h2><p className="mt-0.5 text-xs text-muted-foreground">{isDemoMode ? "Prototype attachments preserve filenames and upload history." : "Photos, quotes, receipts, and invoices are attached directly to this supply request."}</p></div><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{request.photos.length}</span></div>
            {attachmentError && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2.5 text-sm text-red-700">{attachmentError}</div>}
            <div className="mt-4 space-y-1.5">
              {request.photos.map((item) => {
                const key = `${item.fileId ?? item.name}-${item.uploadedAt}`
                const label = item.displayName ?? item.name
                const busy = item.fileId ? fileActionKey === `remove:${item.fileId}` || fileActionKey === `replace:${item.fileId}` : false
                return (
                  <div key={key} className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1">
                    {item.attachmentType && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{item.attachmentType}</span>}
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
                          <DropdownMenuItem onClick={() => triggerReplace(item)}><RefreshCw className="h-3.5 w-3.5" />Replace</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => requestRemoveAttachment(item)}><Trash2 className="h-3.5 w-3.5" />Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              })}
              {request.photos.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">None attached</p>}
            </div>
            {canEdit && <label className={cn("mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5", attachmentAction && "pointer-events-none opacity-60")}><Upload className={cn("h-3.5 w-3.5", attachmentAction && "animate-pulse")} />Upload<input type="file" className="sr-only" accept="image/*,.pdf" disabled={attachmentAction} onChange={(event) => { void handleFileInput(event) }} /></label>}
            <input ref={replaceInputRef} type="file" className="sr-only" accept="image/*,.pdf" onChange={handleReplaceInputChange} />
          </section>

          <section className="order-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Comments and notes <span className="font-normal text-muted-foreground">({requestComments.length})</span></h2>
            <div className="mt-4 space-y-4">{requestComments.map((comment) => <div key={comment.id} className="flex gap-3"><div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", comment.role === "owner" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700")}>{comment.user.split(" ").map((part) => part[0]).join("")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="text-sm font-medium text-foreground">{comment.user}</span><span className="text-[10px] text-muted-foreground">{roleLabel(comment.role)}</span><span className="ml-auto text-[10px] text-muted-foreground">{new Date(comment.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div><p className="mt-1 rounded-lg bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground"><MentionText text={comment.text} mentions={comment.mentions} /></p></div></div>)}{requestComments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}</div>
            {canEdit && <div className="mt-4 flex gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{currentUser.initials}</div><MentionCommentComposer locationId={request.locationId} value={commentText} onChange={setCommentText} onSubmit={addRequestComment} currentUserId={currentUser.id} isDemoMode={isDemoMode} disabled={commentSubmitting} rows={3} placeholder="Add a note or answer an approval question…" submitLabel="Add comment" /></div>}
          </section>
        </div>

        <aside className="contents lg:block lg:space-y-5">
          <div className="order-2 space-y-3 lg:order-2">
            <div className="flex items-center gap-2 px-1"><Package className="h-3.5 w-3.5 text-muted-foreground" /><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchase Details</h2></div>
          {!request.archived && (role === "owner" || request.approvalStatus === "Needs Information" || request.approvalStatus === "Declined") && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-foreground">Owner approval</h2>
              <p className="mt-1 text-xs text-muted-foreground">Approval is separate from fulfillment progress.</p>
              <div className="mt-3 space-y-2">
                {request.approvalStatus === "Awaiting Approval" && role === "owner" && (
                  <>
                    <Button className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-600/90" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Approved", fulfillmentStatus: request.fulfillmentStatus === "Submitted" ? "Approved / Ready" : request.fulfillmentStatus, needsMoreInfo: false, approvalNote: "Approved by Owner." }, "Owner approved the supply request.")) : runApprovalAction("approve", () => approveProductionSupplyRequest(id, "Approved by Owner.").then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve</Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-amber-700" size="sm" onClick={() => setInfoNoteOpen(true)} disabled={Boolean(approvalAction)}><MessageSquareMore className="h-4 w-4" />Request more information</Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-rose-700" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Declined", approvalNote: "Declined by Owner." }, "Owner declined the supply request.")) : runApprovalAction("decline", () => declineProductionSupplyRequest(id, "Declined by Owner.").then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Decline</Button>
                  </>
                )}

                {request.approvalStatus === "Awaiting Approval" && role !== "owner" && (
                  <p className="text-sm text-muted-foreground">Awaiting Owner approval decision.</p>
                )}

                {request.approvalStatus === "Needs Information" && role === "owner" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3"><p className="text-xs font-semibold text-orange-800">Information requested</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-sm text-muted-foreground">Waiting for staff response.</p>
                    <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Awaiting Approval" }, "Approval returned to Awaiting Approval by Owner.")) : runApprovalAction("reopen-info", () => reopenProductionSupplyApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "reopen-info" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Return to Awaiting Approval</Button>
                  </>
                )}

                {request.approvalStatus === "Needs Information" && role !== "owner" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3"><p className="text-xs font-semibold text-orange-800">Information requested</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-xs text-muted-foreground">Update the request with the requested information, then send it back to the Owner for review.</p>
                    <Button className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Awaiting Approval", needsMoreInfo: false }, "Response submitted for review.")) : runApprovalAction("resubmit", () => resubmitProductionSupplyApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "resubmit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit Response for Review</Button>
                  </>
                )}

                {request.approvalStatus === "Declined" && (
                  <>
                    {request.approvalNote && <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3"><p className="text-xs font-semibold text-rose-800">Declined</p><p className="mt-1 text-sm text-foreground">{request.approvalNote}</p></div>}
                    <p className="text-xs text-muted-foreground">Declined. Fulfillment progress is on hold.</p>
                    {role === "owner" && <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Awaiting Approval" }, "Approval reopened. Awaiting Owner decision.")) : runApprovalAction("reopen-decline", () => reopenProductionSupplyApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "reopen-decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Return to Awaiting Approval</Button>}
                  </>
                )}

                {request.approvalStatus === "Approved" && (
                  <>
                    {request.fulfillmentStatus === "Cancelled" ? (
                      <p className="text-sm text-muted-foreground">This request was approved, but the fulfillment workflow has been cancelled.</p>
                    ) : (
                      <>
                        <p className="text-sm text-emerald-700">Approved.</p>
                        {role === "owner" && canReopenApprovalReview && (
                          <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={() => void (isDemoMode ? Promise.resolve(updateSupplyRequest(id, { approvalStatus: "Awaiting Approval", fulfillmentStatus: request.fulfillmentStatus === "Approved / Ready" ? "Submitted" : request.fulfillmentStatus }, "Approval review reopened. Awaiting Owner decision.")) : runApprovalAction("reopen-review", () => reopenProductionSupplyApproval(id).then(() => undefined)))} disabled={Boolean(approvalAction)}>{approvalAction === "reopen-review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Reopen Approval Review</Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Fulfillment progress</h2>
            {request.fulfillmentStatus === "Cancelled" && (
              <p className="mt-1 text-xs text-muted-foreground">This request&apos;s fulfillment workflow was cancelled. Its history has been preserved and it can be reopened.</p>
            )}
            <div className="mt-3 grid gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("Ordered")} disabled={!canChangeProgress || request.fulfillmentStatus === "Ordered" || request.fulfillmentStatus === "Received" || Boolean(statusAction)}>{statusAction === "Ordered" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 text-indigo-600" />}Mark Ordered</Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("Waiting / In Transit")} disabled={!canChangeProgress || request.fulfillmentStatus !== "Ordered" || Boolean(statusAction)}>{statusAction === "Waiting / In Transit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4 text-cyan-600" />}Mark Waiting / In Transit</Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void updateStatus("Received")} disabled={!canChangeProgress || (request.fulfillmentStatus !== "Ordered" && request.fulfillmentStatus !== "Waiting / In Transit") || Boolean(statusAction)}>{statusAction === "Received" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4 text-emerald-600" />}Mark Received</Button>
              {request.fulfillmentStatus === "Received" && <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void reopenReceivedRequest()} disabled={!canEdit || Boolean(statusAction)}>{statusAction === "reopen-received" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Reopen Supply Request</Button>}
              {request.fulfillmentStatus === "Cancelled" && <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => void reopenCancelledRequest()} disabled={!canEdit || Boolean(statusAction)}>{statusAction === "reopen-cancelled" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Reopen Supply Request</Button>}
              {role === "owner" && <Button variant="ghost" size="sm" className="justify-start gap-2 text-rose-700" onClick={() => setCancelDialogOpen(true)} disabled={!canCancel || Boolean(statusAction)}>{statusAction === "Cancelled" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Cancel</Button>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Vendor and cost</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5"><Label htmlFor="vendor">Vendor</Label><Input id="vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Vendor or store name" disabled={!canEdit || savingDetails} /></div>
              <div className="space-y-1.5"><Label htmlFor="vendor-contact">Vendor Contact <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="vendor-contact" value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} placeholder="Phone or email" disabled={!canEdit || savingDetails} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label htmlFor="order-date">Order Date</Label><Input id="order-date" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} disabled={!canEdit || savingDetails} /></div>
                <div className="space-y-1.5"><Label htmlFor="expected-delivery">Expected Delivery</Label><Input id="expected-delivery" type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} disabled={!canEdit || savingDetails} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="received-date">Received Date</Label><Input id="received-date" type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} disabled={!canEdit || savingDetails} /></div>
              <div className="space-y-1.5"><Label htmlFor="final-cost">Final Cost</Label><Input id="final-cost" type="number" min="0" step="0.01" value={finalCost} onChange={(event) => setFinalCost(event.target.value)} disabled={!canEdit || savingDetails} /></div>
              {canEdit && <Button size="sm" className="w-full gap-2" onClick={() => void savePurchaseDetails()} disabled={savingDetails}>{savingDetails && <Loader2 className="h-4 w-4 animate-spin" />}Save purchase details</Button>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Estimated</p><p className="mt-1 text-sm font-semibold tabular-nums">{money.format(request.estimatedTotal)}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Final</p><p className="mt-1 text-sm font-semibold tabular-nums">{request.finalTotal != null ? money.format(request.finalTotal) : "—"}</p></div>
              <div className="col-span-2 rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Quantity</p><p className="mt-1 text-sm font-semibold">{request.quantity} {request.quantityUnit ?? ""}</p></div>
            </div>
          </section>
          </div>

          <section className="order-7 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Activity timeline</h2>
            <div className="mt-4 space-y-4">{requestActivity.map((event, index) => { const Icon = timelineIcons[event.type] ?? Clock3; return <div key={event.id} className="relative flex gap-3">{index < requestActivity.length - 1 && <span className="absolute left-3.5 top-7 h-full w-px bg-border" />}<span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card"><Icon className="h-3 w-3 text-muted-foreground" /></span><div className="pb-1"><p className="text-xs font-medium leading-snug text-foreground">{event.detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{event.user} · {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div></div>})}{requestActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity available.</p>}</div>
          </section>

          {role === "owner" && (
            <section className="order-8 rounded-xl border border-border bg-card p-4 shadow-sm">
              {request.archived ? <Button variant="outline" className="w-full justify-start gap-2" onClick={() => restoreSupplyRequest(id)}><RotateCcw className="h-4 w-4" />Restore request</Button> : <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => setArchiveDialogOpen(true)}><Archive className="h-4 w-4" />Archive request</Button>}
              <p className="mt-2 text-[11px] text-muted-foreground">No permanent delete. Full history remains intact.</p>
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

      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { if (!open && !statusAction) setCancelDialogOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this supply request?</DialogTitle>
            <DialogDescription>This will stop the current fulfillment workflow. The request and its history will be preserved, and it can be reopened later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={Boolean(statusAction)}>Keep Request</Button>
            <Button variant="destructive" className="gap-2" onClick={() => void confirmCancel()} disabled={Boolean(statusAction)}>{statusAction === "Cancelled" && <Loader2 className="h-4 w-4 animate-spin" />}Cancel Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveDialogOpen} onOpenChange={(open) => { if (!archiveSubmitting) setArchiveDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this supply request?</DialogTitle>
            <DialogDescription>This request will be removed from active views but its history will be preserved. An Owner can restore it later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={archiveSubmitting}>Keep Active</Button>
            <Button variant="destructive" disabled={archiveSubmitting} onClick={async () => {
              setArchiveSubmitting(true)
              const archived = await archiveSupplyRequest(id)
              setArchiveSubmitting(false)
              if (archived) {
                setArchiveDialogOpen(false)
                router.push("/supply-requests")
              }
            }}>
              {archiveSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Archive Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeAttachmentTarget)} onOpenChange={(open) => { if (!open) setRemoveAttachmentTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this attachment?</DialogTitle>
            <DialogDescription>This will remove the attachment from this request. The stored file may be retained temporarily for recovery or cleanup.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveAttachmentTarget(null)} disabled={Boolean(fileActionKey)}>Keep Attachment</Button>
            <Button variant="destructive" className="gap-2" onClick={() => void confirmRemoveAttachment()} disabled={Boolean(fileActionKey)}>{fileActionKey?.startsWith("remove:") && <Loader2 className="h-4 w-4 animate-spin" />}Remove Attachment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogDescription>Update the practical details of this supply request. Location, submitter, and approval state are not changed here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="edit-title">Item / Title</Label><Input id="edit-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={editSaving} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={editSaving} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="edit-area">Classroom / Area</Label>
                <select id="edit-area" className={fieldClass} value={editArea} onChange={(event) => setEditArea(event.target.value)} disabled={editSaving}>
                  <option value="">Not specified</option>
                  {SUPPLY_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <select id="edit-category" className={fieldClass} value={editCategory} onChange={(event) => setEditCategory(event.target.value as SupplyCategory)} disabled={editSaving}>
                  {SUPPLY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label htmlFor="edit-quantity">Quantity</Label><Input id="edit-quantity" type="number" min="1" step="1" value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} disabled={editSaving} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Priority</Label>
                <select id="edit-priority" className={fieldClass} value={editPriority} onChange={(event) => setEditPriority(event.target.value as SupplyPriority)} disabled={editSaving}>
                  {(["Low", "Medium", "High", "Urgent"] as SupplyPriority[]).map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}
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
