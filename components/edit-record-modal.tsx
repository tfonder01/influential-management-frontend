"use client"

import { useEffect, useState } from "react"
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
import { AlertTriangle, Loader2 } from "lucide-react"
import { useApp } from "@/lib/store"
import { CLASSROOM_AGE_GROUPS, COMPLIANCE_CATEGORIES, OPERATIONS_RECORD_TYPES } from "@/lib/mock-data"
import { RECORD_TYPE_OPTIONS, COMPLIANCE_CADENCE_OPTIONS, OPERATIONS_CADENCE_OPTIONS } from "@/lib/record-form-config"
import { MONTH_OPTIONS, monthName, startOfWeek } from "@/lib/reporting-period"
import { generateRecordTitle, stripReferencePrefix } from "@/lib/record-title"
import { isApiClientError, type UpdateRecordInput } from "@/lib/records-api"
import type {
  ClassroomAgeGroup,
  ComplianceCategory,
  ComplianceRecord,
  OperationsRecordType,
  ReportingCadence,
} from "@/lib/types"

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 8 }, (_, index) => String(CURRENT_YEAR - 2 + index))

interface EditRecordModalProps {
  open: boolean
  onClose: () => void
  record: ComplianceRecord
}

function formFromRecord(record: ComplianceRecord) {
  const workspace = record.workspace ?? (record.category === "Operations" ? "operations" : "compliance")
  const complianceCategory = workspace === "compliance" ? (record.category as ComplianceCategory) : ("" as const)
  const operationsType = workspace === "operations" ? (record.recordType ?? ("" as const)) : ("" as const)
  const period = record.reportingPeriod
  return {
    workspace,
    complianceCategory,
    operationsType,
    classroomAgeGroup: (record.classroomAgeGroup ?? "") as ClassroomAgeGroup | "",
    area: record.area ?? "",
    recordType: record.recordTypeLabel ?? "",
    cadence: (period?.cadence ?? "NONE") as ReportingCadence,
    weekOf: period?.weekOf ?? record.uploadDate,
    month: period?.month ?? record.uploadDate.slice(5, 7),
    year: period?.year ?? record.uploadDate.slice(0, 4),
    date: record.uploadDate,
    description: record.description ?? "",
    useCustomTitle: record.customTitle ?? true,
    customTitle: record.title,
    // Fixed inputs preserved from the original record; not directly editable in this pass.
    referenceText: stripReferencePrefix(record.relatedRef),
    incidentText: record.category === "CCIR / Critical Incidents" ? stripReferencePrefix(record.relatedRef) : "",
  }
}

type EditForm = ReturnType<typeof formFromRecord>

function periodPayload(form: EditForm) {
  if (form.cadence === "WEEKLY") return { cadence: "WEEKLY" as const, weekOf: startOfWeek(form.weekOf) }
  if (form.cadence === "MONTHLY") return { cadence: "MONTHLY" as const, month: form.month, year: form.year }
  return { cadence: "NONE" as const }
}

export function EditRecordModal({ open, onClose, record }: EditRecordModalProps) {
  const { editRecord, updateProductionRecord, isDemoMode } = useApp()
  const [form, setForm] = useState<EditForm>(() => formFromRecord(record))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => {
    if (open) {
      setForm(formFromRecord(record))
      setSubmitError("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record.id])

  const generatedTitle = generateRecordTitle(form)
  const recordTitle = form.useCustomTitle ? form.customTitle.trim() : generatedTitle
  const canSubmit = Boolean(recordTitle && !submitting)

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

  const handleComplianceCategoryChange = (value: string | null) => {
    const category = (value ?? "") as ComplianceCategory | ""
    const config = category ? COMPLIANCE_CADENCE_OPTIONS[category] : undefined
    setForm((current) => ({
      ...current,
      complianceCategory: category,
      // Classroom/area/record-type options depend on the selected category, so a category switch
      // clears whatever no longer applies rather than silently persisting a stale value.
      classroomAgeGroup: "",
      area: "",
      recordType: "",
      cadence: config?.default ?? "NONE",
    }))
  }

  const handleOperationsTypeChange = (value: string | null) => {
    const type = (value ?? "") as OperationsRecordType | ""
    const config = type ? OPERATIONS_CADENCE_OPTIONS[type] : undefined
    setForm((current) => ({
      ...current,
      operationsType: type,
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

  const handleClose = () => {
    if (submitting) return
    setSubmitError("")
    onClose()
  }

  const handleSave = async () => {
    if (!canSubmit || submitting) return

    const payload: UpdateRecordInput = {
      title: recordTitle,
      customTitle: form.useCustomTitle,
      complianceCategory: form.workspace === "compliance" ? (form.complianceCategory as ComplianceCategory) : undefined,
      operationsType: form.workspace === "operations" ? (form.operationsType as OperationsRecordType) : undefined,
      recordType: form.recordType || undefined,
      classroomAgeGroup: form.classroomAgeGroup || undefined,
      area: form.area.trim() || undefined,
      referenceLabel: record.relatedRef,
      recordDate: form.date,
      description: form.description || undefined,
      reportingPeriod: form.cadence !== "NONE" ? periodPayload(form) : undefined,
    }

    if (isDemoMode) {
      editRecord(record.id, {
        title: recordTitle,
        customTitle: form.useCustomTitle,
        category: form.workspace === "operations" ? "Operations" : (form.complianceCategory as ComplianceCategory),
        recordType: form.workspace === "operations" ? (form.operationsType as OperationsRecordType) : undefined,
        recordTypeLabel: form.recordType || undefined,
        classroomAgeGroup: form.classroomAgeGroup || undefined,
        area: form.area.trim() || undefined,
        uploadDate: form.date,
        description: form.description,
        reportingPeriod: form.cadence !== "NONE" ? periodPayload(form) : undefined,
      })
      onClose()
      return
    }

    setSubmitting(true)
    setSubmitError("")
    try {
      await updateProductionRecord(record.id, payload)
      onClose()
    } catch (error) {
      setSubmitError(
        isApiClientError(error)
          ? error.message
          : "The record could not be saved. Please review the form and try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
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

          <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4">
            {recordTypeOptions && (
              <div className="grid gap-1.5">
                <Label>Record Type</Label>
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
              <div className="grid gap-1.5">
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
                {recordTitle || (form.useCustomTitle ? "Enter a custom title above." : "Complete the fields above to generate a title.")}
              </p>
            </div>
          </div>

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
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive [animation:page-enter_150ms_ease-out_both]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="min-h-10 sm:min-h-8" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSubmit || submitting} className="min-h-10 min-w-28 gap-1.5 sm:min-h-8">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
