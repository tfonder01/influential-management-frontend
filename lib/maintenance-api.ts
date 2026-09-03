import { apiClient } from "./api-client"
import type { CommentMention } from "./mentions-api"
import {
  downloadFileApi,
  isApiClientError,
  type ApiPage,
  uploadFileApi,
  viewFileApi,
} from "./records-api"
import type {
  ClassroomAgeGroup,
  Comment,
  MaintenanceApprovalStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceStatus,
} from "./types"

/**
 * Backend <-> frontend adapters for the Maintenance API.
 * The backend persists stable enum names (e.g. "APPROVED_READY") while the frontend keeps
 * business-facing labels (e.g. "Approved / Ready"); this module is the single translation
 * layer between those vocabularies so UI wording can evolve without touching persisted data.
 */

const MAINTENANCE_CATEGORY_TO_API: Record<MaintenanceCategory, string> = {
  Plumbing: "PLUMBING",
  Electrical: "ELECTRICAL",
  HVAC: "HVAC",
  Appliance: "APPLIANCE_EQUIPMENT",
  "Furniture / Fixture": "FURNITURE_FIXTURES",
  "Building / Facility": "BUILDING_FACILITY",
  Playground: "PLAYGROUND_EXTERIOR",
  Safety: "SAFETY",
  "Cleaning / Sanitation": "CLEANING_SANITATION",
  Other: "OTHER",
}
const MAINTENANCE_CATEGORY_FROM_API: Record<string, MaintenanceCategory> = Object.fromEntries(
  Object.entries(MAINTENANCE_CATEGORY_TO_API).map(([label, api]) => [api, label as MaintenanceCategory])
)

const MAINTENANCE_PRIORITY_TO_API: Record<MaintenancePriority, string> = {
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
  Urgent: "URGENT",
}
const MAINTENANCE_PRIORITY_FROM_API: Record<string, MaintenancePriority> = Object.fromEntries(
  Object.entries(MAINTENANCE_PRIORITY_TO_API).map(([label, api]) => [api, label as MaintenancePriority])
)

const MAINTENANCE_STATUS_TO_API: Record<MaintenanceStatus, string> = {
  Submitted: "SUBMITTED",
  "Approved / Ready": "APPROVED_READY",
  "In Progress": "IN_PROGRESS",
  Waiting: "WAITING",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
}
const MAINTENANCE_STATUS_FROM_API: Record<string, MaintenanceStatus> = Object.fromEntries(
  Object.entries(MAINTENANCE_STATUS_TO_API).map(([label, api]) => [api, label as MaintenanceStatus])
)

const MAINTENANCE_APPROVAL_TO_API: Record<MaintenanceApprovalStatus, string> = {
  "Not Required": "NOT_REQUIRED",
  "Awaiting Approval": "AWAITING_APPROVAL",
  Approved: "APPROVED",
  "Needs Information": "NEEDS_INFORMATION",
  Declined: "DECLINED",
}
const MAINTENANCE_APPROVAL_FROM_API: Record<string, MaintenanceApprovalStatus> = Object.fromEntries(
  Object.entries(MAINTENANCE_APPROVAL_TO_API).map(([label, api]) => [api, label as MaintenanceApprovalStatus])
)

const CLASSROOM_TO_API: Record<ClassroomAgeGroup, string> = {
  Infant: "INFANT",
  Toddler: "TODDLER",
  Twaddler: "TWADDLER",
  Prepper: "PREPPER",
  Preschool: "PRESCHOOL",
}
const CLASSROOM_FROM_API: Record<string, ClassroomAgeGroup> = Object.fromEntries(
  Object.entries(CLASSROOM_TO_API).map(([label, api]) => [api, label as ClassroomAgeGroup])
)

const CLASSROOM_AREAS = new Set<ClassroomAgeGroup>(Object.keys(CLASSROOM_TO_API) as ClassroomAgeGroup[])

export type ApiMaintenanceAttachmentType = "ISSUE_PHOTO" | "COMPLETION_PHOTO" | "INVOICE" | "OTHER"

export interface ApiMaintenanceSummary {
  id: string
  requestNumber: number
  locationId: string
  locationName: string | null
  title: string
  category: string
  priority: string
  status: string
  approvalStatus: string
  needsMoreInfo: boolean
  classroomAgeGroup: string | null
  area: string | null
  assignedTo: string | null
  assignedUserId: string | null
  assignedUserName: string | null
  assignedUserRole: string | null
  vendorName: string | null
  scheduledDate: string | null
  estimatedCost: number | null
  finalCost: number | null
  completedAt: string | null
  archived: boolean
  archivedAt: string | null
  submittedByUserId: string
  submittedByName: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiMaintenanceAttachment {
  fileId: string
  attachmentType: ApiMaintenanceAttachmentType
  displayName: string | null
  originalFilename: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface ApiMaintenanceDetail extends ApiMaintenanceSummary {
  description: string | null
  approvalNote: string | null
  vendorContact: string | null
  updatedByUserId: string | null
  updatedByName: string | null
  attachments: ApiMaintenanceAttachment[]
  commentCount: number
}

export interface ApiMaintenanceComment {
  id: string
  authorUserId: string
  authorName: string | null
  body: string
  createdAt: string
  mentions: CommentMention[]
}

function areaPayload(area?: string): { area?: string; classroomAgeGroup?: string } {
  const trimmedArea = area?.trim()
  if (!trimmedArea) return {}
  const classroomAgeGroup = CLASSROOM_AREAS.has(trimmedArea as ClassroomAgeGroup)
    ? CLASSROOM_TO_API[trimmedArea as ClassroomAgeGroup]
    : undefined
  return { area: trimmedArea, classroomAgeGroup }
}

function attachmentToUiAttachment(
  attachment: ApiMaintenanceAttachment,
  uploadedBy: string
): MaintenanceRequest["originalPhotos"][number] {
  return {
    fileId: attachment.fileId,
    name: attachment.originalFilename,
    displayName: attachment.displayName ?? undefined,
    uploadedAt: attachment.createdAt,
    uploadedBy,
  }
}

export function maintenanceRequestFromApi(record: ApiMaintenanceSummary): MaintenanceRequest {
  const classroomAgeGroup = record.classroomAgeGroup ? CLASSROOM_FROM_API[record.classroomAgeGroup] : undefined
  return {
    id: record.id,
    requestNumber: record.requestNumber,
    title: record.title,
    description: "",
    locationId: record.locationId,
    classroomAgeGroup,
    area: record.area ?? classroomAgeGroup ?? "",
    category: MAINTENANCE_CATEGORY_FROM_API[record.category] ?? "Other",
    priority: MAINTENANCE_PRIORITY_FROM_API[record.priority] ?? "Medium",
    submittedBy: record.submittedByName ?? "Unknown",
    submittedById: record.submittedByUserId,
    createdAt: record.createdAt,
    lastUpdated: record.updatedAt,
    approvalStatus: MAINTENANCE_APPROVAL_FROM_API[record.approvalStatus] ?? "Not Required",
    maintenanceStatus: MAINTENANCE_STATUS_FROM_API[record.status] ?? "Submitted",
    approvalNote: undefined,
    needsMoreInfo: record.needsMoreInfo,
    assignedTo: record.assignedUserName ?? record.assignedTo ?? undefined,
    assignedUserId: record.assignedUserId ?? undefined,
    assignedUserRole: record.assignedUserRole?.toLowerCase() as MaintenanceRequest["assignedUserRole"],
    vendor: record.vendorName ?? undefined,
    vendorContact: undefined,
    scheduledDate: record.scheduledDate ?? undefined,
    estimatedCost: record.estimatedCost ?? undefined,
    finalCost: record.finalCost ?? undefined,
    completedAt: record.completedAt ?? undefined,
    originalPhotos: [],
    completionPhotos: [],
    invoices: [],
    archived: record.archived,
  }
}

export interface MaintenanceDetailResult {
  request: MaintenanceRequest
  attachments: ApiMaintenanceAttachment[]
  commentCount: number
  submittedByName: string | null
  updatedByName: string | null
}

export function maintenanceDetailFromApi(record: ApiMaintenanceDetail): MaintenanceDetailResult {
  const base = maintenanceRequestFromApi(record)
  const uploadedBy = record.updatedByName ?? record.submittedByName ?? "Unknown"
  const originalPhotos = record.attachments
    .filter((attachment) => attachment.attachmentType === "ISSUE_PHOTO")
    .map((attachment) => attachmentToUiAttachment(attachment, uploadedBy))
  const completionPhotos = record.attachments
    .filter((attachment) => attachment.attachmentType === "COMPLETION_PHOTO")
    .map((attachment) => attachmentToUiAttachment(attachment, uploadedBy))
  const invoices = record.attachments
    .filter((attachment) => attachment.attachmentType === "INVOICE" || attachment.attachmentType === "OTHER")
    .map((attachment) => attachmentToUiAttachment(attachment, uploadedBy))

  return {
    request: {
      ...base,
      description: record.description ?? "",
      approvalNote: record.approvalNote ?? undefined,
      vendorContact: record.vendorContact ?? undefined,
      originalPhotos,
      completionPhotos,
      invoices,
    },
    attachments: record.attachments,
    commentCount: record.commentCount,
    submittedByName: record.submittedByName,
    updatedByName: record.updatedByName,
  }
}

export function maintenanceCommentFromApi(
  comment: ApiMaintenanceComment,
  maintenanceId: string,
  currentUserId: string,
  currentUserRole: Comment["role"]
): Comment {
  return {
    id: comment.id,
    recordId: maintenanceId,
    user: comment.authorName ?? "Unknown",
    userId: comment.authorUserId,
    role: comment.authorUserId === currentUserId ? currentUserRole : "director",
    text: comment.body,
    timestamp: comment.createdAt,
    mentions: comment.mentions,
  }
}

export interface ListMaintenanceRequestsParams {
  locationId?: string
  status?: string
  priority?: string
  category?: string
  archived?: boolean
  search?: string
  page?: number
  size?: number
}

export async function listMaintenanceRequests(params: ListMaintenanceRequestsParams = {}): Promise<MaintenanceRequest[]> {
  const query = new URLSearchParams()
  if (params.locationId) query.set("locationId", params.locationId)
  if (params.status) query.set("status", params.status)
  if (params.priority) query.set("priority", params.priority)
  if (params.category) query.set("category", params.category)
  if (params.search) query.set("search", params.search)
  query.set("archived", String(params.archived ?? false))
  query.set("size", String(params.size ?? 100))
  query.set("page", String(params.page ?? 0))
  query.set("sort", "createdAt,desc")
  const page = await apiClient.request<ApiPage<ApiMaintenanceSummary>>(`/api/maintenance?${query.toString()}`)
  return page.content.map(maintenanceRequestFromApi)
}

export async function listAllMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const [active, archived] = await Promise.all([
    listMaintenanceRequests({ archived: false }),
    listMaintenanceRequests({ archived: true }),
  ])
  return [...active, ...archived]
}

export async function getMaintenanceDetail(id: string): Promise<MaintenanceDetailResult> {
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}`)
  return maintenanceDetailFromApi(record)
}

export interface CreateMaintenanceInput {
  locationId: string
  title: string
  description?: string
  category: MaintenanceCategory
  priority: MaintenancePriority
  area?: string
  scheduledDate?: string
  estimatedCost?: number
  approvalRequired: boolean
  fileId?: string
}

export async function createMaintenanceRequestApi(input: CreateMaintenanceInput): Promise<MaintenanceRequest> {
  const body = {
    locationId: input.locationId,
    title: input.title,
    description: input.description,
    category: MAINTENANCE_CATEGORY_TO_API[input.category],
    priority: MAINTENANCE_PRIORITY_TO_API[input.priority],
    scheduledDate: input.scheduledDate,
    estimatedCost: input.estimatedCost,
    approvalRequired: input.approvalRequired,
    fileId: input.fileId,
    ...areaPayload(input.area),
  }
  const record = await apiClient.request<ApiMaintenanceDetail>("/api/maintenance", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return maintenanceDetailFromApi(record).request
}

export interface UpdateMaintenanceInput {
  title: string
  description?: string
  category: MaintenanceCategory
  priority: MaintenancePriority
  classroomAgeGroup?: ClassroomAgeGroup
  area?: string
  assignedUserId?: string | null
  vendorName?: string
  vendorContact?: string
  scheduledDate?: string
  estimatedCost?: number
  finalCost?: number
}

export async function updateMaintenanceRequestApi(id: string, input: UpdateMaintenanceInput): Promise<MaintenanceDetailResult> {
  const area = input.area ?? input.classroomAgeGroup
  const body = {
    title: input.title,
    description: input.description,
    category: MAINTENANCE_CATEGORY_TO_API[input.category],
    priority: MAINTENANCE_PRIORITY_TO_API[input.priority],
    assignedUserId: input.assignedUserId,
    vendorName: input.vendorName,
    vendorContact: input.vendorContact,
    scheduledDate: input.scheduledDate,
    estimatedCost: input.estimatedCost,
    finalCost: input.finalCost,
    ...areaPayload(area),
  }
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
  return maintenanceDetailFromApi(record)
}

export async function changeMaintenanceStatusApi(
  id: string,
  status: "In Progress" | "Waiting" | "Completed" | "Cancelled"
): Promise<MaintenanceRequest> {
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: MAINTENANCE_STATUS_TO_API[status] }),
  })
  return maintenanceDetailFromApi(record).request
}

async function maintenanceAction(
  path: string,
  note?: string
): Promise<MaintenanceRequest> {
  const record = await apiClient.request<ApiMaintenanceDetail>(path, {
    method: "POST",
    ...(note !== undefined ? { body: JSON.stringify({ note }) } : {}),
  })
  return maintenanceDetailFromApi(record).request
}

export async function approveMaintenanceRequestApi(id: string, note?: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/approve`, note)
}

export async function declineMaintenanceRequestApi(id: string, note?: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/decline`, note)
}

export async function requestMaintenanceInfoApi(id: string, note?: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/request-info`, note)
}

export async function resubmitMaintenanceApprovalApi(id: string, note?: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/resubmit`, note)
}

export async function reopenMaintenanceApprovalApi(id: string): Promise<MaintenanceRequest> {
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}/reopen-approval`, {
    method: "POST",
  })
  return maintenanceDetailFromApi(record).request
}

export async function reopenCancelledMaintenanceRequestApi(id: string): Promise<MaintenanceRequest> {
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}/reopen-cancelled`, {
    method: "POST",
  })
  return maintenanceDetailFromApi(record).request
}

export async function reopenCompletedMaintenanceRequestApi(id: string): Promise<MaintenanceRequest> {
  const record = await apiClient.request<ApiMaintenanceDetail>(`/api/maintenance/${id}/reopen-completed`, {
    method: "POST",
  })
  return maintenanceDetailFromApi(record).request
}

export async function archiveMaintenanceRequestApi(id: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/archive`)
}

export async function restoreMaintenanceRequestApi(id: string): Promise<MaintenanceRequest> {
  return maintenanceAction(`/api/maintenance/${id}/restore`)
}

export async function listMaintenanceCommentsApi(id: string): Promise<ApiMaintenanceComment[]> {
  return apiClient.request<ApiMaintenanceComment[]>(`/api/maintenance/${id}/comments`)
}

export async function addMaintenanceCommentApi(id: string, body: string, mentionedUserIds: string[] = []): Promise<ApiMaintenanceComment> {
  return apiClient.request<ApiMaintenanceComment>(`/api/maintenance/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, mentionedUserIds }),
  })
}

export async function addMaintenanceAttachmentApi(
  id: string,
  fileId: string,
  attachmentType: ApiMaintenanceAttachmentType
): Promise<ApiMaintenanceAttachment> {
  return apiClient.request<ApiMaintenanceAttachment>(`/api/maintenance/${id}/attachments`, {
    method: "POST",
    body: JSON.stringify({ fileId, attachmentType }),
  })
}

export async function removeMaintenanceAttachmentApi(id: string, fileId: string): Promise<void> {
  await apiClient.request<void>(`/api/maintenance/${id}/attachments/${fileId}`, { method: "DELETE" })
}

export async function replaceMaintenanceAttachmentApi(
  id: string,
  oldFileId: string,
  newFileId: string,
  attachmentType?: ApiMaintenanceAttachmentType
): Promise<ApiMaintenanceAttachment> {
  return apiClient.request<ApiMaintenanceAttachment>(`/api/maintenance/${id}/attachments/${oldFileId}`, {
    method: "PUT",
    body: JSON.stringify({ fileId: newFileId, attachmentType }),
  })
}

export async function renameMaintenanceAttachmentApi(
  id: string,
  fileId: string,
  displayName: string
): Promise<ApiMaintenanceAttachment> {
  return apiClient.request<ApiMaintenanceAttachment>(`/api/maintenance/${id}/attachments/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ displayName }),
  })
}

export { downloadFileApi, isApiClientError, uploadFileApi, viewFileApi }
