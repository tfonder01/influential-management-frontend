"use client"

import { useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, Camera, Loader2, MapPin, PackagePlus } from "lucide-react"
import { useApp } from "@/lib/store"
import { CLASSROOM_AGE_GROUPS, SUPPLY_AREAS, SUPPLY_CATEGORIES } from "@/lib/mock-data"
import type { SupplyPriority, SupplyRequest } from "@/lib/types"
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
import { isApiClientError, uploadFileApi } from "@/lib/supply-api"

const priorities: SupplyPriority[] = ["Low", "Medium", "High", "Urgent"]
const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:bg-muted"

export function NewSupplyRequestModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { role, currentUser, locations, addSupplyRequest, createProductionSupplyRequest, isDemoMode } = useApp()
  const [locationId, setLocationId] = useState("")
  const [area, setArea] = useState("")
  const [category, setCategory] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [requestedDate, setRequestedDate] = useState("")
  const [priority, setPriority] = useState<SupplyPriority>("Medium")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [photoName, setPhotoName] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const isOwner = role === "owner"
  const effectiveApprovalRequired = isOwner ? approvalRequired : true

  useEffect(() => {
    if (!open) return
    setLocationId(role === "owner" ? (locations[0]?.id ?? "") : (currentUser.locationId ?? ""))
    setRequestedDate(new Date().toISOString().slice(0, 10))
    setSubmitError("")
    setSubmitting(false)
  }, [open, role, locations, currentUser.locationId])

  const reset = () => {
    setArea("")
    setCategory("")
    setTitle("")
    setDescription("")
    setQuantity("1")
    setEstimatedCost("")
    setPriority("Medium")
    setApprovalRequired(false)
    setPhotoName("")
    setPhotoFile(null)
    setSubmitError("")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!locationId || !category || !title.trim() || !description.trim() || Number(quantity) <= 0 || submitting) return

    if (isDemoMode) {
      const timestamp = new Date(`${requestedDate}T12:00:00`).toISOString()
      const isClassroom = CLASSROOM_AGE_GROUPS.includes(area as (typeof CLASSROOM_AGE_GROUPS)[number])
      const request: SupplyRequest = {
        id: `supply_${Date.now()}`,
        locationId,
        area: area || undefined,
        classroomAgeGroup: isClassroom ? (area as SupplyRequest["classroomAgeGroup"]) : undefined,
        category: category as SupplyRequest["category"],
        title: title.trim(),
        itemName: title.trim(),
        description: description.trim(),
        quantity: Number(quantity),
        estimatedTotal: estimatedCost ? Number(estimatedCost) : 0,
        requestedAt: timestamp,
        priority,
        approvalRequired: effectiveApprovalRequired,
        approvalStatus: effectiveApprovalRequired ? "Awaiting Approval" : "Not Required",
        fulfillmentStatus: "Submitted",
        submittedBy: currentUser.name,
        requestedBy: currentUser.name,
        submittedById: currentUser.id,
        requestedById: currentUser.id,
        lastUpdated: timestamp,
        photos: photoName ? [{ name: photoName, uploadedAt: timestamp, uploadedBy: currentUser.name }] : [],
        archived: false,
      }
      addSupplyRequest(request)
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
      await createProductionSupplyRequest({
        locationId,
        title: title.trim(),
        description: description.trim(),
        category: category as SupplyRequest["category"],
        quantity: Number(quantity),
        priority,
        classroomAgeGroup: CLASSROOM_AGE_GROUPS.includes(area as (typeof CLASSROOM_AGE_GROUPS)[number]) ? (area as SupplyRequest["classroomAgeGroup"]) : undefined,
        area: area || undefined,
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
          : "The supply request could not be saved. Please review the form and try again."
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <PackagePlus className="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle>New Supply Request</DialogTitle>
                <DialogDescription className="mt-1">Request supplies, furniture, fixtures, or equipment.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid max-h-[68vh] gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supply-location">Location</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <select id="supply-location" className={`${fieldClass} pl-8`} value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={role !== "owner" || submitting} required>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>
              {role !== "owner" && <p className="text-[11px] text-muted-foreground">Restricted to your assigned location.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-area">Classroom / Area <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <select id="supply-area" className={fieldClass} value={area} onChange={(event) => setArea(event.target.value)} disabled={submitting}>
                <option value="">Not specified</option>
                {SUPPLY_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-category">Category</Label>
              <select id="supply-category" className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} disabled={submitting} required>
                <option value="">Select category</option>
                {SUPPLY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-priority">Priority</Label>
              <select id="supply-priority" className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value as SupplyPriority)} disabled={submitting}>
                {priorities.map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supply-title">Item / Request Title</Label>
              <Input id="supply-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Replacement classroom table" disabled={submitting} required />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supply-description">Description</Label>
              <Textarea id="supply-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Describe what is needed and why." disabled={submitting} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-quantity">Quantity</Label>
              <Input id="supply-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={submitting} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-date">Requested Date</Label>
              <Input id="supply-date" type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} disabled={submitting} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supply-cost">Estimated Cost <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-sm text-muted-foreground">$</span>
                <Input id="supply-cost" className="pl-6" type="number" min="0" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} placeholder="0.00" disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supply-photo">Photo / document upload <span className="font-normal text-muted-foreground">{isDemoMode ? "(prototype)" : "(optional)"}</span></Label>
              <label htmlFor="supply-photo" className="flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/25 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/45">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium text-foreground">{photoName || "Choose a photo"}</span>
                  <span className="text-xs text-muted-foreground">{isDemoMode ? "The filename is stored locally for this prototype." : "The file will be uploaded and attached to the request."}</span>
                </span>
              </label>
              <Input
                id="supply-photo"
                className="sr-only"
                type="file"
                accept="image/*,application/pdf"
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
                <span className="block text-sm font-medium text-foreground">Approval required before ordering</span>
                <span className="text-xs text-muted-foreground">
                  {isOwner
                    ? "Owner approval is tracked separately from purchasing/fulfillment progress."
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
