"use client"

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export const selectTriggerClass = "flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"

interface Props {
  id: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
}
/** Single-level select using the shared Base UI primitive and cascading trigger styling. */
export function StandardSelect({ id, value, onValueChange, options, placeholder, disabled, required }: Props) {
  return <Select value={value || null} onValueChange={(next) => { if (next !== null) onValueChange(next) }}
    items={options} disabled={disabled} required={required}>
    <SelectTrigger id={id} className={`${selectTriggerClass} h-auto! whitespace-normal!`}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false} className="max-w-[calc(100vw-1rem)] p-1">
      {options.map((option) => <SelectItem key={option.value} value={option.value} className="min-h-10">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>
}
