"use client"

import { Upload, ChevronDown, Check, Menu, Package, Plus, Wrench } from "lucide-react"
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
import { NotificationBell } from "@/components/notification-bell"
import { NewMaintenanceRequestModal } from "@/components/new-maintenance-request-modal"
import { NewSupplyRequestModal } from "@/components/new-supply-request-modal"

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
  const { role, setRole, currentUser, isDemoMode } = useApp()
  const { logout } = useAuth()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [supplyOpen, setSupplyOpen] = useState(false)
  const pathname = usePathname()

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ??
    "Influential Management"

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

          {/* Global create menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" className="gap-1.5 px-2.5 text-xs sm:px-3" aria-label="Create" />}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Create</span>
              <ChevronDown className="hidden h-3 w-3 opacity-70 sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setUploadOpen(true)} className="gap-2 py-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                Upload Record
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMaintenanceOpen(true)} className="gap-2 py-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                New Maintenance Request
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSupplyOpen(true)} className="gap-2 py-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                New Supply Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <NotificationBell />

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
      <NewMaintenanceRequestModal open={maintenanceOpen} onOpenChange={setMaintenanceOpen} />
      <NewSupplyRequestModal open={supplyOpen} onOpenChange={setSupplyOpen} />
    </>
  )
}
