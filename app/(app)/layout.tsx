"use client"

import { useEffect, useState } from "react"
import { AppProvider } from "@/lib/store"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { cn } from "@/lib/utils"
import { AuthGate } from "@/components/auth-gate"
import { useAuth } from "@/lib/auth"

const SIDEBAR_COLLAPSE_STORAGE_KEY = "im.sidebar.collapsed"

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Start expanded on both server and first client render to avoid a hydration mismatch;
  // sync the real preference from localStorage after mount.
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY)
    if (stored === "true") setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next))
      return next
    })
  }

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
        <Sidebar onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} menuOpen={sidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="page-enter">{children}</div>
        </main>
      </div>
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
