"use client"

import { useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, Camera, Loader2, MapPin, Wrench } from "lucide-react"
import { useApp } from "@/lib/store"
import {
  CLASSROOM_AGE_GROUPS,
  MAINTENANCE_AREAS,
  MAINTENANCE_CATEGORIES,
} from "@/lib/mock-data"
import type { MaintenancePriority, MaintenanceRequest } from "@/lib/types"
import { priorityLabel } from "@/lib/priority-labels"
import { roleLabel } from "@/lib/role-labels"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { isApiClientError, uploadFileApi } from "@/lib/maintenance-api"

const priorities: MaintenancePriority[] = ["Low", "Medium", "High", "Urgent"]
const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:bg-muted"

export function NewMaintenanceRequestModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { role, currentUser, locations, addMaintenanceRequest, createProductionMaintenanceRequest, isDemoMode } = useApp()
  const [locationId, setLocationId] = useState("")
  const [area, setArea] = useState("")
  const [category, setCategory] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateReported, setDateReported] = useState("")
  const [priority, setPriority] = useState<MaintenancePriority>("Medium")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [photoName, setPhotoName] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const isOwner = role === "owner"
  const effectiveApprovalRequired = isOwner ? approvalRequired : true

  useEffect(() => {
    if (!open) return
    setLocationId(role === "owner" ? (locations[0]?.id ?? "") : (currentUser.locationId ?? ""))
    setDateReported(new Date().toISOString().slice(0, 10))
    setSubmitError("")
    setSubmitting(false)
  }, [open, role, locations, currentUser.locationId])

  const reset = () => {
    setArea("")
    setCategory("")
    setTitle("")
    setDescription("")
    setPriority("Medium")
    setEstimatedCost("")
    setApprovalRequired(true)
    setPhotoName("")
    setPhotoFile(null)
    setSubmitError("")
    setSubmitting(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!locationId || !area || !category || !title.trim() || !description.trim() || submitting) return

    if (isDemoMode) {
      const timestamp = new Date(`${dateReported}T12:00:00`).toISOString()
      const isClassroom = CLASSROOM_AGE_GROUPS.includes(area as (typeof CLASSROOM_AGE_GROUPS)[number])
      const request: MaintenanceRequest = {
        id: `maint_${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        locationId,
        classroomAgeGroup: isClassroom ? area as (typeof CLASSROOM_AGE_GROUPS)[number] : undefined,
        area,
        category: category as MaintenanceRequest["category"],
        priority,
        submittedBy: currentUser.name,
        submittedById: currentUser.id,
        createdAt: timestamp,
        lastUpdated: timestamp,
        approvalStatus: effectiveApprovalRequired ? "Awaiting Approval" : "Not Required",
        maintenanceStatus: "Submitted",
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        originalPhotos: photoName ? [{ name: photoName, uploadedAt: timestamp, uploadedBy: currentUser.name }] : [],
        completionPhotos: [],
        invoices: [],
        archived: false,
      }
      addMaintenanceRequest(request)
      reset()
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    setSubmitError("")

    let fileId: string | undefined
    if (photoFile) {
      try {
        const uploaded = await uploadFileApi(photoFile, locationId)
        fileId = uploaded.id
      } catch (error) {
        setSubmitError(isApiClientError(error) ? error.message : "Photo upload failed. Please try again.")
        setSubmitting(false)
        return
      }
    }

    try {
      await createProductionMaintenanceRequest({
        locationId,
        title: title.trim(),
        description: description.trim(),
        category: category as MaintenanceRequest["category"],
        priority,
        area,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        approvalRequired: effectiveApprovalRequired,
        fileId,
      })
      reset()
      onOpenChange(false)
    } catch (error) {
      setSubmitError(
        isApiClientError(error)
          ? error.message
          : "The maintenance request could not be saved. Please review the form and try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitting) return
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 sm:max-w-2xl">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Wrench className="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle>New Maintenance Request</DialogTitle>
                <DialogDescription className="mt-1">Report an issue and route it for the right follow-up.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="maintenance-location">Location</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <select id="maintenance-location" className={`${fieldClass} pl-8`} value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={role !== "owner" || submitting} required>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>
              {role !== "owner" && <p className="text-[11px] text-muted-foreground">Restricted to your assigned location.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maintenance-area">Classroom / Area</Label>
              <select id="maintenance-area" className={fieldClass} value={area} onChange={(event) => setArea(event.target.value)} disabled={submitting} required>
                <option value="">Select classroom or facility area</option>
                {MAINTENANCE_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maintenance-category">Maintenance Category</Label>
              <select id="maintenance-category" className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} disabled={submitting} required>
                <option value="">Select category</option>
                {MAINTENANCE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maintenance-priority">Priority</Label>
              <select id="maintenance-priority" className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value as MaintenancePriority)} disabled={submitting}>
                {priorities.map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="maintenance-title">Issue / Request Title</Label>
              <Input id="maintenance-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Preschool classroom AC not cooling" disabled={submitting} required />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="maintenance-description">Description</Label>
              <Textarea id="maintenance-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Describe what happened, any temporary safety measures, and what needs attention." disabled={submitting} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maintenance-date">Date Reported</Label>
              <Input id="maintenance-date" type="date" value={dateReported} onChange={(event) => setDateReported(event.target.value)} disabled={submitting} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maintenance-cost">Estimated Cost <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-sm text-muted-foreground">$</span>
                <Input id="maintenance-cost" className="pl-6" type="number" min="0" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} placeholder="0.00" disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="maintenance-photo">Photo upload <span className="font-normal text-muted-foreground">{isDemoMode ? "(prototype)" : "(optional)"}</span></Label>
              <label htmlFor="maintenance-photo" className="flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/25 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/45">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium text-foreground">{photoName || "Choose a photo"}</span>
                  <span className="text-xs text-muted-foreground">{isDemoMode ? "The filename is stored locally for this prototype." : "The file will be uploaded and attached to the request."}</span>
                </span>
              </label>
              <Input
                id="maintenance-photo"
                className="sr-only"
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setPhotoFile(file)
                  setPhotoName(file?.name ?? "")
                }}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/25 p-3 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-70"
                checked={effectiveApprovalRequired}
                onChange={(event) => setApprovalRequired(event.target.checked)}
                disabled={submitting || !isOwner}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Approval required before work proceeds</span>
                <span className="text-xs text-muted-foreground">
                  {isOwner
                    ? "Owner approval will be requested. Approval and repair progress are tracked separately."
                    : "Owner approval is required for requests submitted by staff."}
                </span>
              </span>
            </label>

            <div className="rounded-lg bg-muted/40 px-3 py-2.5 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted By</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{currentUser.name} · {roleLabel(currentUser.role)}</p>
            </div>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2.5 text-sm text-red-700 sm:col-span-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="m-0">
            <Button type="button" variant="outline" className="min-h-10 sm:min-h-8" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" className="min-h-10 gap-2 sm:min-h-8" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
