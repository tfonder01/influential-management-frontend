"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { EVENTS, STATUS, useJoyride, type EventData } from "react-joyride"
import { useAuth } from "@/lib/auth"
import { useApp } from "@/lib/store"
import { ONBOARDING_VERSIONS, onboardingAudienceFor, onboardingSteps, shouldAutoPrompt, shouldPersistOnboarding, type OnboardingStatus } from "@/lib/onboarding"
import { updateOnboarding } from "@/lib/onboarding-api"
import { ensureTargetSafelyPositioned, TOUR_VIEWPORT_MARGIN } from "@/lib/onboarding-positioning"
import { OnboardingTooltip } from "@/components/onboarding-tooltip"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface OnboardingContextValue {
  activeTarget: string | null
  startManualTour: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

function waitForTarget(route: string, targetKey: string): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const selector = `[data-tour="${targetKey}"]`
    const readyTarget = () => {
      if (window.location.pathname !== route) return null
      const target = document.querySelector<HTMLElement>(selector)
      if (!target) return null
      const rect = target.getBoundingClientRect()
      const style = window.getComputedStyle(target)
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
        ? target
        : null
    }
    const initialTarget = readyTarget()
    if (initialTarget) {
      resolve(initialTarget)
      return
    }

    const observer = new MutationObserver(() => {
      const target = readyTarget()
      if (!target) return
      observer.disconnect()
      window.clearTimeout(timeout)
      resolve(target)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Tour target unavailable: ${targetKey}`))
    }, 5000)
  })
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, refreshSession } = useAuth()
  const { role, isDemoMode, showToast } = useApp()
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [promptHandled, setPromptHandled] = useState(false)
  const [preparingTarget, setPreparingTarget] = useState<string | null>(null)
  const finalizedRef = useRef(false)
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const audience = onboardingAudienceFor(role)
  const version = ONBOARDING_VERSIONS[audience]

  const prepareStep = useCallback(async ({ route, targetKey }: { route: string; targetKey: string }) => {
    setPreparingTarget(targetKey)
    if (window.location.pathname !== route) router.push(route)
    const target = await waitForTarget(route, targetKey)
    await ensureTargetSafelyPositioned(target)
  }, [router])

  const steps = useMemo(() => onboardingSteps(audience, prepareStep), [audience, prepareStep])
  const handleTourEvent = useCallback((event: EventData) => {
    if (event.type !== EVENTS.TOUR_END) return
    setPreparingTarget(null)
    if (finalizedRef.current) return
    const status: OnboardingStatus | null = event.status === STATUS.FINISHED
      ? "COMPLETED"
      : event.status === STATUS.SKIPPED ? "DISMISSED" : null
    if (!status) return
    finalizedRef.current = true
    if (!shouldPersistOnboarding(isDemoMode)) return
    void updateOnboarding({ tourAudience: audience, version, status })
      .then(() => refreshSession())
      .catch(() => showToast("We couldn't save your walkthrough progress. You can replay it from Help & support."))
  }, [audience, isDemoMode, refreshSession, showToast, version])

  const { controls, state, step, Tour } = useJoyride({
    steps,
    continuous: true,
    run: false,
    scrollToFirstStep: true,
    tooltipComponent: OnboardingTooltip,
    onEvent: handleTourEvent,
    floatingOptions: {
      strategy: "fixed",
      flipOptions: { padding: TOUR_VIEWPORT_MARGIN },
      shiftOptions: { mainAxis: true, crossAxis: true, padding: TOUR_VIEWPORT_MARGIN },
    },
    options: {
      blockTargetInteraction: true,
      closeButtonAction: "skip",
      dismissKeyAction: false,
      overlayClickAction: false,
      showProgress: true,
      skipBeacon: true,
      scrollDuration: reducedMotion ? 0 : 250,
      skipScroll: true,
      targetWaitTimeout: 5000,
      zIndex: 1000,
    },
  })

  const startTour = useCallback(() => {
    finalizedRef.current = false
    setPreparingTarget(null)
    setPromptHandled(true)
    setWelcomeOpen(false)
    controls.reset()
    controls.start(0)
  }, [controls])

  useEffect(() => {
    setPromptHandled(false)
    setWelcomeOpen(false)
  }, [user?.id])

  useEffect(() => {
    if (promptHandled || !shouldAutoPrompt(isDemoMode, Boolean(user?.onboarding?.promptRequired))) return
    setWelcomeOpen(true)
  }, [isDemoMode, promptHandled, user?.onboarding?.promptRequired])

  useEffect(() => {
    if (state.status !== STATUS.RUNNING) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      controls.skip()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [controls, state.status])

  const dismissWelcome = useCallback(() => {
    setPromptHandled(true)
    setWelcomeOpen(false)
    if (!shouldPersistOnboarding(isDemoMode)) return
    void updateOnboarding({ tourAudience: audience, version, status: "DISMISSED" })
      .then(() => refreshSession())
      .catch(() => showToast("We couldn't save your walkthrough preference. Please try again later."))
  }, [audience, isDemoMode, refreshSession, showToast, version])

  const activeStepTarget = state.status === STATUS.RUNNING
    ? (step?.data as { targetKey?: string } | undefined)?.targetKey ?? null
    : null
  const activeTarget = preparingTarget ?? activeStepTarget

  const value = useMemo(() => ({ activeTarget, startManualTour: startTour }), [activeTarget, startTour])

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <Dialog open={welcomeOpen} onOpenChange={(open) => { if (!open) dismissWelcome() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to Influential Management</DialogTitle>
            <DialogDescription>
              Take a short, role-aware walkthrough of the workspaces you will use most. It is informational only and will not change any records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={dismissWelcome}>Skip for now</Button>
            <Button type="button" onClick={startTour}>Start walkthrough</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {Tour}
      <span className="sr-only" aria-live="polite">{pathname && activeTarget ? `Walkthrough opened ${activeTarget}` : ""}</span>
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const value = useContext(OnboardingContext)
  if (!value) throw new Error("useOnboarding must be used within OnboardingProvider")
  return value
}
