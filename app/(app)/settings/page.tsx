"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Loader2, MapPin, Pencil, RotateCcw, Shield } from "lucide-react"
import { useApp } from "@/lib/store"
import { ApiClientError } from "@/lib/api-client"
import { COMPLIANCE_CATEGORIES, LOCATIONS, OPERATIONS_RECORD_TYPES } from "@/lib/mock-data"
import {
  getOrganizationSettings,
  listLocationSettings,
  updateLocationSettings,
  updateOrganizationSettings,
  type LocationSettings,
  type OrganizationSettings,
} from "@/lib/organization-admin-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="border-b border-border pb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function validEmail(value: string) {
  const normalized = normalizeEmail(value)
  return normalized.length === 0 || EMAIL_PATTERN.test(normalized)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback
}

export default function SettingsPage() {
  const { role, currentUser, isDemoMode, showToast } = useApp()
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null)
  const [locations, setLocations] = useState<LocationSettings[]>([])
  const [loading, setLoading] = useState(role === "owner")
  const [loadError, setLoadError] = useState("")
  const [organizationEmail, setOrganizationEmail] = useState("")
  const [organizationError, setOrganizationError] = useState("")
  const [organizationSaving, setOrganizationSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<LocationSettings | null>(null)
  const [locationName, setLocationName] = useState("")
  const [locationEmail, setLocationEmail] = useState("")
  const [locationError, setLocationError] = useState("")
  const [locationSaving, setLocationSaving] = useState(false)

  const load = useCallback(async () => {
    if (role !== "owner") {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError("")
    try {
      const [nextOrganization, nextLocations] = isDemoMode
        ? [
            { id: "demo-organization", name: "Influential Management", notificationEmail: "", updatedAt: new Date().toISOString() },
            LOCATIONS.map((location) => ({ id: location.id, name: location.name, notificationEmail: "", updatedAt: new Date().toISOString() })),
          ] satisfies [OrganizationSettings, LocationSettings[]]
        : await Promise.all([getOrganizationSettings(), listLocationSettings()])
      setOrganization(nextOrganization)
      setOrganizationEmail(nextOrganization.notificationEmail ?? "")
      setLocations(nextLocations)
    } catch (error) {
      setLoadError(errorMessage(error, "Organization settings could not be loaded."))
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, role])

  useEffect(() => { void load() }, [load])

  const organizationDirty = useMemo(() => organization !== null
    && normalizeEmail(organizationEmail) !== (organization.notificationEmail ?? "").toLowerCase(),
  [organization, organizationEmail])
  const organizationValid = validEmail(organizationEmail)

  const locationDirty = useMemo(() => editTarget !== null
    && (normalizeName(locationName) !== normalizeName(editTarget.name)
      || normalizeEmail(locationEmail) !== (editTarget.notificationEmail ?? "").toLowerCase()),
  [editTarget, locationEmail, locationName])
  const locationValid = normalizeName(locationName).length > 0 && validEmail(locationEmail)

  const saveOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organization || !organizationDirty || !organizationValid) return
    setOrganizationSaving(true)
    setOrganizationError("")
    try {
      const normalizedEmail = normalizeEmail(organizationEmail)
      const updated = isDemoMode
        ? { ...organization, notificationEmail: normalizedEmail || undefined }
        : await updateOrganizationSettings(organization.name, normalizedEmail)
      setOrganization(updated)
      setOrganizationEmail(updated.notificationEmail ?? "")
      showToast("Organization settings updated")
    } catch (error) {
      setOrganizationError(errorMessage(error, "Organization settings could not be updated."))
    } finally {
      setOrganizationSaving(false)
    }
  }

  const openLocation = (location: LocationSettings) => {
    setEditTarget(location)
    setLocationName(location.name)
    setLocationEmail(location.notificationEmail ?? "")
    setLocationError("")
  }

  const saveLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editTarget || !locationDirty || !locationValid) return
    setLocationSaving(true)
    setLocationError("")
    try {
      const updated = isDemoMode
        ? { ...editTarget, name: normalizeName(locationName), notificationEmail: normalizeEmail(locationEmail) || undefined }
        : await updateLocationSettings(editTarget.id, locationName, locationEmail)
      setLocations((current) => current.map((location) => location.id === updated.id ? updated : location)
        .sort((left, right) => left.name.localeCompare(right.name)))
      setEditTarget(null)
      showToast("Location settings updated")
    } catch (error) {
      setLocationError(errorMessage(error, "Location settings could not be updated."))
    } finally {
      setLocationSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Section title="Your Profile">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${role === "owner" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700"}`}>
            {currentUser.initials}
          </div>
          <div>
            <p className="font-semibold text-foreground">{currentUser.name}</p>
            <p className="text-sm capitalize text-muted-foreground">{currentUser.role.replace("_", " ")}</p>
            {currentUser.locationId && <p className="text-xs text-muted-foreground">{LOCATIONS.find((location) => location.id === currentUser.locationId)?.name}</p>}
          </div>
        </div>
      </Section>

      {role === "owner" && loading && (
        <div className="flex min-h-36 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading organization settings...
        </div>
      )}

      {role === "owner" && !loading && loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-destructive">{loadError}</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}><RotateCcw /> Retry</Button>
        </div>
      )}

      {role === "owner" && !loading && !loadError && organization && (
        <Section title="Organization">
          <form className="space-y-4" onSubmit={saveOrganization} noValidate>
            <div className="space-y-2">
              <Label htmlFor="organization-email">Notification email</Label>
              <Input id="organization-email" type="email" value={organizationEmail} maxLength={254} placeholder="operations@example.com" onChange={(event) => setOrganizationEmail(event.target.value)} onBlur={() => setOrganizationEmail(normalizeEmail(organizationEmail))} aria-invalid={!validEmail(organizationEmail)} />
              <p className={`text-xs ${validEmail(organizationEmail) ? "text-muted-foreground" : "text-destructive"}`}>
                {validEmail(organizationEmail) ? "Used when a location does not have its own notification email." : "Enter a valid email address or leave blank."}
              </p>
            </div>
            {organizationError && <p className="text-sm text-destructive">{organizationError}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={!organizationDirty || !organizationValid || organizationSaving}>
                {organizationSaving && <Loader2 className="animate-spin" />} Save changes
              </Button>
            </div>
          </form>
        </Section>
      )}

      {role === "owner" && !loading && !loadError && organization && (
        <Section title="Locations">
          {locations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Building2 className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No active locations</p>
              <p className="mt-1 text-xs text-muted-foreground">There are no existing locations to configure.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location) => (
                <div key={location.id} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10"><MapPin className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{location.name}</p>
                      {location.notificationEmail ? (
                        <p className="break-all text-xs text-muted-foreground">Own email: {location.notificationEmail}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Uses organization notification email when blank.</p>
                      )}
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => openLocation(location)}><Pencil /> Edit</Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Location creation and deletion are managed outside this release.</p>
        </Section>
      )}

      {role === "owner" && (
        <Section title="Team Members">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-medium text-foreground">Manage organization users</p><p className="mt-1 text-xs text-muted-foreground">Invite users and update roles, location access, and active status.</p></div>
            <Button render={<Link href="/admin/users" />} nativeButton={false} variant="outline">Manage users</Button>
          </div>
        </Section>
      )}

      <Section title="Notifications">
        <div className="space-y-3">
          {[
            { label: "New record uploaded", description: "Notify when any director uploads a new record" },
            { label: "Record marked Needs Attention", description: "Notify when a record requires follow-up" },
            { label: "Director adds a comment", description: "Notify when a comment is added to a record" },
            { label: "Record reviewed", description: "Notify when a record is marked reviewed" },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-lg px-2 py-2">
              <div><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div>
              <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">On</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">In-app notification events remain enabled. Owners can configure the organization and location mailboxes above.</p>
      </Section>

      <Section title="Compliance Categories">
        <div className="flex flex-wrap gap-2">{COMPLIANCE_CATEGORIES.map((category) => <span key={category} className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{category}</span>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Category management will be available in a future release. Categories can be customized per regulatory requirements.</p>
      </Section>

      <Section title="Operations Record Types">
        <div className="flex flex-wrap gap-2">{OPERATIONS_RECORD_TYPES.map((type) => <span key={type} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{type}</span>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Operations record-type management will be available in a future release.</p>
      </Section>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 opacity-85">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold text-muted-foreground">Coming Soon</p></div>
        <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
          <li>• Advanced notification preferences</li><li>• Audit log export (CSV, PDF)</li><li>• Custom compliance category management</li><li>• SSO / single sign-on integration</li>
        </ul>
      </div>

      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open && !locationSaving) setEditTarget(null) }}>
        <DialogContent>
          <form className="contents" onSubmit={saveLocation} noValidate>
            <DialogHeader><DialogTitle>Edit location</DialogTitle><DialogDescription>Update the name and optional mailbox for this existing location.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-name">Location name</Label>
                <Input id="location-name" value={locationName} maxLength={160} onChange={(event) => setLocationName(event.target.value)} aria-invalid={normalizeName(locationName).length === 0} />
                {normalizeName(locationName).length === 0 && <p className="text-xs text-destructive">Location name is required.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-email">Notification email</Label>
                <Input id="location-email" type="email" value={locationEmail} maxLength={254} placeholder={organization?.notificationEmail || "operations@example.com"} onChange={(event) => setLocationEmail(event.target.value)} aria-invalid={!validEmail(locationEmail)} />
                <p className={`text-xs ${validEmail(locationEmail) ? "text-muted-foreground" : "text-destructive"}`}>{validEmail(locationEmail) ? "Uses organization notification email when blank." : "Enter a valid email address or leave blank."}</p>
              </div>
              {locationError && <p className="text-sm text-destructive">{locationError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={locationSaving} onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={!locationDirty || !locationValid || locationSaving}>{locationSaving && <Loader2 className="animate-spin" />} Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
