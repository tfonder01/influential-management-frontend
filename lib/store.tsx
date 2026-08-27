"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react"
import type {
  ComplianceRecord,
  Comment,
  ActivityEvent,
  Notification,
  Role,
  Location,
  MaintenanceRequest,
  SupplyRequest,
} from "./types"
import { ToastViewport, type ToastMessage } from "@/components/toast-viewport"
import type { SessionUser } from "./api-client"
import {
  RECORDS as INITIAL_RECORDS,
  COMMENTS as INITIAL_COMMENTS,
  ACTIVITY as INITIAL_ACTIVITY,
  NOTIFICATIONS as INITIAL_NOTIFICATIONS,
  MAINTENANCE_REQUESTS as INITIAL_MAINTENANCE_REQUESTS,
  SUPPLY_REQUESTS as INITIAL_SUPPLY_REQUESTS,
  USERS,
  LOCATIONS,
} from "./mock-data"
import {
  listAllRecords,
  createRecordApi,
  updateRecordApi,
  updateRecordStatusApi,
  archiveRecordApi,
  restoreRecordApi,
  addCommentApi,
  listCommentsApi,
  commentFromApi,
  isApiClientError,
  type CreateRecordInput,
  type UpdateRecordInput,
} from "./records-api"

function productionErrorMessage(error: unknown, fallback: string): string {
  if (isApiClientError(error)) return error.message || fallback
  return fallback
}

/**
 * List responses intentionally contain summaries only. Preserve fields that can only come from a
 * freshly fetched detail response so a slower list hydration cannot erase them on a direct-page load.
 */
function mergeRecordSummaries(previous: ComplianceRecord[], summaries: ComplianceRecord[]): ComplianceRecord[] {
  const previousById = new Map(previous.map((record) => [record.id, record]))
  return summaries.map((summary) => {
    const detail = previousById.get(summary.id)
    if (detail?.attachments === undefined) return summary
    return {
      ...summary,
      description: detail.description,
      fileNames: detail.fileNames,
      attachments: detail.attachments,
    }
  })
}

interface AppState {
  role: Role
  setRole: (role: Role) => void
  currentUser: (typeof USERS)[0]
  locations: Location[]
  records: ComplianceRecord[]
  comments: Comment[]
  activity: ActivityEvent[]
  notifications: Notification[]
  maintenanceRequests: MaintenanceRequest[]
  supplyRequests: SupplyRequest[]
  updateRecordStatus: (id: string, status: ComplianceRecord["status"]) => void
  archiveRecord: (id: string) => void
  restoreRecord: (id: string) => void
  addRecord: (record: ComplianceRecord) => void
  addComment: (comment: Comment) => void
  recordsLoading: boolean
  recordsError: string | null
  refreshRecords: () => Promise<void>
  upsertRecord: (record: ComplianceRecord) => void
  loadRecordComments: (recordId: string) => Promise<void>
  createProductionRecord: (input: CreateRecordInput) => Promise<ComplianceRecord>
  editRecord: (id: string, updates: Partial<ComplianceRecord>) => void
  updateProductionRecord: (id: string, input: UpdateRecordInput) => Promise<ComplianceRecord>
  addMaintenanceRequest: (request: MaintenanceRequest) => void
  updateMaintenanceRequest: (id: string, updates: Partial<MaintenanceRequest>, detail?: string) => void
  archiveMaintenanceRequest: (id: string) => void
  restoreMaintenanceRequest: (id: string) => void
  addMaintenanceFile: (
    id: string,
    field: "originalPhotos" | "completionPhotos" | "invoices",
    fileName: string
  ) => void
  addSupplyRequest: (request: SupplyRequest) => void
  updateSupplyRequest: (id: string, updates: Partial<SupplyRequest>, detail?: string) => void
  archiveSupplyRequest: (id: string) => void
  restoreSupplyRequest: (id: string) => void
  addSupplyPhoto: (id: string, fileName: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  unreadCount: number
  showToast: (message: string) => void
  isDemoMode: boolean
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children, productionUser }: { children: React.ReactNode; productionUser?: SessionUser | null }) {
  const productionMode = Boolean(productionUser)
  const productionRole = productionUser?.role.toLowerCase() as Role | undefined
  const [role, setRoleState] = useState<Role>(productionRole ?? "owner")
  const [allRecords, setRecords] = useState<ComplianceRecord[]>(INITIAL_RECORDS)
  const [productionRecords, setProductionRecords] = useState<ComplianceRecord[]>([])
  const [productionComments, setProductionComments] = useState<Comment[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS)
  const [activity, setActivity] = useState<ActivityEvent[]>(INITIAL_ACTIVITY)
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS)
  const [allMaintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(INITIAL_MAINTENANCE_REQUESTS)
  const [allSupplyRequests, setSupplyRequests] = useState<SupplyRequest[]>(INITIAL_SUPPLY_REQUESTS)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const currentUser = useMemo(() => productionUser
    ? ({
        id: productionUser.id,
        name: `${productionUser.firstName} ${productionUser.lastName}`,
        role: productionRole!,
        locationId: productionUser.locations[0]?.id,
        initials: `${productionUser.firstName[0] ?? ""}${productionUser.lastName[0] ?? ""}`.toUpperCase(),
      })
    : role === "owner"
      ? USERS.find((user) => user.role === "owner")!
      : role === "director"
        ? USERS.find((user) => user.role === "director")!
        : USERS.find((user) => user.role === "assistant_director")!, [productionUser, productionRole, role])

  const locations = productionUser
    ? productionUser.locations.map((location) => ({
        id: location.id,
        name: location.name,
        director: productionRole === "owner" ? "" : currentUser.name,
        directorId: productionRole === "owner" ? "" : currentUser.id,
        address: [location.addressLine1, location.addressLine2, `${location.city}, ${location.state} ${location.postalCode}`].filter(Boolean).join(", "),
        phone: location.phone ?? "",
        capacity: 0,
      }))
    : role === "owner"
      ? LOCATIONS
      : LOCATIONS.filter((location) => location.id === currentUser.locationId)

  const records = productionMode
    ? productionRecords
    : role === "owner"
      ? allRecords
      : allRecords.filter((record) => record.locationId === currentUser.locationId)

  const refreshRecords = useCallback(async () => {
    if (!productionMode) return
    setRecordsLoading(true)
    setRecordsError(null)
    try {
      const records = await listAllRecords()
      setProductionRecords((previous) => mergeRecordSummaries(previous, records))
    } catch (error) {
      setRecordsError(productionErrorMessage(error, "Failed to load records"))
    } finally {
      setRecordsLoading(false)
    }
  }, [productionMode])

  useEffect(() => {
    if (!productionMode) return
    let cancelled = false
    setRecordsLoading(true)
    listAllRecords()
      .then((records) => {
        if (!cancelled) setProductionRecords((previous) => mergeRecordSummaries(previous, records))
      })
      .catch((error) => { if (!cancelled) setRecordsError(productionErrorMessage(error, "Failed to load records")) })
      .finally(() => { if (!cancelled) setRecordsLoading(false) })
    return () => { cancelled = true }
  }, [productionMode])

  const upsertRecord = useCallback((record: ComplianceRecord) => {
    setProductionRecords((prev) => {
      const index = prev.findIndex((existing) => existing.id === record.id)
      if (index === -1) return [record, ...prev]
      const next = [...prev]
      next[index] = { ...next[index], ...record }
      return next
    })
  }, [])

  const maintenanceRequests = productionMode
    ? []
    : role === "owner"
      ? allMaintenanceRequests
      : allMaintenanceRequests.filter((request) => request.locationId === currentUser.locationId)

  const supplyRequests = productionMode
    ? []
    : role === "owner"
    ? allSupplyRequests
    : allSupplyRequests.filter((request) => request.locationId === currentUser.locationId)

  const visibleRecordIds = new Set(records.map((record) => record.id))
  const visibleMaintenanceIds = new Set(maintenanceRequests.map((request) => request.id))
  const visibleSupplyIds = new Set(supplyRequests.map((request) => request.id))
  const isVisibleEntity = (id: string) => visibleRecordIds.has(id) || visibleMaintenanceIds.has(id) || visibleSupplyIds.has(id)
  const visibleActivity = productionMode
    ? []
    : role === "owner"
      ? activity
      : activity.filter((event) => isVisibleEntity(event.recordId))
  const visibleComments = productionMode
    ? productionComments
    : role === "owner"
      ? comments
      : comments.filter((comment) => isVisibleEntity(comment.recordId))
  const visibleNotifications = productionMode
    ? []
    : role === "owner"
      ? notifications
      : notifications.filter((notification) => !notification.recordId || isVisibleEntity(notification.recordId))

  const setRole = useCallback((r: Role) => { if (!productionMode) setRoleState(r) }, [productionMode])

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3200)
  }, [])

  const addActivityEvent = useCallback(
    (event: Omit<ActivityEvent, "id">) => {
      setActivity((prev) => [
        { ...event, id: `act_${Date.now()}` },
        ...prev,
      ])
    },
    []
  )

  const updateRecordStatus = useCallback(
    (id: string, status: ComplianceRecord["status"]) => {
      if (productionMode) {
        if (status !== "Reviewed" && status !== "Needs Attention") return
        updateRecordStatusApi(id, status)
          .then((updated) => {
            upsertRecord(updated)
            showToast(status === "Reviewed" ? "Record marked Reviewed" : "Record marked Needs Attention")
          })
          .catch((error) => showToast(productionErrorMessage(error, "Failed to update status")))
        return
      }
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, lastUpdated: new Date().toISOString().split("T")[0] } : r
        )
      )
      const record = allRecords.find((r) => r.id === id)
      if (record) {
        addActivityEvent({
          recordId: id,
          type: "status_changed",
          user: currentUser.name,
          userId: currentUser.id,
          role: currentUser.role,
          timestamp: new Date().toISOString(),
          detail: `Status changed to ${status}.`,
        })
      }
      showToast(status === "Reviewed" ? "Record marked Reviewed" : "Record marked Needs Attention")
    },
    [productionMode, upsertRecord, allRecords, currentUser, addActivityEvent, showToast]
  )

  const archiveRecord = useCallback(
    (id: string) => {
      if (productionMode) {
        archiveRecordApi(id)
          .then((updated) => { upsertRecord(updated); showToast("Record archived") })
          .catch((error) => showToast(productionErrorMessage(error, "Failed to archive record")))
        return
      }
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "Archived", lastUpdated: new Date().toISOString().split("T")[0] } : r
        )
      )
      addActivityEvent({
        recordId: id,
        type: "archived",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: "Record archived.",
      })
      showToast("Record archived")
    },
    [productionMode, upsertRecord, currentUser, addActivityEvent, showToast]
  )

  const restoreRecord = useCallback(
    (id: string) => {
      if (productionMode) {
        restoreRecordApi(id)
          .then((updated) => { upsertRecord(updated); showToast("Record restored") })
          .catch((error) => showToast(productionErrorMessage(error, "Failed to restore record")))
        return
      }
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "New", lastUpdated: new Date().toISOString().split("T")[0] } : r
        )
      )
      addActivityEvent({
        recordId: id,
        type: "restored",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: "Record restored from archive.",
      })
      showToast("Record restored")
    },
    [productionMode, upsertRecord, currentUser, addActivityEvent, showToast]
  )

  const createProductionRecord = useCallback(
    async (input: CreateRecordInput) => {
      const record = await createRecordApi(input)
      upsertRecord(record)
      showToast("Record uploaded")
      return record
    },
    [upsertRecord, showToast]
  )

  const editRecord = useCallback(
    (id: string, updates: Partial<ComplianceRecord>) => {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ...updates, lastUpdated: new Date().toISOString().split("T")[0] } : r
        )
      )
      addActivityEvent({
        recordId: id,
        type: "edited",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: "Record details updated.",
      })
      showToast("Record updated")
    },
    [currentUser, addActivityEvent, showToast]
  )

  const updateProductionRecord = useCallback(
    async (id: string, input: UpdateRecordInput) => {
      const detail = await updateRecordApi(id, input)
      upsertRecord(detail.record)
      showToast("Record updated")
      return detail.record
    },
    [upsertRecord, showToast]
  )

  const loadRecordComments = useCallback(
    async (recordId: string) => {
      if (!productionMode) return
      try {
        const apiComments = await listCommentsApi(recordId)
        const mapped = apiComments.map((comment) => commentFromApi(comment, recordId, currentUser.id, currentUser.role))
        setProductionComments((prev) => [...prev.filter((comment) => comment.recordId !== recordId), ...mapped])
      } catch {
        // Comments are supplementary to the record detail view; a failed fetch should not block the page.
      }
    },
    [productionMode, currentUser]
  )

  const addRecord = useCallback(
    (record: ComplianceRecord) => {
      setRecords((prev) => [record, ...prev])
      addActivityEvent({
        recordId: record.id,
        type: "created",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: "Record created.",
      })
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          type: "upload",
          title: "New record uploaded",
          message: `${currentUser.name} uploaded "${record.title}".`,
          timestamp: new Date().toISOString(),
          recordId: record.id,
          isRead: false,
        },
        ...prev,
      ])
      showToast("Record uploaded")
    },
    [currentUser, addActivityEvent, showToast]
  )

  const addComment = useCallback(
    (comment: Comment) => {
      if (productionMode) {
        addCommentApi(comment.recordId, comment.text)
          .then((saved) => {
            const mapped = commentFromApi(saved, comment.recordId, currentUser.id, currentUser.role)
            setProductionComments((prev) => [...prev, mapped])
            showToast("Comment added")
          })
          .catch((error) => showToast(productionErrorMessage(error, "Failed to add comment")))
        return
      }
      setComments((prev) => [...prev, comment])
      addActivityEvent({
        recordId: comment.recordId,
        type: "comment_added",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: "Comment added.",
      })
      showToast("Comment added")
    },
    [productionMode, currentUser, addActivityEvent, showToast]
  )

  const addMaintenanceRequest = useCallback(
    (request: MaintenanceRequest) => {
      setMaintenanceRequests((prev) => [request, ...prev])
      addActivityEvent({
        recordId: request.id,
        type: "created",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail: request.approvalStatus === "Awaiting Approval"
          ? "Maintenance request submitted and sent for Owner approval."
          : "Maintenance request submitted.",
      })
      setNotifications((prev) => [{
        id: `mnotif_${Date.now()}`,
        type: "maintenance",
        title: request.approvalStatus === "Awaiting Approval" ? "Maintenance approval required" : "New maintenance request",
        message: `${request.title} was submitted by ${request.submittedBy}.`,
        timestamp: new Date().toISOString(),
        recordId: request.id,
        source: "maintenance",
        isRead: false,
      }, ...prev])
      showToast("Maintenance request submitted")
    },
    [currentUser, addActivityEvent, showToast]
  )

  const updateMaintenanceRequest = useCallback(
    (id: string, updates: Partial<MaintenanceRequest>, detail = "Maintenance request updated.") => {
      setMaintenanceRequests((prev) => prev.map((request) =>
        request.id === id
          ? { ...request, ...updates, lastUpdated: new Date().toISOString() }
          : request
      ))
      addActivityEvent({
        recordId: id,
        type: updates.maintenanceStatus || updates.approvalStatus ? "status_changed" : "edited",
        user: currentUser.name,
        userId: currentUser.id,
        role: currentUser.role,
        timestamp: new Date().toISOString(),
        detail,
      })
      if (updates.approvalStatus || updates.maintenanceStatus === "Completed") {
        setNotifications((prev) => [{
          id: `mnotif_${Date.now()}`,
          type: "maintenance",
          title: updates.maintenanceStatus === "Completed" ? "Repair completed" : `Request ${String(updates.approvalStatus).toLowerCase()}`,
          message: detail,
          timestamp: new Date().toISOString(),
          recordId: id,
          source: "maintenance",
          isRead: false,
        }, ...prev])
      }
      showToast(detail)
    },
    [currentUser, addActivityEvent, showToast]
  )

  const archiveMaintenanceRequest = useCallback((id: string) => {
    setMaintenanceRequests((prev) => prev.map((request) =>
      request.id === id ? { ...request, archived: true, lastUpdated: new Date().toISOString() } : request
    ))
    addActivityEvent({
      recordId: id,
      type: "archived",
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      timestamp: new Date().toISOString(),
      detail: "Maintenance request archived.",
    })
    showToast("Maintenance request archived")
  }, [currentUser, addActivityEvent, showToast])

  const restoreMaintenanceRequest = useCallback((id: string) => {
    setMaintenanceRequests((prev) => prev.map((request) =>
      request.id === id ? { ...request, archived: false, lastUpdated: new Date().toISOString() } : request
    ))
    addActivityEvent({
      recordId: id,
      type: "restored",
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      timestamp: new Date().toISOString(),
      detail: "Maintenance request restored from archive.",
    })
    showToast("Maintenance request restored")
  }, [currentUser, addActivityEvent, showToast])

  const addMaintenanceFile = useCallback((
    id: string,
    field: "originalPhotos" | "completionPhotos" | "invoices",
    fileName: string
  ) => {
    const attachment = { name: fileName, uploadedAt: new Date().toISOString(), uploadedBy: currentUser.name }
    setMaintenanceRequests((prev) => prev.map((request) =>
      request.id === id
        ? { ...request, [field]: [...request[field], attachment], lastUpdated: new Date().toISOString() }
        : request
    ))
    const label = field === "invoices" ? "Invoice" : field === "completionPhotos" ? "Completion photo" : "Photo"
    addActivityEvent({
      recordId: id,
      type: "file_uploaded",
      user: currentUser.name,
      userId: currentUser.id,
      role: currentUser.role,
      timestamp: new Date().toISOString(),
      detail: `${label} uploaded: ${fileName}.`,
    })
    if (field === "invoices") {
      setNotifications((prev) => [{
        id: `mnotif_${Date.now()}`,
        type: "maintenance",
        title: "Maintenance invoice uploaded",
        message: `${currentUser.name} uploaded ${fileName}.`,
        timestamp: new Date().toISOString(),
        recordId: id,
        source: "maintenance",
        isRead: false,
      }, ...prev])
    }
    showToast(`${label} attached`)
  }, [currentUser, addActivityEvent, showToast])

  const addSupplyRequest = useCallback((request: SupplyRequest) => {
    setSupplyRequests((prev) => [request, ...prev])
    addActivityEvent({
      recordId: request.id, type: "created", user: currentUser.name, userId: currentUser.id,
      role: currentUser.role, timestamp: new Date().toISOString(),
      detail: request.approvalStatus === "Awaiting Approval" ? "Supply request submitted for Owner approval." : "Supply request submitted.",
    })
    setNotifications((prev) => [{
      id: `snotif_${Date.now()}`, type: "supply", title: request.approvalRequired ? "Supply approval required" : "New supply request",
      message: `${request.itemName} was requested by ${request.requestedBy}.`, timestamp: new Date().toISOString(),
      recordId: request.id, source: "supply", isRead: false,
    }, ...prev])
    showToast("Supply request submitted")
  }, [currentUser, addActivityEvent, showToast])

  const updateSupplyRequest = useCallback((id: string, updates: Partial<SupplyRequest>, detail = "Supply request updated.") => {
    setSupplyRequests((prev) => prev.map((request) => request.id === id
      ? { ...request, ...updates, lastUpdated: new Date().toISOString() }
      : request))
    addActivityEvent({
      recordId: id, type: updates.fulfillmentStatus || updates.approvalStatus ? "status_changed" : "edited",
      user: currentUser.name, userId: currentUser.id, role: currentUser.role, timestamp: new Date().toISOString(), detail,
    })
    if (updates.approvalStatus || updates.fulfillmentStatus) {
      setNotifications((prev) => [{
        id: `snotif_${Date.now()}`, type: "supply", title: "Supply request updated", message: detail,
        timestamp: new Date().toISOString(), recordId: id, source: "supply", isRead: false,
      }, ...prev])
    }
    showToast(detail)
  }, [currentUser, addActivityEvent, showToast])

  const archiveSupplyRequest = useCallback((id: string) => {
    setSupplyRequests((prev) => prev.map((request) => request.id === id ? { ...request, archived: true, lastUpdated: new Date().toISOString() } : request))
    addActivityEvent({ recordId: id, type: "archived", user: currentUser.name, userId: currentUser.id, role: currentUser.role, timestamp: new Date().toISOString(), detail: "Supply request archived." })
    showToast("Supply request archived")
  }, [currentUser, addActivityEvent, showToast])

  const restoreSupplyRequest = useCallback((id: string) => {
    setSupplyRequests((prev) => prev.map((request) => request.id === id ? { ...request, archived: false, lastUpdated: new Date().toISOString() } : request))
    addActivityEvent({ recordId: id, type: "restored", user: currentUser.name, userId: currentUser.id, role: currentUser.role, timestamp: new Date().toISOString(), detail: "Supply request restored from archive." })
    showToast("Supply request restored")
  }, [currentUser, addActivityEvent, showToast])

  const addSupplyPhoto = useCallback((id: string, fileName: string) => {
    const attachment = { name: fileName, uploadedAt: new Date().toISOString(), uploadedBy: currentUser.name }
    setSupplyRequests((prev) => prev.map((request) => request.id === id ? { ...request, photos: [...request.photos, attachment], lastUpdated: attachment.uploadedAt } : request))
    addActivityEvent({ recordId: id, type: "file_uploaded", user: currentUser.name, userId: currentUser.id, role: currentUser.role, timestamp: attachment.uploadedAt, detail: `Photo attached: ${fileName}.` })
    showToast("Photo attached")
  }, [currentUser, addActivityEvent, showToast])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }, [])

  const unreadCount = visibleNotifications.filter((n) => !n.isRead).length

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        currentUser,
        locations,
        records,
        comments: visibleComments,
        activity: visibleActivity,
        notifications: visibleNotifications,
        maintenanceRequests,
        supplyRequests,
        updateRecordStatus,
        archiveRecord,
        restoreRecord,
        addRecord,
        addComment,
        recordsLoading,
        recordsError,
        refreshRecords,
        upsertRecord,
        loadRecordComments,
        createProductionRecord,
        editRecord,
        updateProductionRecord,
        addMaintenanceRequest,
        updateMaintenanceRequest,
        archiveMaintenanceRequest,
        restoreMaintenanceRequest,
        addMaintenanceFile,
        addSupplyRequest,
        updateSupplyRequest,
        archiveSupplyRequest,
        restoreSupplyRequest,
        addSupplyPhoto,
        markNotificationRead,
        markAllNotificationsRead,
        unreadCount,
        showToast,
        isDemoMode: !productionMode,
      }}
    >
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      />
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
