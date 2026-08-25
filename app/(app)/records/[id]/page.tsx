"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  Download,
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
} from "lucide-react"
import { useApp } from "@/lib/store"
import { StatusBadge } from "@/components/status-badge"
import { CategoryBadge } from "@/components/category-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Comment } from "@/lib/types"
import { getRecordWorkspace, isOperationsRecord } from "@/lib/record-workspaces"
import { WorkspaceBadge } from "@/components/workspace-badge"
import { reportingPeriodLabel } from "@/lib/reporting-period"
import { getRecordDetail, downloadFileApi, isApiClientError } from "@/lib/records-api"

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  created: FileText,
  edited: RefreshCw,
  status_changed: CheckCircle2,
  comment_added: Send,
  file_uploaded: FileText,
  archived: Archive,
  restored: RotateCcw,
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
  const recordActivity = activity
    .filter((a) => a.recordId === id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const handleComment = () => {
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
    }
    addComment(comment)
    setCommentText("")
  }

  const handleDownload = async (name: string) => {
    const attachment = record.attachments?.find((a) => a.name === name)
    if (!attachment) {
      showToast(`Download ready: ${name}`)
      return
    }
    try {
      await downloadFileApi(attachment.fileId, attachment.name)
    } catch (error) {
      showToast(isApiClientError(error) ? error.message : "Download failed. Please try again.")
    }
  }

  const isArchived = record.status === "Archived"
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
            <h2 className="text-sm font-semibold text-foreground">Attached Documents</h2>
            <div className="mt-3 space-y-2">
              {record.fileNames.map((name) => (
                <div
                  key={name}
                  className="group flex min-w-0 flex-col items-stretch gap-3 rounded-lg border border-border bg-muted/25 px-3 py-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/20 hover:bg-muted/50 hover:shadow-sm sm:flex-row sm:items-center sm:px-4"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 break-words text-sm text-foreground">{name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(name)}
                    className="flex min-h-10 w-full shrink-0 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:w-auto sm:px-2 sm:py-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              ))}
            </div>
            {role !== "owner" && !isArchived && (
              <button type="button" onClick={() => showToast("Additional file upload is available in the Upload Record flow")} className="mt-3 flex min-h-10 max-w-full items-center gap-2 rounded-md text-left text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                + Upload replacement / additional file
              </button>
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
                        {cmt.text}
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
                <div className="min-w-0 flex-1 space-y-2">
                  <Textarea
                    placeholder="Add a comment or follow-up note..."
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        handleComment()
                      }
                    }}
                    className="text-sm resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="min-h-10 w-full gap-1.5 sm:min-h-8 sm:w-auto"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>
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
              {role === "owner" && !isArchived && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => updateRecordStatus(id, "Reviewed")}
                    disabled={record.status === "Reviewed"}
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
                  >
                    <AlertCircle className="h-4 w-4" />
                    Mark Needs Attention
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => {
                      archiveRecord(id)
                      router.push("/archived")
                    }}
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

              {role !== "owner" && !isArchived && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => showToast("Editing is not available in this prototype")}
                >
                  <RefreshCw className="h-4 w-4" />
                  Edit Record
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
              {recordActivity.map((evt, i) => {
                const Icon = ACTIVITY_ICONS[evt.type] ?? FileText
                return (
                  <div key={evt.id} className="relative flex gap-3">
                    {i < recordActivity.length - 1 && (
                      <div className="absolute left-3.5 top-7 h-full w-px bg-border" />
                    )}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card z-10">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="break-words text-xs font-medium leading-snug text-foreground">{evt.detail}</p>
                      <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                        {evt.user} &middot;{" "}
                        {new Date(evt.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
              {recordActivity.length === 0 && (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
