"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Archive,
  RotateCcw,
  Send,
  MapPin,
  Tag,
  User,
  Calendar,
  RefreshCw,
  Loader2,
  Pencil,
  Upload,
  Trash2,
} from "lucide-react"
import { useApp } from "@/lib/store"
import { StatusBadge } from "@/components/status-badge"
import { CategoryBadge } from "@/components/category-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MentionCommentComposer, MentionText } from "@/components/comment-mentions"
import { EditRecordModal } from "@/components/edit-record-modal"
import { FilePreviewModal } from "@/components/file-preview-modal"
import { cn } from "@/lib/utils"
import type { Comment } from "@/lib/types"
import { getRecordWorkspace, isOperationsRecord } from "@/lib/record-workspaces"
import { WorkspaceBadge } from "@/components/workspace-badge"
import { reportingPeriodLabel } from "@/lib/reporting-period"
import { listActivity, type ApiActivityItem } from "@/lib/activity-api"
import {
  addRecordAttachmentApi,
  downloadFileApi,
  getRecordDetail,
  isApiClientError,
  removeRecordAttachmentApi,
  replaceRecordAttachmentApi,
  uploadFileApi,
} from "@/lib/records-api"

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  created: FileText,
  edited: RefreshCw,
  status_changed: CheckCircle2,
  comment_added: Send,
  file_uploaded: FileText,
  archived: Archive,
  restored: RotateCcw,
}

function activityIconFor(action: string): React.ElementType {
  if (ACTIVITY_ICONS[action]) return ACTIVITY_ICONS[action]
  if (action.includes("COMMENT")) return Send
  if (action.includes("ATTACHMENT")) return FileText
  if (action.includes("ARCHIVED")) return Archive
  if (action.includes("RESTORED")) return RotateCcw
  if (action.includes("STATUS")) return CheckCircle2
  if (action.includes("UPDATED")) return RefreshCw
  return FileText
}

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    records,
    comments,
    activity,
    updateRecordStatus,
    archiveRecord,
    restoreRecord,
    addComment,
    currentUser,
    role,
    showToast,
    locations,
    isDemoMode,
    recordsLoading,
    upsertRecord,
    loadRecordComments,
  } = useApp()
  const router = useRouter()

  const record = records.find((r) => r.id === id)
  const [commentText, setCommentText] = useState("")
  const [detailLoading, setDetailLoading] = useState(!isDemoMode)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ fileId: string; name: string } | null>(null)
  const [attachmentAction, setAttachmentAction] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [scopedRecordActivity, setScopedRecordActivity] = useState<ApiActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(!isDemoMode)
  const [activityError, setActivityError] = useState("")
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)

  const refreshRecordActivity = useCallback(async () => {
    if (isDemoMode) return
    setActivityLoading(true)
    setActivityError("")
    try {
      const page = await listActivity({
        module: "RECORDS",
        entityType: "WORKSPACE_RECORD",
        entityId: id,
        size: 100,
      })
      setScopedRecordActivity(page.content)
    } catch {
      setActivityError("Could not load activity right now.")
    } finally {
      setActivityLoading(false)
    }
  }, [id, isDemoMode])

  const recordCommentVersion = comments
    .filter((comment) => comment.recordId === id)
    .map((comment) => comment.id)
    .join(",")
  const attachmentVersion = record?.attachments
    ?.map((attachment) => `${attachment.fileId ?? attachment.name}:${attachment.name}`)
    .join(",") ?? ""

  useEffect(() => {
    void refreshRecordActivity()
  }, [attachmentVersion, record?.lastUpdated, recordCommentVersion, refreshRecordActivity])

  useEffect(() => {
    if (isDemoMode) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    getRecordDetail(id)
      .then((detail) => { if (!cancelled) upsertRecord(detail.record) })
      .catch((error) => {
        if (cancelled) return
        setDetailError(isApiClientError(error) ? error.message : "This record could not be loaded.")
      })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    loadRecordComments(id)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDemoMode])

  if (!isDemoMode && (detailLoading || (recordsLoading && !record))) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Loading record…</p>
      </div>
    )
  }

  if (!record || detailError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-muted-foreground">{detailError ?? "Record not found."}</p>
        <Button render={<Link href="/records" />} nativeButton={false} variant="outline" size="sm">
            Back to Records
        </Button>
      </div>
    )
  }

  const location = locations.find((l) => l.id === record.locationId)
  const recordComments = comments.filter((c) => c.recordId === id)
  const recordActivity = isDemoMode
    ? activity.filter((event) => event.recordId === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((event) => ({
        id: event.id,
        action: event.type,
        message: event.detail,
        actorDisplayName: event.user,
        createdAt: event.timestamp,
      }))
    : scopedRecordActivity
  const showAllActivity = expandedActivityId === id
  const visibleActivity = showAllActivity ? recordActivity : recordActivity.slice(0, 5)

  const handleComment = (mentionedUserIds: string[]) => {
    if (!commentText.trim()) return
    const comment: Comment = {
      id: `cmt_${Date.now()}`,
      recordId: id,
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
      isUnread: false,
      mentionedUserIds,
    }
    addComment(comment)
    setCommentText("")
  }

  const handleDownload = async (attachment: { fileId?: string; name: string }) => {
    if (!attachment.fileId) {
      showToast("Download ready: " + attachment.name)
      return
    }
    try {
      await downloadFileApi(attachment.fileId, attachment.name)
    } catch (error) {
      showToast(isApiClientError(error) ? error.message : "Download failed. Please try again.")
    }
  }

  const handleView = (attachment: { fileId?: string; name: string }) => {
    if (!attachment.fileId) {
      showToast("Preview is not available for this file.")
      return
    }
    setPreviewFile({ fileId: attachment.fileId, name: attachment.name })
  }

  const attachmentErrorMessage = (error: unknown, fallback: string) =>
    isApiClientError(error) ? error.message : fallback

  const runAttachmentAction = async (key: string, successMessage: string, action: () => Promise<void>) => {
    if (attachmentAction) return
    setAttachmentAction(key)
    setAttachmentError(null)
    try {
      await action()
      const detail = await getRecordDetail(id)
      upsertRecord(detail.record)
      showToast(successMessage)
    } catch (error) {
      const message = attachmentErrorMessage(error, "Attachment update failed. Please try again.")
      setAttachmentError(message)
      showToast(message)
    } finally {
      setAttachmentAction(null)
    }
  }

  const handleAddAttachment = async (file: File) => {
    await runAttachmentAction("add", "Attachment added", async () => {
      const uploaded = await uploadFileApi(file, record.locationId)
      await addRecordAttachmentApi(id, uploaded.id)
    })
  }

  const handleRemoveAttachment = async (attachment: { fileId?: string; name: string }) => {
    if (!attachment.fileId || !window.confirm("Remove " + attachment.name + " from this record?")) return
    await runAttachmentAction("remove:" + attachment.fileId, "Attachment removed", async () => {
      await removeRecordAttachmentApi(id, attachment.fileId!)
    })
  }

  const handleReplaceAttachment = async (attachment: { fileId?: string; name: string }, file: File) => {
    if (!attachment.fileId) return
    await runAttachmentAction("replace:" + attachment.fileId, "Attachment replaced", async () => {
      const uploaded = await uploadFileApi(file, record.locationId)
      await replaceRecordAttachmentApi(id, attachment.fileId!, uploaded.id)
    })
  }

  const isArchived = record.status === "Archived"
  const canManageAttachments = !isDemoMode && !isArchived
  const displayedAttachments = record.attachments
    ?? record.fileNames.map((name) => ({ fileId: undefined, name }))
  const operationsRecord = isOperationsRecord(record)
  const backHref = operationsRecord ? "/operations" : "/records"

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {operationsRecord ? "Operations" : "Compliance"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Header card */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="break-words text-lg font-semibold leading-snug text-foreground">{record.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={record.status} />
                  <WorkspaceBadge workspace={getRecordWorkspace(record)} />
                  {record.category !== "Operations" && <CategoryBadge category={record.category} />}
                  {operationsRecord && record.recordType && (
                    <span className="inline-flex max-w-full items-center whitespace-normal rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-left text-xs font-medium text-blue-700">
                      {record.recordType}
                    </span>
                  )}
                  {isArchived && (
                    <span className="text-xs text-muted-foreground italic">
                      This record is archived. Owners can restore it.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Meta grid */}
            <dl className="mt-5 grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 sm:grid-cols-3 [&>div]:min-w-0 [&_dd]:break-words">
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Location
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  <Link href={`/locations/${record.locationId}`} className="hover:underline hover:text-primary">
                    {location?.name ?? "—"}
                  </Link>
                </dd>
              </div>
              {record.classroomAgeGroup && (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    Classroom / Age Group
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{record.classroomAgeGroup}</dd>
                </div>
              )}
              {record.observationMonth && (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Observation Month
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {new Date(`${record.observationMonth}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </dd>
                </div>
              )}
              {record.area && (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Area
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{record.area}</dd>
                </div>
              )}
              {record.reportingPeriod && record.reportingPeriod.cadence !== "NONE" && (
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Reporting Period
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{reportingPeriodLabel(record.reportingPeriod)}</dd>
                </div>
              )}
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <User className="h-3 w-3" />
                  Uploaded By
                </dt>
                <dd className="mt-1 text-sm text-foreground">{record.uploadedBy}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Upload Date
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Date(record.uploadDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Last Updated
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Date(record.lastUpdated).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
              {record.relatedRef && (
                <div className="min-[390px]:col-span-2">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    Related Ref
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{record.relatedRef}</dd>
                </div>
              )}
            </dl>

            {record.description && (
              <div className="mt-5 rounded-lg bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-1.5 break-words text-sm leading-relaxed text-foreground">{record.description}</p>
              </div>
            )}
          </div>

          {/* Attached Files */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Attached Documents <span className="font-normal text-muted-foreground">({displayedAttachments.length})</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">PDF, JPG, and PNG files attached to this record.</p>
            </div>
            {attachmentError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{attachmentError}</span>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {displayedAttachments.map((attachment, index) => (
                <div
                  key={attachment.fileId ?? attachment.name + ":" + index}
                  className="group flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => handleView(attachment)}
                    className="min-w-0 flex-1 truncate rounded px-1 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={attachment.name}
                  >
                    {attachment.name}
                  </button>
                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleView(attachment)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View ${attachment.name}`}
                      title="View"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownload(attachment)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Download ${attachment.name}`}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {canManageAttachments && attachment.fileId && (
                      <>
                        <label
                          className={cn(
                            "cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
                            attachmentAction && "pointer-events-none opacity-60"
                          )}
                          title="Replace"
                        >
                          {attachmentAction === "replace:" + attachment.fileId
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                          <span className="sr-only">Replace {attachment.name}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="sr-only"
                            disabled={attachmentAction !== null}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0]
                              event.currentTarget.value = ""
                              if (file) void handleReplaceAttachment(attachment, file)
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleRemoveAttachment(attachment)}
                          disabled={attachmentAction !== null}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                          aria-label={`Remove ${attachment.name}`}
                          title="Remove"
                        >
                          {attachmentAction === "remove:" + attachment.fileId
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {displayedAttachments.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No attachments.
                </p>
              )}
            </div>
            {canManageAttachments && (
              <label
                className={cn(
                  "mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring",
                  attachmentAction && "pointer-events-none opacity-60"
                )}
              >
                {attachmentAction === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Add Attachment
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  disabled={attachmentAction !== null}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    if (file) void handleAddAttachment(file)
                  }}
                />
              </label>
            )}
          </div>

          {/* Comments */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Comments{" "}
              <span className="ml-1 text-muted-foreground font-normal">({recordComments.length})</span>
            </h2>

            {recordComments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No comments yet. Start the conversation below.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {recordComments.map((cmt) => (
                  <div key={cmt.id} className="flex gap-3 [animation:page-enter_180ms_ease-out_both]">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        cmt.role === "owner"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-teal-100 text-teal-700"
                      )}
                    >
                      {cmt.user
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="break-words text-sm font-medium text-foreground">{cmt.user}</span>
                        <span className="text-[10px] capitalize text-muted-foreground">
                          {cmt.role}
                        </span>
                        <span className="basis-full text-[11px] text-muted-foreground sm:ml-auto sm:basis-auto">
                          {new Date(cmt.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mt-1 break-words rounded-lg px-3 py-3 text-sm leading-relaxed text-foreground sm:px-4",
                          cmt.isUnread ? "bg-blue-50 border border-blue-100" : "bg-muted/40"
                        )}
                      >
                        <MentionText text={cmt.text} mentions={cmt.mentions} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isArchived && (
              <div className="mt-4 flex gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    role === "owner" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700"
                  )}
                >
                  {currentUser.initials}
                </div>
                <MentionCommentComposer
                  locationId={record.locationId}
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleComment}
                  currentUserId={currentUser.id}
                  isDemoMode={isDemoMode}
                  rows={2}
                  placeholder="Add a comment or follow-up note..."
                  submitLabel="Send"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Actions + Activity */}
        <div className="min-w-0 space-y-4">
          {/* Actions */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            <div className="mt-3 space-y-2">
              {!isArchived && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Record
                </Button>
              )}

              {role === "owner" && !isArchived && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => updateRecordStatus(id, "Reviewed")}
                    disabled={record.status === "Reviewed"}
                    aria-pressed={record.status === "Reviewed"}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Reviewed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => updateRecordStatus(id, "Needs Attention")}
                    disabled={record.status === "Needs Attention"}
                    aria-pressed={record.status === "Needs Attention"}
                  >
                    <AlertCircle className="h-4 w-4" />
                    Mark Needs Attention
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => setArchiveDialogOpen(true)}
                  >
                    <Archive className="h-4 w-4" />
                    Archive Record
                  </Button>
                </>
              )}

              {role === "owner" && isArchived && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-primary"
                  onClick={() => {
                    restoreRecord(id)
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore Record
                </Button>
              )}

              {role !== "owner" && isArchived && (
                <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
                  This record is archived. Only an Owner / Admin can restore it.
                </p>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Activity</h2>
            <div className="mt-4 space-y-4">
              {activityError && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{activityError}</p>
                  <Button variant="ghost" size="sm" onClick={() => void refreshRecordActivity()}>Retry</Button>
                </div>
              )}
              {activityLoading && recordActivity.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading activity...</div>
              )}
              {visibleActivity.map((event, index) => {
                const Icon = activityIconFor(event.action)
                return (
                  <div key={event.id} className="relative flex gap-3">
                    {index < visibleActivity.length - 1 && <span className="absolute left-3.5 top-7 h-full w-px bg-border" />}
                    <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card"><Icon className="h-3 w-3 text-muted-foreground" /></span>
                    <div className="min-w-0 pb-1">
                      <p className="break-words text-xs font-medium leading-snug text-foreground">{event.message}</p>
                      <p className="mt-1 break-words text-[10px] text-muted-foreground">
                        {event.actorDisplayName ?? "System"} &middot; {new Date(event.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )
              })}
              {!activityLoading && !activityError && recordActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity available.</p>}
              {recordActivity.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs text-muted-foreground"
                  onClick={() => setExpandedActivityId(showAllActivity ? null : id)}
                  aria-expanded={showAllActivity}
                >
                  {showAllActivity ? "Show less" : "Show all activity"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={archiveDialogOpen} onOpenChange={(open) => { if (!archiveSubmitting) setArchiveDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this record?</DialogTitle>
            <DialogDescription>This record will be removed from active views but its history will be preserved. An Owner can restore it later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={archiveSubmitting}>Keep Active</Button>
            <Button variant="destructive" disabled={archiveSubmitting} onClick={async () => {
              setArchiveSubmitting(true)
              const archived = await archiveRecord(id)
              setArchiveSubmitting(false)
              if (archived) {
                setArchiveDialogOpen(false)
                router.push(backHref)
              }
            }}>
              {archiveSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Archive Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditRecordModal open={editOpen} onClose={() => setEditOpen(false)} record={record} />
      <FilePreviewModal
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        fileId={previewFile?.fileId ?? null}
        filename={previewFile?.name ?? ""}
      />
    </div>
  )
}
