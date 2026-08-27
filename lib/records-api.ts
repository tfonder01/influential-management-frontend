import { apiClient, type ApiClientError } from "./api-client"
import type {
  ClassroomAgeGroup,
  Comment,
  ComplianceCategory,
  ComplianceRecord,
  OperationsRecordType,
  RecordStatus,
  RecordWorkspace,
  ReportingCadence,
  ReportingPeriod,
} from "./types"

/**
 * Backend <-> frontend adapters for the Sprint 2 Compliance/Operations records API.
 * The backend persists stable enum names (e.g. "CCIR_CRITICAL_INCIDENTS") while the
 * frontend displays business labels (e.g. "CCIR / Critical Incidents"); this module is
 * the single place those two vocabularies are translated, so UI/business wording can
 * change without touching persisted data.
 */

const COMPLIANCE_CATEGORY_TO_API: Record<ComplianceCategory, string> = {
  "Licensing": "LICENSING",
  "Health & Safety": "HEALTH_SAFETY",
  "Drills": "DRILLS",
  "Child Files": "CHILD_FILES",
  "Staff Files": "STAFF_FILES",
  "Classroom Observations": "CLASSROOM_OBSERVATIONS",
  "CCIR / Critical Incidents": "CCIR_CRITICAL_INCIDENTS",
  "Parent Complaints": "PARENT_COMPLAINTS",
  "Staff Complaints": "STAFF_COMPLAINTS",
}
const COMPLIANCE_CATEGORY_FROM_API: Record<string, ComplianceCategory> = Object.fromEntries(
  Object.entries(COMPLIANCE_CATEGORY_TO_API).map(([label, api]) => [api, label as ComplianceCategory])
)

const OPERATIONS_TYPE_TO_API: Record<OperationsRecordType, string> = {
  "Opening Checklist": "OPENING_CHECKLIST",
  "Closing Checklist": "CLOSING_CHECKLIST",
  "Playground Checklist": "PLAYGROUND_CHECKLIST",
  "Cleaning Checklist": "CLEANING_CHECKLIST",
  "Other Operations Record": "OTHER",
}
const OPERATIONS_TYPE_FROM_API: Record<string, OperationsRecordType> = Object.fromEntries(
  Object.entries(OPERATIONS_TYPE_TO_API).map(([label, api]) => [api, label as OperationsRecordType])
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

const REVIEW_STATUS_FROM_API: Record<string, RecordStatus> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  NEEDS_ATTENTION: "Needs Attention",
}
const REVIEW_STATUS_TO_API: Record<"Reviewed" | "Needs Attention", string> = {
  Reviewed: "REVIEWED",
  "Needs Attention": "NEEDS_ATTENTION",
}

export interface ApiReportingPeriod {
  cadence: ReportingCadence
  weekOf: string | null
  month: number | null
  year: number | null
}

export interface ApiRecordSummary {
  id: string
  locationId: string
  locationName: string | null
  recordArea: "COMPLIANCE" | "OPERATIONS"
  complianceCategory: string | null
  operationsType: string | null
  title: string
  customTitle: boolean
  recordType: string | null
  classroomAgeGroup: string | null
  area: string | null
  referenceLabel: string | null
  recordDate: string
  reviewStatus: string
  archived: boolean
  archivedAt: string | null
  reportingPeriod: ApiReportingPeriod
  createdByUserId: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiAttachment {
  fileId: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface ApiRecordDetail extends ApiRecordSummary {
  description: string | null
  updatedByUserId: string | null
  updatedByName: string | null
  attachments: ApiAttachment[]
  commentCount: number
}

export interface ApiComment {
  id: string
  authorUserId: string
  authorName: string | null
  body: string
  createdAt: string
}

export interface ApiPage<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function reportingPeriodToApi(period: ReportingPeriod | undefined): {
  reportingCadence: ReportingCadence
  weekOf?: string
  month?: number
  year?: number
} {
  if (!period || period.cadence === "NONE") return { reportingCadence: "NONE" }
  if (period.cadence === "WEEKLY") return { reportingCadence: "WEEKLY", weekOf: period.weekOf }
  return { reportingCadence: "MONTHLY", month: period.month ? Number(period.month) : undefined, year: period.year ? Number(period.year) : undefined }
}

function reportingPeriodFromApi(period: ApiReportingPeriod): ReportingPeriod {
  if (period.cadence === "WEEKLY" && period.weekOf) return { cadence: "WEEKLY", weekOf: period.weekOf }
  if (period.cadence === "MONTHLY" && period.month && period.year) {
    return { cadence: "MONTHLY", month: String(period.month).padStart(2, "0"), year: String(period.year) }
  }
  return { cadence: "NONE" }
}

export function recordFromApi(record: ApiRecordSummary): ComplianceRecord {
  const workspace: RecordWorkspace = record.recordArea === "OPERATIONS" ? "operations" : "compliance"
  const category = workspace === "operations" ? "Operations" : (record.complianceCategory ? COMPLIANCE_CATEGORY_FROM_API[record.complianceCategory] : "Operations")
  const classroomAgeGroup = record.classroomAgeGroup ? CLASSROOM_FROM_API[record.classroomAgeGroup] : undefined
  const reportingPeriod = reportingPeriodFromApi(record.reportingPeriod)
  const observationMonth =
    category === "Classroom Observations" && reportingPeriod.cadence === "MONTHLY" && reportingPeriod.month && reportingPeriod.year
      ? `${reportingPeriod.year}-${reportingPeriod.month}`
      : undefined

  return {
    id: record.id,
    title: record.title,
    customTitle: record.customTitle,
    locationId: record.locationId,
    category,
    workspace,
    recordType: workspace === "operations" && record.operationsType ? OPERATIONS_TYPE_FROM_API[record.operationsType] : undefined,
    recordTypeLabel: record.recordType ?? undefined,
    status: record.archived ? "Archived" : (REVIEW_STATUS_FROM_API[record.reviewStatus] ?? "New"),
    uploadedBy: record.createdByName ?? "Unknown",
    uploadedById: record.createdByUserId,
    uploadDate: record.recordDate,
    lastUpdated: record.updatedAt.slice(0, 10),
    description: "",
    fileNames: [],
    tags: [],
    relatedRef: record.referenceLabel ?? undefined,
    classroomAgeGroup,
    observationMonth,
    area: record.area ?? undefined,
    reportingPeriod: reportingPeriod.cadence === "NONE" ? undefined : reportingPeriod,
  }
}

export interface RecordDetailResult {
  record: ComplianceRecord
  fileNames: string[]
  attachments: ApiAttachment[]
  commentCount: number
  createdByName: string | null
  updatedByName: string | null
}

export function recordDetailFromApi(record: ApiRecordDetail): RecordDetailResult {
  const base = recordFromApi(record)
  return {
    record: {
      ...base,
      description: record.description ?? "",
      fileNames: record.attachments.map((a) => a.originalFilename),
      attachments: record.attachments.map((a) => ({ fileId: a.fileId, name: a.originalFilename })),
    },
    fileNames: record.attachments.map((a) => a.originalFilename),
    attachments: record.attachments,
    commentCount: record.commentCount,
    createdByName: record.createdByName,
    updatedByName: record.updatedByName,
  }
}

/**
 * The comments API does not return each author's role (only ~12 internal users exist and the
 * frontend has no "list org users" endpoint yet), so we can only reliably color the current
 * user's own comments by their known role; other authors fall back to a neutral "director" style.
 */
export function commentFromApi(comment: ApiComment, recordId: string, currentUserId: string, currentUserRole: Comment["role"]): Comment {
  return {
    id: comment.id,
    recordId,
    user: comment.authorName ?? "Unknown",
    userId: comment.authorUserId,
    role: comment.authorUserId === currentUserId ? currentUserRole : "director",
    text: comment.body,
    timestamp: comment.createdAt,
  }
}

export interface ListRecordsParams {
  recordArea?: "COMPLIANCE" | "OPERATIONS"
  archived?: boolean
  page?: number
  size?: number
}

export async function listRecords(params: ListRecordsParams = {}): Promise<ComplianceRecord[]> {
  const query = new URLSearchParams()
  if (params.recordArea) query.set("recordArea", params.recordArea)
  query.set("archived", String(params.archived ?? false))
  query.set("size", String(params.size ?? 100))
  query.set("page", String(params.page ?? 0))
  query.set("sort", "createdAt,desc")
  const page = await apiClient.request<ApiPage<ApiRecordSummary>>(`/api/records?${query.toString()}`)
  return page.content.map(recordFromApi)
}

/** Fetches both active and archived records so the frontend can render Archived-status rows. */
export async function listAllRecords(): Promise<ComplianceRecord[]> {
  const [active, archived] = await Promise.all([listRecords({ archived: false }), listRecords({ archived: true })])
  return [...active, ...archived]
}

export async function getRecordDetail(id: string): Promise<RecordDetailResult> {
  const record = await apiClient.request<ApiRecordDetail>(`/api/records/${id}`)
  return recordDetailFromApi(record)
}

export interface CreateRecordInput {
  locationId: string
  workspace: RecordWorkspace
  complianceCategory?: ComplianceCategory
  operationsType?: OperationsRecordType
  title: string
  customTitle: boolean
  recordType?: string
  classroomAgeGroup?: ClassroomAgeGroup
  area?: string
  referenceLabel?: string
  recordDate: string
  description?: string
  reportingPeriod?: ReportingPeriod
  fileId?: string
}

export async function createRecordApi(input: CreateRecordInput): Promise<ComplianceRecord> {
  const period = reportingPeriodToApi(input.reportingPeriod)
  const body = {
    locationId: input.locationId,
    recordArea: input.workspace === "operations" ? "OPERATIONS" : "COMPLIANCE",
    complianceCategory: input.workspace === "compliance" && input.complianceCategory ? COMPLIANCE_CATEGORY_TO_API[input.complianceCategory] : undefined,
    operationsType: input.workspace === "operations" && input.operationsType ? OPERATIONS_TYPE_TO_API[input.operationsType] : undefined,
    title: input.title,
    customTitle: input.customTitle,
    recordType: input.recordType,
    classroomAgeGroup: input.classroomAgeGroup ? CLASSROOM_TO_API[input.classroomAgeGroup] : undefined,
    area: input.area,
    referenceLabel: input.referenceLabel,
    recordDate: input.recordDate,
    description: input.description,
    fileId: input.fileId,
    ...period,
  }
  const record = await apiClient.request<ApiRecordDetail>("/api/records", { method: "POST", body: JSON.stringify(body) })
  return recordFromApi(record)
}

export interface UpdateRecordInput {
  title: string
  customTitle: boolean
  complianceCategory?: ComplianceCategory
  operationsType?: OperationsRecordType
  recordType?: string
  classroomAgeGroup?: ClassroomAgeGroup
  area?: string
  referenceLabel?: string
  recordDate: string
  description?: string
  reportingPeriod?: ReportingPeriod
}

export async function updateRecordApi(id: string, input: UpdateRecordInput): Promise<RecordDetailResult> {
  const period = reportingPeriodToApi(input.reportingPeriod)
  const body = {
    title: input.title,
    customTitle: input.customTitle,
    complianceCategory: input.complianceCategory ? COMPLIANCE_CATEGORY_TO_API[input.complianceCategory] : undefined,
    operationsType: input.operationsType ? OPERATIONS_TYPE_TO_API[input.operationsType] : undefined,
    recordType: input.recordType,
    classroomAgeGroup: input.classroomAgeGroup ? CLASSROOM_TO_API[input.classroomAgeGroup] : undefined,
    area: input.area,
    referenceLabel: input.referenceLabel,
    recordDate: input.recordDate,
    description: input.description,
    ...period,
  }
  const record = await apiClient.request<ApiRecordDetail>(`/api/records/${id}`, { method: "PATCH", body: JSON.stringify(body) })
  return recordDetailFromApi(record)
}

export async function updateRecordStatusApi(id: string, status: "Reviewed" | "Needs Attention"): Promise<ComplianceRecord> {
  const record = await apiClient.request<ApiRecordDetail>(`/api/records/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: REVIEW_STATUS_TO_API[status] }),
  })
  return recordFromApi(record)
}

export async function archiveRecordApi(id: string): Promise<ComplianceRecord> {
  const record = await apiClient.request<ApiRecordDetail>(`/api/records/${id}/archive`, { method: "POST" })
  return recordFromApi(record)
}

export async function restoreRecordApi(id: string): Promise<ComplianceRecord> {
  const record = await apiClient.request<ApiRecordDetail>(`/api/records/${id}/restore`, { method: "POST" })
  return recordFromApi(record)
}

export async function listCommentsApi(id: string): Promise<ApiComment[]> {
  return apiClient.request<ApiComment[]>(`/api/records/${id}/comments`)
}

export async function addCommentApi(id: string, body: string): Promise<ApiComment> {
  return apiClient.request<ApiComment>(`/api/records/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) })
}

export interface ApiFileMetadata {
  id: string
  locationId: string | null
  originalFilename: string
  contentType: string
  sizeBytes: number
  storageProvider: string
  uploadedBy: string
  createdAt: string
}

export async function uploadFileApi(file: File, locationId: string): Promise<ApiFileMetadata> {
  const form = new FormData()
  form.append("file", file)
  return apiClient.request<ApiFileMetadata>(`/api/files?locationId=${encodeURIComponent(locationId)}`, {
    method: "POST",
    body: form,
  })
}

export async function addRecordAttachmentApi(recordId: string, fileId: string): Promise<ApiAttachment> {
  return apiClient.request<ApiAttachment>("/api/records/" + recordId + "/attachments", {
    method: "POST",
    body: JSON.stringify({ fileId }),
  })
}

export async function removeRecordAttachmentApi(recordId: string, fileId: string): Promise<void> {
  await apiClient.request<void>("/api/records/" + recordId + "/attachments/" + fileId, { method: "DELETE" })
}

export async function replaceRecordAttachmentApi(recordId: string, oldFileId: string, newFileId: string): Promise<ApiAttachment> {
  return apiClient.request<ApiAttachment>("/api/records/" + recordId + "/attachments/" + oldFileId, {
    method: "PUT",
    body: JSON.stringify({ fileId: newFileId }),
  })
}

/** Downloads an authorized file and triggers a browser save, without ever exposing a public storage URL. */
export async function downloadFileApi(fileId: string, filename: string): Promise<void> {
  const blob = await apiClient.requestBlob(`/api/files/${fileId}/content`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Fetches an authorized file for inline viewing (same authorization path as download, just a
 * different Content-Disposition) and returns a short-lived object URL plus its content type, so
 * the caller can render a preview without ever exposing a public storage URL. The caller owns the
 * returned object URL and must revoke it (e.g. `URL.revokeObjectURL`) once the preview is closed.
 */
export async function viewFileApi(fileId: string): Promise<{ url: string; contentType: string }> {
  const blob = await apiClient.requestBlob(`/api/files/${fileId}/content?disposition=inline`)
  return { url: URL.createObjectURL(blob), contentType: blob.type }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return typeof error === "object" && error !== null && "status" in error && "code" in error
}
