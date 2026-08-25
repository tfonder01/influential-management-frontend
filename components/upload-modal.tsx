"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, CheckCircle2, File, Loader2, MapPin, Upload, X } from "lucide-react"
import { useApp } from "@/lib/store"
import { CLASSROOM_AGE_GROUPS, COMPLIANCE_CATEGORIES, OPERATIONS_RECORD_TYPES } from "@/lib/mock-data"
import { MONTH_OPTIONS, monthName, reportingPeriodLabel, startOfWeek } from "@/lib/reporting-period"
import { uploadFileApi, isApiClientError } from "@/lib/records-api"
import type {
  ClassroomAgeGroup,
  ComplianceCategory,
  OperationsRecordType,
  ReportingCadence,
  RecordWorkspace,
} from "@/lib/types"

const TODAY = new Date().toISOString().split("T")[0]
const CURRENT_YEAR = Number(TODAY.slice(0, 4))
const YEARS = Array.from({ length: 8 }, (_, index) => String(CURRENT_YEAR - 2 + index))

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MAX_UPLOAD_LABEL = "20MB"
const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"]
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]

const RECORD_TYPE_OPTIONS: Partial<Record<ComplianceCategory, readonly string[]>> = {
  Drills: ["Fire Drill", "Lockdown Drill", "Tornado Drill", "Other Drill"],
  "Health & Safety": ["Health & Safety Inspection", "Safety Checklist Review", "Other Health & Safety Record"],
  Licensing: ["State Licensing Inspection", "Annual DCF Licensing Renewal", "Other Licensing Record"],
  "Child Files": ["Child Enrollment File", "Child File Audit", "Other Child Record"],
  "Staff Files": ["Staff Background Check", "CPR / First Aid Certification", "Staff File Audit", "Other Staff Record"],
  "Parent Complaints": ["Parent Complaint", "Supervision Concern", "Health / Safety Concern", "Other Parent Complaint"],
  "Staff Complaints": ["Workplace Conduct", "Scheduling / Policy", "Other Staff Complaint"],
}

/** Categories/types whose records recur on a reporting cadence, and which cadences are offered. */
const COMPLIANCE_CADENCE_OPTIONS: Partial<Record<ComplianceCategory, { allowed: ReportingCadence[]; default: ReportingCadence }>> = {
  "Classroom Observations": { allowed: ["MONTHLY"], default: "MONTHLY" },
  Drills: { allowed: ["MONTHLY"], default: "MONTHLY" },
  "Health & Safety": { allowed: ["MONTHLY", "WEEKLY"], default: "MONTHLY" },
}

const OPERATIONS_CADENCE_OPTIONS: Partial<Record<OperationsRecordType, { allowed: ReportingCadence[]; default: ReportingCadence }>> = {
  "Opening Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Closing Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Playground Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
  "Cleaning Checklist": { allowed: ["WEEKLY", "MONTHLY"], default: "WEEKLY" },
}

interface UploadModalProps {
  open: boolean
  onClose: () => void
  defaultLocationId?: string
  defaultWorkspace?: RecordWorkspace
}

function createInitialForm(locationId: string, workspace: RecordWorkspace | "") {
  return {
    locationId,
    workspace,
    complianceCategory: "" as ComplianceCategory | "",
    operationsType: "" as OperationsRecordType | "",
    classroomAgeGroup: "" as ClassroomAgeGroup | "",
    area: "",
    recordType: "",
    cadence: "NONE" as ReportingCadence,
    weekOf: TODAY,
    month: TODAY.slice(5, 7),
    year: TODAY.slice(0, 4),
    date: TODAY,
    referenceText: "",
    incidentText: "",
    useCustomTitle: false,
    customTitle: "",
    description: "",
    file: null as File | null,
    fileError: "",
  }
}

type UploadForm = ReturnType<typeof createInitialForm>

function validateFile(file: File): string {
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  const hasAcceptedType = ACCEPTED_MIME_TYPES.includes(file.type)
  if (!hasAcceptedType && !hasAcceptedExtension) return "Only PDF, JPG, or PNG files are accepted."
  if (file.size > MAX_UPLOAD_BYTES) return `File exceeds the ${MAX_UPLOAD_LABEL} upload limit.`
  if (file.size === 0) return "File must not be empty."
  return ""
}

function periodFromForm(form: UploadForm) {
  if (form.cadence === "WEEKLY") return { cadence: "WEEKLY" as const, weekOf: startOfWeek(form.weekOf) }
  if (form.cadence === "MONTHLY") return { cadence: "MONTHLY" as const, month: form.month, year: form.year }
  return { cadence: "NONE" as const }
}

function generateRecordTitle(form: UploadForm) {
  const period = form.cadence !== "NONE" ? reportingPeriodLabel(periodFromForm(form)) : ""
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

function relatedReference(form: UploadForm) {
  const reference = form.referenceText.trim()
  const incident = form.incidentText.trim()

  if (form.complianceCategory === "Child Files" && reference) return `Child: ${reference}`
  if (form.complianceCategory === "Staff Files" && reference) return `Staff: ${reference}`
  if ((form.complianceCategory === "Parent Complaints" || form.complianceCategory === "Staff Complaints") && reference) {
    return `Reference: ${reference}`
  }
  if (form.complianceCategory === "CCIR / Critical Incidents" && incident) return `Incident: ${incident}`
  return undefined
}

export function UploadModal({ open, onClose, defaultLocationId, defaultWorkspace }: UploadModalProps) {
  const { addRecord, createProductionRecord, currentUser, role, locations, isDemoMode } = useApp()
  const showLocationPicker = role === "owner" || locations.length > 1
  const initialLocationId = defaultLocationId ?? (showLocationPicker ? "" : locations[0]?.id ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [form, setForm] = useState(() => createInitialForm(initialLocationId, defaultWorkspace ?? ""))

  const generatedTitle = generateRecordTitle(form)
  const recordTitle = form.useCustomTitle ? form.customTitle.trim() : generatedTitle
  const areaTypeSelected = form.workspace === "operations" ? Boolean(form.operationsType) : Boolean(form.complianceCategory)
  const canSubmit = Boolean(recordTitle && form.locationId && form.workspace && areaTypeSelected && !form.fileError)

  const recordTypeOptions =
    form.workspace === "compliance" && form.complianceCategory ? RECORD_TYPE_OPTIONS[form.complianceCategory] : undefined
  const cadenceConfig =
    form.workspace === "operations"
      ? (form.operationsType ? OPERATIONS_CADENCE_OPTIONS[form.operationsType] : undefined)
      : (form.complianceCategory ? COMPLIANCE_CADENCE_OPTIONS[form.complianceCategory] : undefined)
  const usesReportingPeriod = Boolean(cadenceConfig)
  const usesYear = form.workspace === "compliance" && form.complianceCategory === "Licensing"
  const usesClassroom =
    form.workspace === "operations" ||
    form.complianceCategory === "Classroom Observations" ||
    form.complianceCategory === "Parent Complaints"
  const usesArea = form.workspace === "operations"
  const usesReference =
    form.complianceCategory === "Child Files" ||
    form.complianceCategory === "Staff Files" ||
    form.complianceCategory === "Parent Complaints" ||
    form.complianceCategory === "Staff Complaints" ||
    (form.workspace === "operations" && form.operationsType === "Other Operations Record")

  const resetTypeSpecificFields = () => ({
    classroomAgeGroup: "" as ClassroomAgeGroup | "",
    area: "",
    recordType: "",
    referenceText: "",
    incidentText: "",
    useCustomTitle: false,
    customTitle: "",
    cadence: "NONE" as ReportingCadence,
  })

  const handleWorkspaceChange = (value: string | null) => {
    const workspace = (value ?? "") as RecordWorkspace | ""
    setForm((current) => ({
      ...current,
      workspace,
      complianceCategory: "",
      operationsType: "",
      ...resetTypeSpecificFields(),
    }))
  }

  const handleComplianceCategoryChange = (value: string | null) => {
    const category = (value ?? "") as ComplianceCategory | ""
    const config = category ? COMPLIANCE_CADENCE_OPTIONS[category] : undefined
    setForm((current) => ({
      ...current,
      complianceCategory: category,
      ...resetTypeSpecificFields(),
      cadence: config?.default ?? "NONE",
    }))
  }

  const handleOperationsTypeChange = (value: string | null) => {
    const type = (value ?? "") as OperationsRecordType | ""
    const config = type ? OPERATIONS_CADENCE_OPTIONS[type] : undefined
    setForm((current) => ({
      ...current,
      operationsType: type,
      ...resetTypeSpecificFields(),
      cadence: config?.default ?? "NONE",
    }))
  }

  const handleDateChange = (date: string) => {
    setForm((current) => ({
      ...current,
      date,
      ...(date ? { month: date.slice(5, 7), year: date.slice(0, 4), weekOf: date } : {}),
    }))
  }

  const handleFileChange = (file: File | undefined) => {
    if (!file) {
      setForm((current) => ({ ...current, file: null, fileError: "" }))
      return
    }
    setForm((current) => ({ ...current, file, fileError: validateFile(file) }))
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return

    if (isDemoMode) {
      const now = new Date().toISOString().split("T")[0]
      addRecord({
        id: `rec_${Date.now()}`,
        title: recordTitle,
        locationId: form.locationId,
        category: form.workspace === "operations" ? "Operations" : (form.complianceCategory as ComplianceCategory),
        workspace: form.workspace as RecordWorkspace,
        recordType: form.workspace === "operations" && form.operationsType ? form.operationsType : undefined,
        status: "New",
        uploadedBy: currentUser.name,
        uploadedById: currentUser.id,
        uploadDate: form.date || now,
        lastUpdated: now,
        description: form.description,
        fileNames: form.file ? [form.file.name] : [],
        tags: [],
        relatedRef: relatedReference(form),
        classroomAgeGroup: form.classroomAgeGroup || undefined,
        area: form.area.trim() || undefined,
        observationMonth:
          form.complianceCategory === "Classroom Observations" && form.cadence === "MONTHLY" && form.month && form.year
            ? `${form.year}-${form.month}`
            : undefined,
        reportingPeriod: form.cadence !== "NONE" ? periodFromForm(form) : undefined,
      })
      setSubmitted(true)
      return
    }

    setSubmitting(true)
    setSubmitError("")

    let fileId: string | undefined
    if (form.file) {
      try {
        const uploaded = await uploadFileApi(form.file, form.locationId)
        fileId = uploaded.id
      } catch (error) {
        setSubmitting(false)
        setSubmitError(isApiClientError(error) ? error.message : "File upload failed. Please try again.")
        return
      }
    }

    try {
      await createProductionRecord({
        locationId: form.locationId,
        workspace: form.workspace as RecordWorkspace,
        complianceCategory: form.workspace === "compliance" ? (form.complianceCategory as ComplianceCategory) : undefined,
        operationsType: form.workspace === "operations" ? (form.operationsType as OperationsRecordType) : undefined,
        title: recordTitle,
        customTitle: form.useCustomTitle,
        recordType: form.recordType || undefined,
        classroomAgeGroup: form.classroomAgeGroup || undefined,
        area: form.area.trim() || undefined,
        referenceLabel: relatedReference(form),
        recordDate: form.date,
        description: form.description || undefined,
        reportingPeriod: form.cadence !== "NONE" ? periodFromForm(form) : undefined,
        fileId,
      })
      setSubmitted(true)
    } catch (error) {
      // The file (if any) has already been uploaded and safely stored under this org/location by this
      // point; it is simply not yet attached to a record. We surface the failure clearly rather than
      // silently discarding it, and leave the metadata in place — an unattached file is harmless and
      // can be cleaned up later, whereas guessing at automatic deletion here risks removing a file the
      // user still intends to attach after fixing the record fields and retrying.
      setSubmitError(
        isApiClientError(error)
          ? error.message
          : "The record could not be saved. Please review the form and try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSubmitted(false)
    setSubmitError("")
    setForm(createInitialForm(initialLocationId, defaultWorkspace ?? ""))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center [animation:page-enter_200ms_ease-out_both]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Record uploaded successfully</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The record has been added with status{" "}
                <span className="font-medium text-blue-600">New</span> and ownership has been notified.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {form.workspace === "operations" ? "Upload Operations Record" : "Upload Record"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 py-2">
              <div className="grid gap-1.5">
                <Label>Record Area *</Label>
                <Select value={form.workspace} onValueChange={handleWorkspaceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select record area">
                      {form.workspace === "operations" ? "Operations" : form.workspace === "compliance" ? "Compliance" : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Location *</Label>
                {showLocationPicker ? (
                  <Select value={form.locationId} onValueChange={(value) => setForm((current) => ({ ...current, locationId: value ?? "" }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location">
                        {locations.find((location) => location.id === form.locationId)?.name ?? null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-2.5 py-2 text-sm text-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{locations[0]?.name ?? "No assigned location"}</span>
                  </div>
                )}
                {!showLocationPicker && (
                  <p className="text-[11px] text-muted-foreground">Restricted to your assigned location.</p>
                )}
              </div>

              {form.workspace === "compliance" && (
                <div className="grid gap-1.5">
                  <Label>Compliance Category *</Label>
                  <Select value={form.complianceCategory} onValueChange={handleComplianceCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category">{form.complianceCategory || null}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLIANCE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.workspace === "operations" && (
                <div className="grid gap-1.5">
                  <Label>Operations Record Type *</Label>
                  <Select value={form.operationsType} onValueChange={handleOperationsTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select record type">{form.operationsType || null}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONS_RECORD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {areaTypeSelected && (
                <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 [animation:page-enter_180ms_ease-out_both]">
                  {recordTypeOptions && (
                    <div className="grid gap-1.5">
                      <Label>Record Type *</Label>
                      <Select value={form.recordType} onValueChange={(value) => setForm((current) => ({ ...current, recordType: value ?? "" }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select record type">{form.recordType || null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {recordTypeOptions.map((recordType) => (
                            <SelectItem key={recordType} value={recordType}>{recordType}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {usesClassroom && (
                    <div className="grid gap-1.5">
                      <Label>Classroom / Age Group {form.complianceCategory === "Classroom Observations" ? "*" : "(optional)"}</Label>
                      <Select
                        value={form.classroomAgeGroup}
                        onValueChange={(value) => setForm((current) => ({ ...current, classroomAgeGroup: (value ?? "") as ClassroomAgeGroup | "" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select classroom">{form.classroomAgeGroup || null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSROOM_AGE_GROUPS.map((group) => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {usesArea && (
                    <div className="grid gap-1.5">
                      <Label>Area (optional)</Label>
                      <Input
                        placeholder="e.g. North Playground or Kitchen"
                        value={form.area}
                        onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
                      />
                    </div>
                  )}

                  {usesReportingPeriod && cadenceConfig && (
                    <div className="grid gap-3">
                      {cadenceConfig.allowed.length > 1 && (
                        <div className="grid gap-1.5">
                          <Label>Reporting Period *</Label>
                          <div className="flex gap-2">
                            {cadenceConfig.allowed.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, cadence: option }))}
                                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  form.cadence === option
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-input bg-transparent text-muted-foreground hover:bg-muted/40"
                                }`}
                              >
                                {option === "WEEKLY" ? "Weekly" : "Monthly"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {form.cadence === "WEEKLY" && (
                        <div className="grid gap-1.5">
                          <Label>Week Of *</Label>
                          <Input
                            type="date"
                            value={form.weekOf}
                            onChange={(event) => setForm((current) => ({ ...current, weekOf: event.target.value }))}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Used to determine the reporting period. Set to the week beginning {new Date(`${startOfWeek(form.weekOf)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
                          </p>
                        </div>
                      )}

                      {form.cadence === "MONTHLY" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label>Month *</Label>
                            <Select value={form.month} onValueChange={(value) => setForm((current) => ({ ...current, month: value ?? "" }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Month">{form.month ? monthName(form.month) : null}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {MONTH_OPTIONS.map((month) => (
                                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label>Year *</Label>
                            <Select value={form.year} onValueChange={(value) => setForm((current) => ({ ...current, year: value ?? "" }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Year">{form.year || null}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {YEARS.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {usesYear && (
                    <div className="grid gap-1.5">
                      <Label>Year *</Label>
                      <Select value={form.year} onValueChange={(value) => setForm((current) => ({ ...current, year: value ?? "" }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year">{form.year || null}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {usesReference && (
                    <div className="grid gap-1.5">
                      <Label>
                        {form.complianceCategory === "Child Files"
                          ? "Child Name *"
                          : form.complianceCategory === "Staff Files"
                            ? "Staff Name *"
                            : form.workspace === "operations"
                              ? "Short Descriptor *"
                              : form.complianceCategory === "Staff Complaints"
                                ? "Complaint Reference (optional)"
                                : "Incident / Reference *"}
                      </Label>
                      <Input
                        placeholder={
                          form.complianceCategory === "Child Files"
                            ? "e.g. Sofia Rivera"
                            : form.complianceCategory === "Staff Files"
                              ? "e.g. Maria Gonzalez"
                              : form.workspace === "operations"
                                ? "e.g. Kitchen Inventory Review"
                                : "Short identifying reference"
                        }
                        value={form.referenceText}
                        onChange={(event) => setForm((current) => ({ ...current, referenceText: event.target.value }))}
                      />
                    </div>
                  )}

                  {form.complianceCategory === "CCIR / Critical Incidents" && (
                    <div className="grid gap-1.5">
                      <Label>Short Incident Description / Reference *</Label>
                      <Input
                        placeholder="e.g. Allergic Reaction Incident"
                        value={form.incidentText}
                        onChange={(event) => setForm((current) => ({ ...current, incidentText: event.target.value }))}
                      />
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={form.useCustomTitle}
                      onChange={(event) => setForm((current) => ({ ...current, useCustomTitle: event.target.checked }))}
                      className="h-4 w-4 rounded border-border text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                    Use custom title
                  </label>

                  {form.useCustomTitle && (
                    <div className="grid gap-1.5 [animation:page-enter_180ms_ease-out_both]">
                      <Label>Custom Record Title *</Label>
                      <Input
                        placeholder="Enter a descriptive record title"
                        value={form.customTitle}
                        onChange={(event) => setForm((current) => ({ ...current, customTitle: event.target.value }))}
                      />
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-card px-3 py-2.5" aria-live="polite">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Record title</p>
                    <p className={`mt-1 text-sm ${recordTitle ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {recordTitle || (form.useCustomTitle ? "Enter a custom title above." : "Complete the preset fields to generate a title.")}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label>Record Date</Label>
                <Input type="date" value={form.date} onChange={(event) => handleDateChange(event.target.value)} />
                {usesReportingPeriod && (
                  <p className="text-[11px] text-muted-foreground">Used to determine the reporting period.</p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label>Description / Notes</Label>
                <Textarea
                  placeholder="Add context, notes, or details about this record..."
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Document / Photo</Label>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/25 px-4 py-6 text-center transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/40 hover:bg-primary/[0.03] focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-ring/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card ring-1 ring-border">
                    <Upload className="h-5 w-5 text-primary" />
                  </span>
                  <span className="text-sm text-muted-foreground">Drag &amp; drop or click to select files</span>
                  <span className="text-xs text-muted-foreground">PDF, JPG, PNG up to {MAX_UPLOAD_LABEL}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    onChange={(event) => handleFileChange(event.target.files?.[0])}
                  />
                </label>
                {form.file && (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm [animation:page-enter_180ms_ease-out_both]">
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 break-all text-foreground">{form.file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleFileChange(undefined)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      aria-label="Remove selected file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {form.fileError && (
                  <p className="text-xs font-medium text-destructive">{form.fileError}</p>
                )}
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive [animation:page-enter_150ms_ease-out_both]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" className="min-h-10 sm:min-h-8" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="min-h-10 min-w-28 gap-1.5 sm:min-h-8">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {submitting ? "Uploading…" : "Upload Record"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
