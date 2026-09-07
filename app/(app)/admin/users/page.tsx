"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MailPlus, Pencil, RotateCcw, Send, ShieldAlert, UserRoundX, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useApp } from "@/lib/store"
import { useAuth } from "@/lib/auth"
import { USERS } from "@/lib/mock-data"
import { ApiClientError, type ApiRole } from "@/lib/api-client"
import {
  disableAdminUser,
  inviteAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  resendAdminUserInvite,
  updateAdminUser,
  type AdminUser,
  type InviteUserResult,
} from "@/lib/user-admin-api"
import { Badge } from "@/components/ui/badge"
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

const ROLE_LABELS: Record<ApiRole, string> = {
  OWNER: "Owner",
  DIRECTOR: "Director",
  ASSISTANT_DIRECTOR: "Assistant Director",
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback
}

function sameIds(left: string[], right: string[]) {
  return [...left].sort().join("|") === [...right].sort().join("|")
}

function formatDate(value?: string) {
  if (!value) return "Never"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function UserAdministrationPage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const { role, setRole, currentUser, locations, isDemoMode, showToast } = useApp()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [draftRole, setDraftRole] = useState<ApiRole>("DIRECTOR")
  const [draftLocationIds, setDraftLocationIds] = useState<string[]>([])
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)
  const [lifecycleTarget, setLifecycleTarget] = useState<AdminUser | null>(null)
  const [lifecycleSaving, setLifecycleSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<ApiRole>("DIRECTOR")
  const [inviteLocationIds, setInviteLocationIds] = useState<string[]>([])
  const [inviteError, setInviteError] = useState("")
  const [inviteResult, setInviteResult] = useState<InviteUserResult | null>(null)
  const [inviting, setInviting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const inviteSubmittingRef = useRef(false)

  const load = useCallback(async () => {
    if (role !== "owner") {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError("")
    try {
      if (isDemoMode) {
        const demoUsers: AdminUser[] = USERS.map((user, index) => ({
          id: user.id,
          displayName: user.name,
          email: `${user.name.toLowerCase().replaceAll(" ", ".")}@example.test`,
          role: user.role.toUpperCase() as ApiRole,
          status: "ACTIVE",
          locations: user.locationId
            ? locations.filter((location) => location.id === user.locationId).map((location) => ({ id: location.id, name: location.name }))
            : [],
          createdAt: new Date(2026, 0, index + 2).toISOString(),
        }))
        setUsers(demoUsers)
        setTotalElements(demoUsers.length)
        setTotalPages(1)
      } else {
        const result = await listAdminUsers(page)
        setUsers(result.content)
        setTotalElements(result.totalElements)
        setTotalPages(Math.max(result.totalPages, 1))
      }
    } catch (error) {
      setLoadError(errorMessage(error, "Users could not be loaded."))
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, locations, page, role])

  useEffect(() => { void load() }, [load])

  const dirty = useMemo(() => {
    if (!editTarget) return false
    const normalizedDraft = draftRole === "OWNER" ? [] : draftLocationIds
    return draftRole !== editTarget.role || !sameIds(normalizedDraft, editTarget.locations.map((location) => location.id))
  }, [draftLocationIds, draftRole, editTarget])

  const openEdit = (user: AdminUser) => {
    setEditTarget(user)
    setDraftRole(user.role)
    setDraftLocationIds(user.locations.map((location) => location.id))
    setEditError("")
  }

  const replaceUser = (updated: AdminUser) => {
    setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
  }

  const resetInvite = () => {
    setInviteName("")
    setInviteEmail("")
    setInviteRole("DIRECTOR")
    setInviteLocationIds([])
    setInviteError("")
    setInviteResult(null)
  }

  const openInvite = () => {
    resetInvite()
    setInviteOpen(true)
  }

  const inviteValid = inviteName.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())
    && (inviteRole === "OWNER" || inviteLocationIds.length > 0)

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteValid || inviteSubmittingRef.current) return
    inviteSubmittingRef.current = true
    setInviting(true)
    setInviteError("")
    try {
      const selectedLocations = locations
        .filter((location) => inviteLocationIds.includes(location.id))
        .map((location) => ({ id: location.id, name: location.name }))
      const result: InviteUserResult = isDemoMode
        ? {
            user: {
              id: `invited-${Date.now()}`,
              displayName: inviteName.trim().replace(/\s+/g, " "),
              email: inviteEmail.trim().toLowerCase(),
              role: inviteRole,
              status: "INVITED",
              locations: inviteRole === "OWNER" ? [] : selectedLocations,
              createdAt: new Date().toISOString(),
            },
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          }
        : await inviteAdminUser(inviteName, inviteEmail, inviteRole, inviteRole === "OWNER" ? [] : inviteLocationIds)
      setUsers((current) => [result.user, ...current])
      setTotalElements((value) => value + 1)
      setInviteResult(result)
      showToast("Invitation created")
    } catch (error) {
      setInviteError(errorMessage(error, "The invitation could not be created."))
    } finally {
      setInviting(false)
      inviteSubmittingRef.current = false
    }
  }

  const resendInvite = async (user: AdminUser) => {
    if (resendingId) return
    setResendingId(user.id)
    try {
      const result = isDemoMode
        ? { user, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() }
        : await resendAdminUserInvite(user.id)
      replaceUser(result.user)
      setInviteResult(result)
      setInviteOpen(true)
      showToast("Setup instructions resent")
    } catch (error) {
      showToast(errorMessage(error, "Setup instructions could not be resent."))
    } finally {
      setResendingId(null)
    }
  }

  const saveEdit = async () => {
    if (!editTarget || !dirty) return
    if (draftRole !== "OWNER" && draftLocationIds.length === 0) {
      setEditError("Choose at least one location for this role.")
      return
    }
    setSaving(true)
    setEditError("")
    try {
      const selectedLocations = locations
        .filter((location) => draftLocationIds.includes(location.id))
        .map((location) => ({ id: location.id, name: location.name }))
      const updated = isDemoMode
        ? { ...editTarget, role: draftRole, locations: draftRole === "OWNER" ? [] : selectedLocations }
        : await updateAdminUser(editTarget.id, draftRole, draftRole === "OWNER" ? [] : draftLocationIds)
      replaceUser(updated)
      setEditTarget(null)
      showToast("User access updated")
      if (editTarget.id === currentUser.id && draftRole !== "OWNER") {
        if (isDemoMode) setRole(draftRole.toLowerCase() as "director" | "assistant_director")
        else {
          try {
            await refreshSession()
          } catch {
            window.location.reload()
            return
          }
          router.replace("/dashboard")
        }
      }
    } catch (error) {
      setEditError(errorMessage(error, "User access could not be updated."))
    } finally {
      setSaving(false)
    }
  }

  const changeLifecycle = async () => {
    if (!lifecycleTarget) return
    const disabling = lifecycleTarget.status !== "DISABLED"
    setLifecycleSaving(true)
    try {
      const updated = isDemoMode
        ? { ...lifecycleTarget, status: disabling ? "DISABLED" as const : "ACTIVE" as const }
        : disabling
          ? await disableAdminUser(lifecycleTarget.id)
          : await reactivateAdminUser(lifecycleTarget.id)
      replaceUser(updated)
      setLifecycleTarget(null)
      showToast(disabling ? "User disabled" : "User reactivated")
    } catch (error) {
      showToast(errorMessage(error, disabling ? "User could not be disabled." : "User could not be reactivated."))
    } finally {
      setLifecycleSaving(false)
    }
  }

  if (role !== "owner") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Owner access required</h2>
        <p className="mt-1 text-sm text-muted-foreground">User administration is available only to organization Owners.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User administration</h2>
          <p className="mt-1 text-sm text-muted-foreground">Invite users and manage roles, location access, and account status.</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !loadError && <p className="text-xs text-muted-foreground">{totalElements} {totalElements === 1 ? "user" : "users"}</p>}
          <Button className="gap-1.5" onClick={openInvite}><MailPlus className="h-4 w-4" />Invite user</Button>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading users…</span>
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm font-medium text-foreground">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Try again</Button>
        </div>
      )}

      {!loading && !loadError && users.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No users found</p>
          <p className="mt-1 text-xs text-muted-foreground">Invite a user to give them secure access.</p>
        </div>
      )}

      {!loading && !loadError && users.length > 0 && (
        <div className="grid gap-3">
          {users.map((user) => {
            const isSelf = user.id === currentUser.id
            return (
              <article key={user.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-semibold text-foreground">{user.displayName}</h3>
                      {isSelf && <Badge variant="outline">You</Badge>}
                      <Badge className={user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                        {user.status === "ACTIVE" ? "Active" : user.status === "DISABLED" ? "Disabled" : "Pending setup"}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{user.email}</p>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                      <div><span className="text-muted-foreground">Role</span><p className="mt-0.5 font-medium text-foreground">{ROLE_LABELS[user.role]}</p></div>
                      <div className="sm:col-span-2"><span className="text-muted-foreground">Locations</span><p className="mt-0.5 font-medium text-foreground">{user.role === "OWNER" ? "All organization locations" : user.locations.map((location) => location.name).join(", ") || "None assigned"}</p></div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">Last login: {formatDate(user.lastLoginAt)} · Added: {formatDate(user.createdAt)}</p>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" onClick={() => openEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" />Edit access
                    </Button>
                    {user.status === "INVITED" && (
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" disabled={resendingId === user.id} onClick={() => void resendInvite(user)}>
                        {resendingId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Resend invite
                      </Button>
                    )}
                    {(user.status === "ACTIVE" || user.status === "INVITED") && (
                      <Button variant="destructive" size="sm" className="flex-1 gap-1.5 sm:flex-none" disabled={isSelf} title={isSelf ? "You cannot disable your own account" : undefined} onClick={() => setLifecycleTarget(user)}>
                        <UserRoundX className="h-3.5 w-3.5" />Disable
                      </Button>
                    )}
                    {user.status === "DISABLED" && (
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none" onClick={() => setLifecycleTarget(user)}>
                        <RotateCcw className="h-3.5 w-3.5" />Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && !loadError && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open && !inviting) { setInviteOpen(false); resetInvite() } }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
          {inviteResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Invitation ready</DialogTitle>
                <DialogDescription>
                  {inviteResult.user.displayName} is pending setup. The latest link expires {new Date(inviteResult.expiresAt).toLocaleString()}.
                </DialogDescription>
              </DialogHeader>
              {inviteResult.developmentSetupUrl ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">Development setup link</p>
                  <p className="mt-1 text-xs leading-relaxed">Email delivery is disabled. This one-time URL is shown only by the backend&apos;s development response.</p>
                  <a className="mt-3 inline-flex break-all font-medium text-primary underline underline-offset-4" href={inviteResult.developmentSetupUrl}>
                    Open setup page
                  </a>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Setup instructions were queued for email delivery.</p>
              )}
              <DialogFooter>
                <Button onClick={() => { setInviteOpen(false); resetInvite() }}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={submitInvite} noValidate>
              <DialogHeader>
                <DialogTitle>Invite user</DialogTitle>
                <DialogDescription>Create a pending account. The user will choose their own password from a one-time setup link.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name">Full name</Label>
                  <Input id="invite-name" autoComplete="name" required maxLength={200} value={inviteName} onChange={(event) => { setInviteName(event.target.value); setInviteError("") }} disabled={inviting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input id="invite-email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={254} value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteError("") }} disabled={inviting} />
                </div>
                <label className="block space-y-1.5 text-sm font-medium">
                  Role
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={inviteRole} onChange={(event) => { const next = event.target.value as ApiRole; setInviteRole(next); if (next === "OWNER") setInviteLocationIds([]); setInviteError("") }} disabled={inviting}>
                    <option value="OWNER">Owner</option>
                    <option value="DIRECTOR">Director</option>
                    <option value="ASSISTANT_DIRECTOR">Assistant Director</option>
                  </select>
                </label>
                <fieldset disabled={inviteRole === "OWNER" || inviting} className="space-y-2 disabled:opacity-60">
                  <legend className="text-sm font-medium">Assigned locations</legend>
                  {inviteRole === "OWNER" && <p className="text-xs text-muted-foreground">Owners automatically receive organization-wide access.</p>}
                  {inviteRole !== "OWNER" && locations.length === 0 && <p className="text-xs text-destructive">No active locations are available to assign.</p>}
                  {inviteRole !== "OWNER" && locations.map((location) => (
                    <label key={location.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={inviteLocationIds.includes(location.id)} onChange={(event) => { setInviteLocationIds((current) => event.target.checked ? [...current, location.id] : current.filter((id) => id !== location.id)); setInviteError("") }} />
                      <span className="min-w-0 break-words">{location.name}</span>
                    </label>
                  ))}
                </fieldset>
                {inviteError && <p role="alert" className="text-sm text-destructive">{inviteError}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setInviteOpen(false); resetInvite() }} disabled={inviting}>Cancel</Button>
                <Button type="submit" disabled={!inviteValid || inviting}>
                  {inviting && <Loader2 className="h-4 w-4 animate-spin" />}Send invitation
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => { if (!open && !saving) setEditTarget(null) }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user access</DialogTitle>
            <DialogDescription>Update {editTarget?.displayName}&apos;s role and location access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <label className="block space-y-1.5 text-sm font-medium">
              Role
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draftRole} onChange={(event) => { const next = event.target.value as ApiRole; setDraftRole(next); if (next === "OWNER") setDraftLocationIds([]); setEditError("") }}>
                <option value="OWNER">Owner</option>
                <option value="DIRECTOR">Director</option>
                <option value="ASSISTANT_DIRECTOR">Assistant Director</option>
              </select>
            </label>
            <fieldset disabled={draftRole === "OWNER" || saving} className="space-y-2 disabled:opacity-60">
              <legend className="text-sm font-medium">Assigned locations</legend>
              {draftRole === "OWNER" && <p className="text-xs text-muted-foreground">Owners automatically have organization-wide access.</p>}
              {draftRole !== "OWNER" && locations.map((location) => (
                <label key={location.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftLocationIds.includes(location.id)} onChange={(event) => { setDraftLocationIds((current) => event.target.checked ? [...current, location.id] : current.filter((id) => id !== location.id)); setEditError("") }} />
                  <span className="min-w-0 break-words">{location.name}</span>
                </label>
              ))}
            </fieldset>
            {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={!dirty || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lifecycleTarget)} onOpenChange={(open) => { if (!open && !lifecycleSaving) setLifecycleTarget(null) }}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lifecycleTarget?.status === "DISABLED" ? "Reactivate this user?" : "Disable this user?"}</DialogTitle>
            <DialogDescription>
              {lifecycleTarget?.status !== "DISABLED"
                ? `${lifecycleTarget?.displayName} will immediately lose sign-in or setup eligibility. Their assignments and historical activity will remain intact.`
                : `${lifecycleTarget?.displayName} will regain sign-in and eligible workspace access with the same identity.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={lifecycleSaving} onClick={() => setLifecycleTarget(null)}>Cancel</Button>
            <Button variant={lifecycleTarget?.status === "DISABLED" ? "default" : "destructive"} disabled={lifecycleSaving} onClick={() => void changeLifecycle()}>
              {lifecycleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {lifecycleTarget?.status === "DISABLED" ? "Reactivate user" : "Disable user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
