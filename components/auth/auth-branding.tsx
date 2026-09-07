import { cn } from "@/lib/utils"

/**
 * Shared brand mark + product identity for authentication screens (login now;
 * invite/setup/password screens in Sprint 7 reuse this unchanged).
 */
export function AuthBranding({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar text-sm font-bold tracking-wide text-sidebar-foreground shadow-sm ring-1 ring-black/5">
        IM
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        Influential Management
      </h1>
      <p className="text-sm font-medium text-muted-foreground">Operations &amp; Compliance Portal</p>
    </div>
  )
}
