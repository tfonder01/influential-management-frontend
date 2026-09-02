"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/store"
import {
  dismissAllNotificationsApi,
  dismissNotificationApi,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type ApiNotification,
} from "@/lib/notifications-api"

interface BellNotification {
  id: string
  title: string
  message: string
  route?: string
  read: boolean
  createdAt: string
}

function notificationTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function routeForDemoNotification(notification: ReturnType<typeof useApp>["notifications"][number]): string | undefined {
  if (!notification.recordId) return undefined
  if (notification.source === "maintenance") return `/maintenance/${notification.recordId}`
  if (notification.source === "supply") return `/supply-requests/${notification.recordId}`
  return `/records/${notification.recordId}`
}

export function NotificationBell() {
  const {
    notifications: demoNotifications,
    unreadCount: demoUnreadCount,
    markNotificationRead: markDemoRead,
    markAllNotificationsRead: markAllDemoRead,
    isDemoMode,
    showToast,
  } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [productionNotifications, setProductionNotifications] = useState<ApiNotification[]>([])
  const [productionUnreadCount, setProductionUnreadCount] = useState(0)
  const [dismissedDemoNotificationIds, setDismissedDemoNotificationIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(!isDemoMode)

  const refresh = useCallback(async () => {
    if (isDemoMode) return
    try {
      const [page, count] = await Promise.all([listNotifications(0, 10), getUnreadNotificationCount()])
      setProductionNotifications(page.content)
      setProductionUnreadCount(count)
    } catch {
      // Keep the last successful state. Authentication/error handling remains centralized in apiClient.
    } finally {
      setLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    if (isDemoMode) return
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    const interval = window.setInterval(() => void refresh(), 45_000)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.clearInterval(interval)
    }
  }, [isDemoMode, refresh])

  const notifications = useMemo<BellNotification[]>(() => {
    if (!isDemoMode) {
      return productionNotifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        route: notification.route,
        read: notification.readAt != null,
        createdAt: notification.createdAt,
      }))
    }
    return demoNotifications
      .filter((notification) => !dismissedDemoNotificationIds.has(notification.id))
      .slice(0, 10)
      .map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      route: routeForDemoNotification(notification),
      read: notification.isRead,
        createdAt: notification.timestamp,
      }))
  }, [demoNotifications, dismissedDemoNotificationIds, isDemoMode, productionNotifications])

  const dismissedDemoUnreadCount = useMemo(() => demoNotifications.filter((notification) =>
    dismissedDemoNotificationIds.has(notification.id) && !notification.isRead).length,
  [demoNotifications, dismissedDemoNotificationIds])
  const unreadCount = isDemoMode
    ? Math.max(0, demoUnreadCount - dismissedDemoUnreadCount)
    : productionUnreadCount

  const markAllRead = async () => {
    if (isDemoMode) {
      markAllDemoRead()
      return
    }

    const previousNotifications = productionNotifications
    const previousUnreadCount = productionUnreadCount
    const readAt = new Date().toISOString()
    setProductionNotifications((items) => items.map((item) => ({
      ...item,
      readAt: item.readAt ?? readAt,
    })))
    setProductionUnreadCount(0)

    try {
      await markAllNotificationsReadApi()
    } catch {
      setProductionNotifications(previousNotifications)
      setProductionUnreadCount(previousUnreadCount)
      showToast("Failed to mark notifications as read")
    }
  }

  const markRead = async (notification: BellNotification): Promise<boolean> => {
    if (notification.read) return true
    if (isDemoMode) {
      markDemoRead(notification.id)
      return true
    }

    const optimisticReadAt = new Date().toISOString()
    setProductionNotifications((items) => items.map((item) => item.id === notification.id
      ? { ...item, readAt: optimisticReadAt }
      : item))
    setProductionUnreadCount((count) => Math.max(0, count - 1))

    try {
      const updated = await markNotificationReadApi(notification.id)
      setProductionNotifications((items) => items.map((item) => item.id === updated.id ? updated : item))
      return true
    } catch {
      setProductionNotifications((items) => items.map((item) => item.id === notification.id
        ? { ...item, readAt: null }
        : item))
      setProductionUnreadCount((count) => count + 1)
      showToast("Failed to mark notification as read")
      return false
    }
  }

  const removeNotification = async (notification: BellNotification) => {
    if (isDemoMode) {
      setDismissedDemoNotificationIds((ids) => new Set(ids).add(notification.id))
      return
    }

    const original = productionNotifications.find((item) => item.id === notification.id)
    setProductionNotifications((items) => items.filter((item) => item.id !== notification.id))
    if (!notification.read) setProductionUnreadCount((count) => Math.max(0, count - 1))

    try {
      await dismissNotificationApi(notification.id)
    } catch {
      if (original) {
        setProductionNotifications((items) => [...items, original]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
      }
      if (!notification.read) setProductionUnreadCount((count) => count + 1)
      showToast("Failed to remove notification")
    }
  }

  const clearAll = async () => {
    if (notifications.length === 0 || !window.confirm(
      "Clear all notifications?\n\nThese notifications will be removed from your inbox. Activity history will not be affected."
    )) return

    if (isDemoMode) {
      setDismissedDemoNotificationIds((ids) => {
        const next = new Set(ids)
        demoNotifications.forEach((notification) => next.add(notification.id))
        return next
      })
      return
    }

    const previousNotifications = productionNotifications
    const previousUnreadCount = productionUnreadCount
    setProductionNotifications([])
    setProductionUnreadCount(0)

    try {
      await dismissAllNotificationsApi()
    } catch {
      setProductionNotifications(previousNotifications)
      setProductionUnreadCount(previousUnreadCount)
      showToast("Failed to clear notifications")
    }
  }

  const openNotification = async (notification: BellNotification) => {
    if (!await markRead(notification)) return
    setOpen(false)
    if (notification.route) router.push(notification.route)
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen && !isDemoMode) void refresh()
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <span className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => void clearAll()}
                className="rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear all
              </button>
            )}
          </span>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "cursor-pointer items-start gap-2.5 px-3 py-2.5",
                  !notification.read && "bg-blue-50 text-foreground dark:bg-blue-950/30",
                  notification.read && "text-muted-foreground"
                )}
                onClick={() => void openNotification(notification)}
              >
                <span
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : "bg-blue-500")}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-xs leading-tight", notification.read ? "font-medium text-foreground/70" : "font-semibold")}>
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground">{notification.message}</span>
                  <span className="mt-1.5 block text-[10px] text-muted-foreground">
                    {notificationTimestamp(notification.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {!notification.read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      title="Mark as read"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200/80 bg-background text-blue-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void markRead(notification)
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Remove notification"
                    title="Remove notification"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void removeNotification(notification)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
