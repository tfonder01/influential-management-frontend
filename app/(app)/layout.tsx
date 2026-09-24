"use client"

import { useEffect, useRef, useState } from "react"
import { AppProvider } from "@/lib/store"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { cn } from "@/lib/utils"
import { AuthGate } from "@/components/auth-gate"
import { useAuth } from "@/lib/auth"
import { SupportDialog, type SupportDialogHandle } from "@/components/support-dialog"

const SIDEBAR_COLLAPSE_STORAGE_KEY = "im.sidebar.collapsed"

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  // Start expanded on both server and first client render to avoid a hydration mismatch;
  // sync the real preference from localStorage after mount.
  const [collapsed, setCollapsed] = useState(false)
  const supportDialogRef = useRef<SupportDialogHandle>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY)
    if (stored === "true") setCollapsed(true)

    const desktopQuery = window.matchMedia("(min-width: 1024px)")
    const syncDesktop = () => setIsDesktop(desktopQuery.matches)
    syncDesktop()
    desktopQuery.addEventListener("change", syncDesktop)
    return () => desktopQuery.removeEventListener("change", syncDesktop)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next))
      return next
    })
  }

  const openSupport = () => supportDialogRef.current?.open()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      {/* Sidebar — always visible on lg+, slide-in on mobile */}
      <div
        id="mobile-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex-shrink-0 transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={isDesktop && collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenSupport={openSupport}
        />
      </div>

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen((o) => !o)}
          menuOpen={sidebarOpen}
          onOpenSupport={openSupport}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
          <div className="page-enter min-w-0">{children}</div>
        </main>
      </div>
      <SupportDialog ref={supportDialogRef} />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <AuthGate>
      <AppProvider productionUser={user}>
        <AppShell>{children}</AppShell>
      </AppProvider>
    </AuthGate>
  )
}
