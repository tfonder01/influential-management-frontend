"use client"

import { Bell, Upload, ChevronDown, Check, Menu } from "lucide-react"
import { useState } from "react"
import { useApp } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { roleLabel } from "@/lib/role-labels"
import { UploadModal } from "@/components/upload-modal"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/records": "Compliance",
  "/operations": "Operations",
  "/maintenance": "Maintenance",
  "/supply-requests": "Supply Requests",
  "/locations": "Locations",
  "/needs-review": "Needs Review",
  "/activity": "Activity",
  "/archived": "Archived Records",
  "/settings": "Settings",
}


export function Topbar({ onMenuClick, menuOpen = false }: { onMenuClick?: () => void; menuOpen?: boolean }) {
  const { role, setRole, currentUser, notifications, unreadCount, markAllNotificationsRead, markNotificationRead, isDemoMode } =
    useApp()
  const { logout } = useAuth()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const pathname = usePathname()

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ??
    "Influential Management"

  const recentNotifs = notifications.slice(0, 5)
  const defaultUploadWorkspace = pathname.startsWith("/operations")
    ? "operations"
    : pathname.startsWith("/records")
      ? "compliance"
      : undefined

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-sm sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <h1 className="truncate text-base font-semibold text-foreground">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Role Switcher */}
          {isDemoMode && <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="gap-1.5 text-xs" aria-label={`Switch demo role. Currently ${role}`} />}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  role === "owner" ? "bg-violet-500" : role === "director" ? "bg-emerald-500" : "bg-blue-500"
                )}
              />
              <span className="hidden sm:inline">View as: </span><span className="max-[430px]:sr-only">{roleLabel(role)}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Demo Role Switcher</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRole("owner")}
                  className={cn("gap-2 py-2", role === "owner" && "bg-accent/70")}
                >
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  Owner
                  {role === "owner" && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRole("director")}
                  className={cn("gap-2 py-2", role === "director" && "bg-accent/70")}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Director
                  {role === "director" && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRole("assistant_director")}
                  className={cn("gap-2 py-2", role === "assistant_director" && "bg-accent/70")}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Assistant Director
                  {role === "assistant_director" && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>}

          {/* Upload Button */}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setUploadOpen(true)} aria-label="Upload record">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Upload Record</span>
          </Button>

          {/* Notifications */}
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications" />}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {recentNotifs.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                recentNotifs.map((n) => (
                  n.recordId ? (
                    <DropdownMenuLinkItem
                      key={n.id}
                      render={<Link href={n.source === "maintenance" ? `/maintenance/${n.recordId}` : `/records/${n.recordId}`} />}
                      className="flex-col items-start gap-0.5 px-3 py-2"
                      onClick={() => {
                        markNotificationRead(n.id)
                        setNotifOpen(false)
                      }}
                    >
                      <div className="flex w-full flex-col items-start gap-0.5">
                        <div className="flex w-full items-start gap-2">
                          {!n.isRead && (
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          )}
                          <div className={cn("flex-1", n.isRead && "ml-3.5")}>
                            <p className="text-xs font-medium leading-tight">{n.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {n.timestamp.slice(0, 10)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuLinkItem>
                  ) : (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex-col items-start gap-0.5 px-3 py-2"
                      onClick={() => markNotificationRead(n.id)}
                    >
                      <div className="flex w-full items-start gap-2">
                        {!n.isRead && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        )}
                        <div className={cn("flex-1", n.isRead && "ml-3.5")}>
                          <p className="text-xs font-medium leading-tight">{n.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-[box-shadow,background-color] duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Open account menu" />}
            >
              {currentUser.initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLinkItem render={<Link href="/settings" />}>Settings</DropdownMenuLinkItem>
              {!isDemoMode && <DropdownMenuItem onClick={() => void logout()}>Sign out</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <UploadModal
        key={defaultUploadWorkspace ?? "global"}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultWorkspace={defaultUploadWorkspace}
      />
    </>
  )
}
