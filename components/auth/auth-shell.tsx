import { cn } from "@/lib/utils"

/**
 * Full-page background/layout wrapper shared by all authentication screens
 * (login now; invite/setup/password reset in Sprint 7).
 */
export function AuthShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6",
        className
      )}
    >
      {/* Restrained radial wash in the brand's plum/navy hue — no gradients/marketing flair */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, oklch(0.23 0.055 305 / 0.08), transparent), radial-gradient(50% 40% at 100% 100%, oklch(0.52 0.17 250 / 0.06), transparent)",
        }}
      />
      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  )
}
