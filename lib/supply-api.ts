import { apiClient } from "./api-client"
import { downloadFileApi, isApiClientError, uploadFileApi, viewFileApi } from "./records-api"
import type { ClassroomAgeGroup, Comment, SupplyApprovalStatus, SupplyAttachmentType, SupplyCategory, SupplyPriority, SupplyRequest, SupplyStatus } from "./types"

const CATEGORY_TO_API: Record<SupplyCategory, string> = { Supplies: "SUPPLIES", Furniture: "FURNITURE", Fixtures: "FIXTURES", Equipment: "EQUIPMENT", Other: "OTHER" }
const CATEGORY_FROM_API: Record<string, SupplyCategory> = { SUPPLIES: "Supplies", FURNITURE: "Furniture", FIXTURES: "Fixtures", EQUIPMENT: "Equipment", OTHER: "Other" }
const PRIORITY_TO_API: Record<SupplyPriority, string> = { Low: "LOW", Medium: "MEDIUM", High: "HIGH", Urgent: "URGENT" }
const PRIORITY_FROM_API: Record<string, SupplyPriority> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" }
const APPROVAL_FROM_API: Record<string, SupplyApprovalStatus> = { NOT_REQUIRED: "Not Required", AWAITING_APPROVAL: "Awaiting Approval", NEEDS_INFORMATION: "Needs Information", APPROVED: "Approved", DECLINED: "Declined" }
const STATUS_FROM_API: Record<string, SupplyStatus> = { SUBMITTED: "Submitted", APPROVED_READY: "Approved / Ready", ORDERED: "Ordered", WAITING: "Waiting / In Transit", RECEIVED: "Received", CANCELLED: "Cancelled" }
const CLASSROOM_TO_API: Record<ClassroomAgeGroup, string> = { Infant: "INFANT", Toddler: "TODDLER", Twaddler: "TWADDLER", Prepper: "PREPPER", Preschool: "PRESCHOOL" }
const CLASSROOM_FROM_API: Record<string, ClassroomAgeGroup> = { INFANT: "Infant", TODDLER: "Toddler", TWADDLER: "Twaddler", PREPPER: "Prepper", PRESCHOOL: "Preschool" }
export const ATTACHMENT_TYPE_TO_API: Record<SupplyAttachmentType, ApiSupplyAttachmentType> = { Photo: "REQUEST_PHOTO", Quote: "QUOTE", Receipt: "RECEIPT", Invoice: "INVOICE", Other: "OTHER" }
const ATTACHMENT_TYPE_FROM_API: Record<string, SupplyAttachmentType> = { REQUEST_PHOTO: "Photo", QUOTE: "Quote", RECEIPT: "Receipt", INVOICE: "Invoice", OTHER: "Other" }

export interface ApiSupplyAttachment { fileId: string; attachmentType: string; displayName: string | null; originalFilename: string; contentType: string; sizeBytes: number; createdAt: string }
export interface ApiSupplySummary { id: string; requestNumber: number; locationId: string; locationName: string | null; title: string; category: string; quantity: number; priority: string; approvalStatus: string; status: string; approvalRequired: boolean; classroomAgeGroup: string | null; area: string | null; vendorName: string | null; estimatedCost: number | null; finalCost: number | null; archived: boolean; archivedAt: string | null; submittedByUserId: string; submittedByName: string | null; createdAt: string; updatedAt: string }
export interface ApiSupplyDetail extends ApiSupplySummary { description: string | null; approvalNote: string | null; vendorContact: string | null; orderDate: string | null; expectedDeliveryDate: string | null; receivedDate: string | null; completedAt: string | null; assignedTo: string | null; updatedByUserId: string | null; updatedByName: string | null; attachments: ApiSupplyAttachment[]; commentCount: number }
export interface ApiSupplyComment { id: string; authorUserId: string; authorName: string | null; body: string; createdAt: string }

function toUiAttachments(attachments: ApiSupplyAttachment[], uploadedBy: string): SupplyRequest["photos"] {
  return attachments.map((attachment) => ({ fileId: attachment.fileId, name: attachment.originalFilename, displayName: attachment.displayName ?? undefined, attachmentType: ATTACHMENT_TYPE_FROM_API[attachment.attachmentType], uploadedAt: attachment.createdAt, uploadedBy }))
}

export function supplyRequestFromApi(record: ApiSupplySummary): SupplyRequest {
  const submittedByName = record.submittedByName ?? "Unknown"
  return {
    id: record.id,
    requestNumber: record.requestNumber,
    title: record.title,
    itemName: record.title,
    description: "",
    locationId: record.locationId,
    classroomAgeGroup: record.classroomAgeGroup ? CLASSROOM_FROM_API[record.classroomAgeGroup] : undefined,
    area: record.area ?? "",
    category: CATEGORY_FROM_API[record.category] ?? record.category,
    priority: PRIORITY_FROM_API[record.priority] ?? "Medium",
    quantity: record.quantity,
    quantityUnit: undefined,
    unitCost: undefined,
    estimatedTotal: Number(record.estimatedCost ?? 0),
    finalTotal: record.finalCost ?? undefined,
    vendor: record.vendorName ?? undefined,
    productLink: undefined,
    requestedAt: record.createdAt,
    neededBy: undefined,
    approvalRequired: record.approvalRequired,
    approvalStatus: APPROVAL_FROM_API[record.approvalStatus] ?? "Not Required",
    fulfillmentStatus: STATUS_FROM_API[record.status] ?? "Submitted",
    approvalNote: undefined,
    needsMoreInfo: record.approvalStatus === "NEEDS_INFORMATION",
    submittedBy: submittedByName,
    requestedBy: submittedByName,
    submittedById: record.submittedByUserId,
    requestedById: record.submittedByUserId,
    orderedAt: record.updatedAt,
    receivedAt: undefined,
    lastUpdated: record.updatedAt,
    photos: [],
    archived: record.archived,
  }
}

export function supplyDetailFromApi(record: ApiSupplyDetail) {
  const base = supplyRequestFromApi(record)
  const uploadedBy = record.updatedByName ?? record.submittedByName ?? "Unknown"
  return {
    request: { ...base, description: record.description ?? "", approvalNote: record.approvalNote ?? undefined, vendorContact: record.vendorContact ?? undefined, assignedTo: record.assignedTo ?? undefined, orderedAt: record.orderDate ?? undefined, expectedDeliveryAt: record.expectedDeliveryDate ?? undefined, receivedAt: record.receivedDate ?? undefined, photos: toUiAttachments(record.attachments, uploadedBy) },
    attachments: record.attachments,
    commentCount: record.commentCount,
    submittedByName: record.submittedByName,
    updatedByName: record.updatedByName,
  }
}

export function supplyCommentFromApi(comment: ApiSupplyComment, supplyId: string, currentUserId: string, currentUserRole: Comment["role"]): Comment {
  return { id: comment.id, recordId: supplyId, user: comment.authorName ?? "Unknown", userId: comment.authorUserId, role: comment.authorUserId === currentUserId ? currentUserRole : "director", text: comment.body, timestamp: comment.createdAt }
}

export async function listSupplyRequests(params: { locationId?: string; status?: string; priority?: string; category?: string; archived?: boolean; search?: string; page?: number; size?: number } = {}) {
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
  const page = await apiClient.request<{ content: ApiSupplySummary[] }>(`/api/supply-requests?${query.toString()}`)
  return page.content.map(supplyRequestFromApi)
}

export async function listAllSupplyRequests() { return [...await listSupplyRequests({ archived: false }), ...await listSupplyRequests({ archived: true })] }
export async function getSupplyDetail(id: string) { return supplyDetailFromApi(await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}`)) }
export interface CreateSupplyInput {
  locationId: string
  title: string
  description?: string
  category: SupplyCategory
  quantity: number
  priority: SupplyPriority
  classroomAgeGroup?: ClassroomAgeGroup
  area?: string
  estimatedCost?: number
  approvalRequired: boolean
  fileId?: string
}

export async function createSupplyRequestApi(input: CreateSupplyInput): Promise<SupplyRequest> {
  const record = await apiClient.request<ApiSupplyDetail>("/api/supply-requests", { method: "POST", body: JSON.stringify({ locationId: input.locationId, title: input.title, description: input.description, category: CATEGORY_TO_API[input.category], quantity: input.quantity, priority: PRIORITY_TO_API[input.priority], classroomAgeGroup: input.classroomAgeGroup ? CLASSROOM_TO_API[input.classroomAgeGroup] : undefined, area: input.area, estimatedCost: input.estimatedCost, approvalRequired: input.approvalRequired, fileId: input.fileId }) })
  return supplyDetailFromApi(record).request
}

export interface UpdateSupplyInput {
  title: string
  description?: string
  category: SupplyCategory
  quantity: number
  priority: SupplyPriority
  classroomAgeGroup?: ClassroomAgeGroup
  area?: string
  vendorName?: string
  vendorContact?: string
  estimatedCost?: number
  finalCost?: number
  assignedTo?: string
  orderDate?: string
  expectedDeliveryDate?: string
  receivedDate?: string
}

export async function updateSupplyRequestApi(id: string, input: UpdateSupplyInput) {
  const record = await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}`, { method: "PATCH", body: JSON.stringify({ title: input.title, description: input.description, category: CATEGORY_TO_API[input.category], quantity: input.quantity, priority: PRIORITY_TO_API[input.priority], classroomAgeGroup: input.classroomAgeGroup ? CLASSROOM_TO_API[input.classroomAgeGroup] : undefined, area: input.area, vendorName: input.vendorName, vendorContact: input.vendorContact, estimatedCost: input.estimatedCost, finalCost: input.finalCost, assignedTo: input.assignedTo, orderDate: input.orderDate, expectedDeliveryDate: input.expectedDeliveryDate, receivedDate: input.receivedDate }) })
  return supplyDetailFromApi(record)
}

export async function changeSupplyStatusApi(id: string, status: "Approved / Ready" | "Ordered" | "Waiting / In Transit" | "Received" | "Cancelled"): Promise<SupplyRequest> {
  const apiStatus = Object.entries(STATUS_FROM_API).find(([, label]) => label === status)?.[0] ?? "SUBMITTED"
  const record = await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: apiStatus }) })
  return supplyDetailFromApi(record).request
}

async function supplyAction(path: string, note?: string): Promise<SupplyRequest> {
  const record = await apiClient.request<ApiSupplyDetail>(path, { method: "POST", ...(note !== undefined ? { body: JSON.stringify({ note }) } : {}) })
  return supplyDetailFromApi(record).request
}
export const approveSupplyRequestApi = (id: string, note?: string) => supplyAction(`/api/supply-requests/${id}/approve`, note)
export const declineSupplyRequestApi = (id: string, note?: string) => supplyAction(`/api/supply-requests/${id}/decline`, note)
export const requestSupplyInfoApi = (id: string, note?: string) => supplyAction(`/api/supply-requests/${id}/request-info`, note)
export const resubmitSupplyApprovalApi = (id: string, note?: string) => supplyAction(`/api/supply-requests/${id}/resubmit`, note)
export async function reopenSupplyApprovalApi(id: string): Promise<SupplyRequest> {
  const record = await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}/reopen-approval`, { method: "POST" })
  return supplyDetailFromApi(record).request
}
export async function reopenReceivedSupplyRequestApi(id: string): Promise<SupplyRequest> {
  const record = await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}/reopen-received`, { method: "POST" })
  return supplyDetailFromApi(record).request
}
export async function reopenCancelledSupplyRequestApi(id: string): Promise<SupplyRequest> {
  const record = await apiClient.request<ApiSupplyDetail>(`/api/supply-requests/${id}/reopen-cancelled`, { method: "POST" })
  return supplyDetailFromApi(record).request
}
export const archiveSupplyRequestApi = (id: string) => supplyAction(`/api/supply-requests/${id}/archive`)
export const restoreSupplyRequestApi = (id: string) => supplyAction(`/api/supply-requests/${id}/restore`)
export const listSupplyCommentsApi = (id: string) => apiClient.request<ApiSupplyComment[]>(`/api/supply-requests/${id}/comments`)
export const addSupplyCommentApi = (id: string, body: string) => apiClient.request<ApiSupplyComment>(`/api/supply-requests/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) })
export type ApiSupplyAttachmentType = "REQUEST_PHOTO" | "QUOTE" | "RECEIPT" | "INVOICE" | "OTHER"
export const addSupplyAttachmentApi = (id: string, fileId: string, attachmentType: ApiSupplyAttachmentType) => apiClient.request<ApiSupplyAttachment>(`/api/supply-requests/${id}/attachments`, { method: "POST", body: JSON.stringify({ fileId, attachmentType }) })
export const removeSupplyAttachmentApi = (id: string, fileId: string) => apiClient.request<void>(`/api/supply-requests/${id}/attachments/${fileId}`, { method: "DELETE" })
export const replaceSupplyAttachmentApi = (id: string, oldFileId: string, newFileId: string, attachmentType?: ApiSupplyAttachmentType) => apiClient.request<ApiSupplyAttachment>(`/api/supply-requests/${id}/attachments/${oldFileId}`, { method: "PUT", body: JSON.stringify({ fileId: newFileId, attachmentType }) })
export const renameSupplyAttachmentApi = (id: string, fileId: string, displayName: string) => apiClient.request<ApiSupplyAttachment>(`/api/supply-requests/${id}/attachments/${fileId}`, { method: "PATCH", body: JSON.stringify({ displayName }) })
export { downloadFileApi, isApiClientError, uploadFileApi, viewFileApi }
