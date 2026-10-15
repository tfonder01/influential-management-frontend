"use client"

import { X } from "lucide-react"
import type { TooltipRenderProps } from "react-joyride"
import { Button } from "@/components/ui/button"

export function OnboardingTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div {...tooltipProps} data-tour-tooltip className="max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Step {index + 1} of {size}</p>
          {step.title ? <h2 className="mt-1 text-base font-semibold">{step.title}</h2> : null}
        </div>
        <button {...closeProps} type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 text-sm leading-6 text-muted-foreground">{step.content}</div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button {...skipProps} type="button" className="min-h-10 rounded-md px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Skip for now
        </button>
        <div className="flex items-center gap-2">
          {index > 0 ? <Button {...backProps} type="button" variant="outline">Back</Button> : null}
          <Button {...primaryProps} type="button">{isLastStep ? "Finish" : "Next"}</Button>
        </div>
      </div>
    </div>
  )
}
