"use client"

import { ClassroomAreaSelect } from "@/components/classroom-area-select"
import type { MaintenanceAreaSelection } from "@/lib/maintenance-area-options"

interface Props {
  id: string
  value: MaintenanceAreaSelection
  onChange: (value: MaintenanceAreaSelection) => void
  disabled?: boolean
  required?: boolean
}

/** Maintenance retains its existing required/placeholder behavior. */
export function MaintenanceAreaSelect(props: Props) {
  return <ClassroomAreaSelect {...props} />
}
