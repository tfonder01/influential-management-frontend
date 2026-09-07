import { cn } from "@/lib/utils"

/**
 * Shared card container for authentication screens (login now; invite/setup
 * /password screens in Sprint 7 reuse this unchanged).
 */
export function AuthCard({ children, className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-6 shadow-lg shadow-slate-950/5 sm:p-8",
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-center text-[11px] tracking-wide text-muted-foreground/70">{children}</p>
}
