"use client"

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { AriaAttributes } from "react"

export { selectTriggerClass } from "@/components/ui/select"

interface Props extends Pick<AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"> {
  id: string
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  "data-testid"?: string
}
/** Single-level select using the shared Base UI primitive and cascading trigger styling. */
export function StandardSelect({ id, value, onValueChange, options, placeholder, disabled, required, ...triggerProps }: Props) {
  // An explicit empty option is a real selection (e.g. "Not assigned").
  // Otherwise an empty form value represents the unselected placeholder.
  const selectedValue = value === "" && !options.some((option) => option.value === "") ? null : value
  return <Select value={selectedValue} onValueChange={(next) => { if (next !== null) onValueChange(next) }}
    items={options} disabled={disabled} required={required}>
    <SelectTrigger id={id} {...triggerProps}>
      <SelectValue placeholder={placeholder} className={selectedValue === "" && placeholder ? "text-muted-foreground" : undefined} />
    </SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false} className="max-w-[calc(100vw-1rem)] p-1">
      {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>
}
