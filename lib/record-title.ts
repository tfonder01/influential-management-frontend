import { reportingPeriodLabel, startOfWeek } from "@/lib/reporting-period"
import type { ClassroomAgeGroup, ComplianceCategory, OperationsRecordType, ReportingCadence, RecordWorkspace } from "@/lib/types"

/**
 * Shared structured-title generation, used by both record creation (Upload Record) and
 * record editing (Edit Record) so a Compliance/Operations record's auto-generated title stays
 * consistent regardless of which flow last touched it. Only the fields relevant to title
 * generation are required; callers pass whatever they have (creation form state or a record's
 * persisted values merged with in-progress edits).
 */
export interface TitleInputs {
  workspace: RecordWorkspace | ""
  complianceCategory: ComplianceCategory | ""
  operationsType: OperationsRecordType | ""
  classroomAgeGroup: ClassroomAgeGroup | ""
  area: string
  recordType: string
  /** Free-text reference (child/staff name, short descriptor) without any "Child:"/"Staff:" prefix. */
  referenceText: string
  /** Free-text incident/critical-incident description, used only for CCIR / Critical Incidents. */
  incidentText: string
  cadence: ReportingCadence
  weekOf: string
  month: string
  year: string
}

export function periodFromInputs(form: Pick<TitleInputs, "cadence" | "weekOf" | "month" | "year">) {
  if (form.cadence === "WEEKLY") return { cadence: "WEEKLY" as const, weekOf: startOfWeek(form.weekOf) }
  if (form.cadence === "MONTHLY") return { cadence: "MONTHLY" as const, month: form.month, year: form.year }
  return { cadence: "NONE" as const }
}

export function generateRecordTitle(form: TitleInputs): string {
  const period = form.cadence !== "NONE" ? reportingPeriodLabel(periodFromInputs(form)) : ""
  const reference = form.referenceText.trim()
  const incident = form.incidentText.trim()

  if (form.workspace === "operations") {
    if (form.operationsType === "Other Operations Record") {
      return reference ? `Operations — ${reference}` : ""
    }
    if (!form.operationsType || !period) return ""
    const prefix = form.area.trim() ? `${form.area.trim()} ` : ""
    return `${prefix}${form.operationsType} — ${period}`
  }

  switch (form.complianceCategory) {
    case "Classroom Observations":
      return form.classroomAgeGroup && period ? `${form.classroomAgeGroup} Classroom Observation — ${period}` : ""
    case "Drills":
    case "Health & Safety":
      return form.recordType && period ? `${form.recordType} — ${period}` : ""
    case "Licensing":
      return form.recordType && form.year ? `${form.recordType} — ${form.year}` : ""
    case "Child Files":
    case "Staff Files":
      return form.recordType && reference ? `${form.recordType} — ${reference}` : ""
    case "Parent Complaints": {
      if (!form.recordType || (!form.classroomAgeGroup && !reference)) return ""
      const parts = [form.recordType]
      if (form.classroomAgeGroup) parts.push(`${form.classroomAgeGroup} Classroom`)
      if (reference) parts.push(reference)
      return parts.join(" — ")
    }
    case "Staff Complaints":
      return form.recordType
        ? ["Staff Complaint", form.recordType, reference].filter(Boolean).join(" — ")
        : ""
    case "CCIR / Critical Incidents":
      return incident ? `CCIR / Critical Incident — ${incident}` : ""
    default:
      return ""
  }
}

export function relatedReferenceFor(complianceCategory: ComplianceCategory | "", referenceText: string, incidentText: string): string | undefined {
  const reference = referenceText.trim()
  const incident = incidentText.trim()

  if (complianceCategory === "Child Files" && reference) return `Child: ${reference}`
  if (complianceCategory === "Staff Files" && reference) return `Staff: ${reference}`
  if ((complianceCategory === "Parent Complaints" || complianceCategory === "Staff Complaints") && reference) {
    return `Reference: ${reference}`
  }
  if (complianceCategory === "CCIR / Critical Incidents" && incident) return `Incident: ${incident}`
  return undefined
}

const REFERENCE_PREFIXES = ["Child: ", "Staff: ", "Reference: ", "Incident: "]

/** Strips a known relatedRef prefix (added by {@link relatedReferenceFor}) back to raw reference text. */
export function stripReferencePrefix(relatedRef: string | undefined): string {
  if (!relatedRef) return ""
  const prefix = REFERENCE_PREFIXES.find((p) => relatedRef.startsWith(p))
  return prefix ? relatedRef.slice(prefix.length) : relatedRef
}
