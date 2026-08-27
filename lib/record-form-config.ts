import type { ComplianceCategory, OperationsRecordType, ReportingCadence } from "@/lib/types"

/**
 * Field configuration shared between the Upload Record and Edit Record forms, so both flows
 * offer the same record-type choices and reporting-cadence rules for a given category/type.
 */
export const RECORD_TYPE_OPTIONS: Partial<Record<ComplianceCategory, readonly string[]>> = {
  Drills: ["Fire Drill", "Lockdown Drill", "Tornado Drill", "Other Drill"],
  "Health & Safety": ["Health & Safety Inspection", "Safety Checklist Review", "Other Health & Safety Record"],
  Licensing: ["State Licensing Inspection", "Annual DCF Licensing Renewal", "Other Licensing Record"],
  "Child Files": ["Child Enrollment File", "Child File Audit", "Other Child Record"],
  "Staff Files": ["Staff Background Check", "CPR / First Aid Certification", "Staff File Audit", "Other Staff Record"],
  "Parent Complaints": ["Parent Complaint", "Supervision Concern", "Health / Safety Concern", "Other Parent Complaint"],
  "Staff Complaints": ["Workplace Conduct", "Scheduling / Policy", "Other Staff Complaint"],
}

/** Categories/types whose records recur on a reporting cadence, and which cadences are offered. */
export const COMPLIANCE_CADENCE_OPTIONS: Partial<Record<ComplianceCategory, { allowed: ReportingCadence[]; default: ReportingCadence }>> = {
  "Classroom Observations": { allowed: ["MONTHLY"], default: "MONTHLY" },
  Drills: { allowed: ["MONTHLY"], default: "MONTHLY" },
  "Health & Safety": { allowed: ["MONTHLY", "WEEKLY"], default: "MONTHLY" },
}

export const OPERATIONS_CADENCE_OPTIONS: Partial<Record<OperationsRecordType, { allowed: ReportingCadence[]; default: ReportingCadence }>> = {
  "Opening Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Closing Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Playground Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Cleaning Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
}
