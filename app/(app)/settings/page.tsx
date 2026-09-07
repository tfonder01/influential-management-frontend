"use client"

import Link from "next/link"
import { Shield, MapPin } from "lucide-react"
import { useApp } from "@/lib/store"
import { COMPLIANCE_CATEGORIES, LOCATIONS, OPERATIONS_RECORD_TYPES } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="border-b border-border pb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { role, currentUser } = useApp()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile */}
      <Section title="Your Profile">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
              role === "owner" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700"
            }`}
          >
            {currentUser.initials}
          </div>
          <div>
            <p className="font-semibold text-foreground">{currentUser.name}</p>
            <p className="text-sm capitalize text-muted-foreground">{currentUser.role.replace("_", " ")}</p>
            {currentUser.locationId && (
              <p className="text-xs text-muted-foreground">
                {LOCATIONS.find((l) => l.id === currentUser.locationId)?.name}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Locations */}
      {role === "owner" && (
        <Section title="Locations">
          <div className="space-y-3">
            {LOCATIONS.map((loc) => (
              <div
                key={loc.id}
                className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/15 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Director: {loc.director} &middot; Capacity: {loc.capacity}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground sm:text-right">{loc.phone}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            To add or remove locations, contact your system administrator.
          </p>
        </Section>
      )}

      {/* Team */}
      {role === "owner" && (
        <Section title="Team Members">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Manage organization users</p>
              <p className="mt-1 text-xs text-muted-foreground">Update roles, location access, and active status.</p>
            </div>
            <Button render={<Link href="/admin/users" />} nativeButton={false} variant="outline">Manage users</Button>
          </div>
        </Section>
      )}

      {/* Notifications */}
      <Section title="Notifications">
        <div className="space-y-3">
          {[
            { label: "New record uploaded", description: "Notify when any director uploads a new record" },
            { label: "Record marked Needs Attention", description: "Notify when a record requires follow-up" },
            { label: "Director adds a comment", description: "Notify when a comment is added to a record" },
            { label: "Record reviewed", description: "Notify when a record is marked reviewed" },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-lg px-2 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                On
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Email and push notification settings will be configurable in a future release. Currently all in-app notifications are enabled.
        </p>
      </Section>

      {/* Compliance Categories */}
      <Section title="Compliance Categories">
        <div className="flex flex-wrap gap-2">
          {COMPLIANCE_CATEGORIES.map((cat) => (
            <span
              key={cat}
              className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {cat}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Category management will be available in a future release. Categories can be customized per regulatory requirements.
        </p>
      </Section>

      <Section title="Operations Record Types">
        <div className="flex flex-wrap gap-2">
          {OPERATIONS_RECORD_TYPES.map((type) => (
            <span
              key={type}
              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              {type}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Operations record-type management will be available in a future release.
        </p>
      </Section>

      {/* Coming Soon */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 opacity-85">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">Coming Soon</p>
        </div>
        <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
          <li>• User invitations and account setup links</li>
          <li>• Email and push notification configuration</li>
          <li>• Audit log export (CSV, PDF)</li>
          <li>• Custom compliance category management</li>
          <li>• SSO / single sign-on integration</li>
        </ul>
      </div>
    </div>
  )
}
