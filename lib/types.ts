export type Role = "owner" | "director" | "assistant_director"
export type RecordStatus = "New" | "Reviewed" | "Needs Attention" | "Archived"
export type ComplianceCategory = "Licensing" | "Health & Safety" | "Drills" | "Child Files" | "Staff Files" | "Classroom Observations" | "CCIR / Critical Incidents" | "Parent Complaints" | "Staff Complaints"
export type LegacyComplianceCategory = "Health & Safety Drills"
export type RecordCategory = ComplianceCategory | "Operations"
export type RecordWorkspace = "compliance" | "operations"
export type OperationsRecordType = "Opening Checklist" | "Closing Checklist" | "Playground Checklist" | "Cleaning Checklist" | "Other Operations Record"
export type ReportingCadence = "WEEKLY" | "MONTHLY" | "NONE"
export interface ReportingPeriod { cadence: ReportingCadence; weekOf?: string; month?: string; year?: string }
export type ClassroomAgeGroup = "Infant" | "Toddler" | "Twaddler" | "Prepper" | "Preschool"
export interface Location { id: string; name: string; director: string; directorId: string; address: string; phone: string; capacity: number }
export interface ComplianceRecord { id: string; title: string; customTitle?: boolean; locationId: string; locationName?: string; category: RecordCategory; workspace?: RecordWorkspace; recordType?: OperationsRecordType; recordTypeLabel?: string; status: RecordStatus; uploadedBy: string; uploadedById: string; uploadDate: string; createdAt?: string; lastUpdated: string; description: string; fileNames: string[]; attachments?: { fileId: string; name: string }[]; tags: string[]; relatedRef?: string; classroomAgeGroup?: ClassroomAgeGroup; observationMonth?: string; area?: string; reportingPeriod?: ReportingPeriod }
export interface ActivityEvent { id: string; recordId: string; type: "created" | "edited" | "status_changed" | "comment_added" | "file_uploaded" | "archived" | "restored"; user: string; userId: string; role: Role; timestamp: string; detail: string }
export interface Comment { id: string; recordId: string; user: string; userId: string; role: Role; text: string; timestamp: string; isUnread?: boolean; mentions?: import("./mentions-api").CommentMention[]; mentionedUserIds?: string[] }
export interface Notification { id: string; type: "upload" | "status_change" | "comment" | "attention" | "maintenance" | "supply"; title: string; message: string; timestamp: string; recordId?: string; source?: "records" | "maintenance" | "supply"; isRead: boolean }
export interface User { id: string; name: string; role: Role; locationId?: string; initials: string }
export type MaintenanceCategory = "Plumbing" | "Electrical" | "HVAC" | "Appliance" | "Furniture / Fixture" | "Playground" | "Building / Facility" | "Safety" | "Cleaning / Sanitation" | "Other"
export type MaintenancePriority = "Low" | "Medium" | "High" | "Urgent"
export type MaintenanceApprovalStatus = "Not Required" | "Awaiting Approval" | "Approved" | "Needs Information" | "Declined"
export type MaintenanceStatus = "Submitted" | "Approved / Ready" | "In Progress" | "Waiting" | "Completed" | "Cancelled"
export interface MaintenanceAttachment { fileId?: string; name: string; displayName?: string; uploadedAt: string; uploadedBy: string }
export interface MaintenanceRequest { id: string; requestNumber?: number; title: string; description: string; locationId: string; classroomAgeGroup?: ClassroomAgeGroup; area: string; category: MaintenanceCategory; priority: MaintenancePriority; submittedBy: string; submittedById: string; createdAt: string; lastUpdated: string; approvalStatus: MaintenanceApprovalStatus; maintenanceStatus: MaintenanceStatus; approvalNote?: string; needsMoreInfo?: boolean; assignedTo?: string; assignedUserId?: string; assignedUserRole?: Role; vendor?: string; vendorContact?: string; scheduledDate?: string; estimatedCost?: number; finalCost?: number; completedAt?: string; originalPhotos: MaintenanceAttachment[]; completionPhotos: MaintenanceAttachment[]; invoices: MaintenanceAttachment[]; assetName?: string; assetType?: string; repeatIssueKey?: string; repeatRepairCount?: number; repeatRecordedCost?: number; repeatRepairPeriodMonths?: number; archived: boolean }
export type SupplyCategory = "Supplies" | "Furniture" | "Fixtures" | "Equipment" | "Other"
export type SupplyPriority = "Low" | "Medium" | "High" | "Urgent"
export type SupplyApprovalStatus = "Not Required" | "Awaiting Approval" | "Needs Information" | "Approved" | "Declined"
export type SupplyStatus = "Submitted" | "Approved / Ready" | "Ordered" | "Waiting / In Transit" | "Received" | "Cancelled"
export type SupplyAttachmentType = "Photo" | "Quote" | "Receipt" | "Invoice" | "Other"
export interface SupplyAttachment { fileId?: string; name: string; displayName?: string; attachmentType?: SupplyAttachmentType; uploadedAt: string; uploadedBy: string }
export interface SupplyRequest { id: string; requestNumber?: number; locationId: string; area?: string; classroomAgeGroup?: ClassroomAgeGroup; category: SupplyCategory; title: string; itemName?: string; description: string; quantity: number; quantityUnit?: string; unitCost?: number; estimatedTotal: number; finalTotal?: number; vendor?: string; vendorContact?: string; productLink?: string; requestedAt: string; neededBy?: string; priority: SupplyPriority; approvalRequired: boolean; approvalStatus: SupplyApprovalStatus; fulfillmentStatus: SupplyStatus; approvalNote?: string; needsMoreInfo?: boolean; submittedBy: string; requestedBy?: string; submittedById: string; requestedById?: string; assignedTo?: string; orderedAt?: string; expectedDeliveryAt?: string; receivedAt?: string; lastUpdated: string; photos: SupplyAttachment[]; archived: boolean }
export type SubmissionStatus = "Upcoming" | "Due Soon" | "Submitted" | "Overdue"
export interface ExpectedSubmission { id: string; locationId: string; recordArea: RecordWorkspace; expectedType: string; cadence: ReportingCadence; periodLabel: string; periodStart: string; dueDate: string; submittedRecordId?: string; submittedDate?: string; status: SubmissionStatus; responsibleUserId?: string }
