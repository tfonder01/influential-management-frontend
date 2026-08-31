export type Role = "owner" | "director" | "assistant_director"

export type RecordStatus = "New" | "Reviewed" | "Needs Attention" | "Archived"

export type ComplianceCategory =
  | "Licensing"
  | "Health & Safety"
  | "Drills"
  | "Child Files"
  | "Staff Files"
  | "Classroom Observations"
  | "CCIR / Critical Incidents"
  | "Parent Complaints"
  | "Staff Complaints"

/** Legacy value retired in favor of separate "Health & Safety" and "Drills" categories. Kept only for migrating old data. */
export type LegacyComplianceCategory = "Health & Safety Drills"

export type RecordCategory = ComplianceCategory | "Operations"
export type RecordWorkspace = "compliance" | "operations"

export type OperationsRecordType =
  | "Opening Checklist"
  | "Closing Checklist"
  | "Playground Checklist"
  | "Cleaning Checklist"
  | "Other Operations Record"

/** How a recurring record's reporting period is represented. NONE = one-time / not recurring. */
export type ReportingCadence = "WEEKLY" | "MONTHLY" | "NONE"

/**
 * Represents the reporting period a record belongs to, independent of the record's upload date.
 * For WEEKLY records, `weekOf` is the Monday that starts the reporting week.
 * For MONTHLY records, `month` (01-12) and `year` are used.
 */
export interface ReportingPeriod {
  cadence: ReportingCadence
  weekOf?: string
  month?: string
  year?: string
}

export type ClassroomAgeGroup =
  | "Infant"
  | "Toddler"
  | "Twaddler"
  | "Prepper"
  | "Preschool"

export interface Location {
  id: string
  name: string
  director: string
  directorId: string
  address: string
  phone: string
  capacity: number
}

export interface ComplianceRecord {
  id: string
  title: string
  /** Whether `title` was manually entered vs. structurally generated from category/period/etc. Undefined in demo mock data defaults to "custom" (preserve as-is) when editing. */
  customTitle?: boolean
  locationId: string
  category: RecordCategory
  workspace?: RecordWorkspace
  recordType?: OperationsRecordType
  /** Free-text Compliance record-type label (e.g. "Fire Drill"), distinct from `recordType` above which is Operations-only. */
  recordTypeLabel?: string
  status: RecordStatus
  uploadedBy: string
  uploadedById: string
  uploadDate: string
  lastUpdated: string
  description: string
  fileNames: string[]
  /** Production-only: real file IDs backing `fileNames`, used to authorize downloads. Empty in demo mode. */
  attachments?: { fileId: string; name: string }[]
  tags: string[]
  relatedRef?: string
  classroomAgeGroup?: ClassroomAgeGroup
  observationMonth?: string
  area?: string
  reportingPeriod?: ReportingPeriod
}

export interface ActivityEvent {
  id: string
  recordId: string
  type:
    | "created"
    | "edited"
    | "status_changed"
    | "comment_added"
    | "file_uploaded"
    | "archived"
    | "restored"
  user: string
  userId: string
  role: Role
  timestamp: string
  detail: string
}

export interface Comment {
  id: string
  recordId: string
  user: string
  userId: string
  role: Role
  text: string
  timestamp: string
  isUnread?: boolean
}

export interface Notification {
  id: string
  type: "upload" | "status_change" | "comment" | "attention" | "maintenance" | "supply"
  title: string
  message: string
  timestamp: string
  recordId?: string
  source?: "records" | "maintenance" | "supply"
  isRead: boolean
}

export interface User {
  id: string
  name: string
  role: Role
  locationId?: string
  initials: string
}

export type MaintenanceCategory =
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Appliance"
  | "Furniture / Fixture"
  | "Playground"
  | "Building / Facility"
  | "Safety"
  | "Cleaning / Sanitation"
  | "Other"

export type MaintenancePriority = "Low" | "Normal" | "High" | "Urgent"
export type MaintenanceApprovalStatus =
  | "Not Required"
  | "Awaiting Approval"
  | "Approved"
  | "Needs Information"
  | "Declined"
export type MaintenanceStatus =
  | "Submitted"
  | "Approved / Ready"
  | "In Progress"
  | "Waiting"
  | "Completed"
  | "Cancelled"

export interface MaintenanceAttachment {
  fileId?: string
  name: string
  displayName?: string
  uploadedAt: string
  uploadedBy: string
}

export interface MaintenanceRequest {
  id: string
  requestNumber?: number
  title: string
  description: string
  locationId: string
  classroomAgeGroup?: ClassroomAgeGroup
  area: string
  category: MaintenanceCategory
  priority: MaintenancePriority
  submittedBy: string
  submittedById: string
  createdAt: string
  lastUpdated: string
  approvalStatus: MaintenanceApprovalStatus
  maintenanceStatus: MaintenanceStatus
  approvalNote?: string
  needsMoreInfo?: boolean
  assignedTo?: string
  vendor?: string
  vendorContact?: string
  scheduledDate?: string
  estimatedCost?: number
  finalCost?: number
  completedAt?: string
  originalPhotos: MaintenanceAttachment[]
  completionPhotos: MaintenanceAttachment[]
  invoices: MaintenanceAttachment[]
  assetName?: string
  assetType?: string
  repeatIssueKey?: string
  repeatRepairCount?: number
  repeatRecordedCost?: number
  repeatRepairPeriodMonths?: number
  archived: boolean
}

export type SupplyCategory =
  | "Classroom Supplies"
  | "Furniture"
  | "Fixtures"
  | "Equipment"
  | "Office Supplies"
  | "Cleaning / Sanitation"
  | "Safety"
  | "Technology"
  | "Replacement Item"
  | "Other"

export type SupplyPriority = MaintenancePriority
export type SupplyApprovalStatus = MaintenanceApprovalStatus
export type SupplyStatus = "Submitted" | "Ready to Order" | "Ordered" | "Received" | "Cancelled"

export interface SupplyAttachment {
  name: string
  uploadedAt: string
  uploadedBy: string
}

export interface SupplyRequest {
  id: string
  locationId: string
  area?: string
  classroomAgeGroup?: ClassroomAgeGroup
  category: SupplyCategory
  itemName: string
  description: string
  quantity: number
  quantityUnit?: string
  unitCost?: number
  estimatedTotal: number
  finalTotal?: number
  vendor?: string
  productLink?: string
  requestedAt: string
  neededBy?: string
  priority: SupplyPriority
  approvalRequired: boolean
  approvalStatus: SupplyApprovalStatus
  fulfillmentStatus: SupplyStatus
  approvalNote?: string
  needsMoreInfo?: boolean
  requestedBy: string
  requestedById: string
  orderedAt?: string
  receivedAt?: string
  lastUpdated: string
  photos: SupplyAttachment[]
  archived: boolean
}

/**
 * Foundation types for deadline / expected-submission tracking (reminders sprint prep).
 * These describe what a *recurring* submission requirement looks like so overdue/due-soon
 * state can be derived rather than manually flagged. Due-day business rules are not yet
 * confirmed by the client — see lib/deadlines.ts for the placeholder assumptions in use.
 */
export type SubmissionStatus = "Upcoming" | "Due Soon" | "Submitted" | "Overdue"

export interface ExpectedSubmission {
  id: string
  locationId: string
  recordArea: RecordWorkspace
  /** ComplianceCategory or OperationsRecordType label this expectation covers. */
  expectedType: string
  cadence: ReportingCadence
  /** Human-readable label for the period, e.g. "August 2026" or "Week of Aug 17, 2026". */
  periodLabel: string
  periodStart: string
  dueDate: string
  submittedRecordId?: string
  submittedDate?: string
  status: SubmissionStatus
  /** Optional user/role this submission is expected from, when known. */
  responsibleUserId?: string
}
