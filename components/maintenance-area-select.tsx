"use client"
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { GLOBAL_CLASSROOM_GROUPS, GLOBAL_CLASSROOM_AREAS, FACILITY_AREAS, type MaintenanceAreaSelection } from "@/lib/maintenance-area-options"
import { selectTriggerClass } from "@/components/ui/standard-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"

interface Props {
  id: string; value: MaintenanceAreaSelection
  onChange: (value: MaintenanceAreaSelection) => void
  disabled?: boolean; required?: boolean
}
const itemClass = "min-h-10 min-w-0 whitespace-normal [overflow-wrap:anywhere]"
const submenuClass = "w-56 max-w-[calc(100vw-1rem)]"

const hoverQuery = "(hover: hover) and (pointer: fine)"
function subscribeHover(onChange: () => void) {
  const media = window.matchMedia(hoverQuery)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
function ClassroomSubmenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const canHover = useSyncExternalStore(subscribeHover, () => window.matchMedia(hoverQuery).matches, () => false)
  return <DropdownMenuSub open={open} onOpenChange={setOpen}>
    <DropdownMenuSubTrigger openOnHover={canHover} className={itemClass}
      onMouseDown={(event) => {
        // Touch produces compatibility mouse events. Use one click toggle rather
        // than racing the primitive's deferred mousedown against its click handler.
        if (!canHover) event.preventBaseUIHandler()
      }} onClick={(event) => {
        if (canHover) setOpen(true)
        else { event.preventBaseUIHandler(); setOpen((current) => !current) }
      }}>{label}</DropdownMenuSubTrigger>
    <DropdownMenuSubContent className={submenuClass}>{children}</DropdownMenuSubContent>
  </DropdownMenuSub>
}

export function MaintenanceAreaSelect({ id, value, onChange, disabled, required }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreTrigger = useRef(false)
  const focusFrame = useRef<number | null>(null)
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current) }, [])
  const [custom, setCustom] = useState(false)
  const legacyMissing = value.area && !FACILITY_AREAS.includes(value.area) && !GLOBAL_CLASSROOM_AREAS.includes(value.area)
  const roomItems = (rooms: string[], classroomAgeGroup: MaintenanceAreaSelection["classroomAgeGroup"]) => rooms.map((area) =>
    <DropdownMenuItem key={area} className={itemClass} onClick={() => {
      setCustom(false); onChange({ area, classroomAgeGroup })
    }}>{area}</DropdownMenuItem>)
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id}>Classroom / Area</Label>
    <DropdownMenu onOpenChange={(open, details) => {
      if (open) {
        restoreTrigger.current = false
        if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
      }
      else if (details.reason === "escape-key" || details.reason === "item-press") restoreTrigger.current = true
    }} onOpenChangeComplete={(open) => {
      // Hover-close events during teardown can suppress the primitive's focus return.
      // Restore after all portaled submenu levels have unmounted, without stealing outside-click focus.
      if (!open && restoreTrigger.current) {
        restoreTrigger.current = false
        focusFrame.current = requestAnimationFrame(() => {
          focusFrame.current = null
          const active = document.activeElement
          // A user may already have moved to another field during the close animation.
          if (!active || active === document.body || !active.isConnected || active.closest('[role="menu"]')) {
            triggerRef.current?.focus({ preventScroll: true })
          }
        })
      }
    }}>
      <DropdownMenuTrigger ref={triggerRef} id={id} type="button" disabled={disabled} aria-describedby={required ? `${id}-requirement` : undefined}
        className={selectTriggerClass}>
        <span className="min-w-0 [overflow-wrap:anywhere]">{custom ? "Custom" : value.area || "Select classroom or facility area"}</span><ChevronDown className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent finalFocus={false} className="max-w-[calc(100vw-1rem)]">
        {legacyMissing && !custom && <DropdownMenuItem className={itemClass}>{value.area} (saved area)</DropdownMenuItem>}
        {GLOBAL_CLASSROOM_GROUPS.map((group) => <ClassroomSubmenu key={group.value} label={group.label}>
          {group.rooms.length > 0 ? roomItems(group.rooms, group.label) : group.branches.map((branch) =>
            <ClassroomSubmenu key={branch.level} label={branch.level}>
              {roomItems(branch.rooms, group.label)}
            </ClassroomSubmenu>)}
        </ClassroomSubmenu>)}
        <DropdownMenuSeparator />
        {FACILITY_AREAS.map((area) => <DropdownMenuItem key={area} className={itemClass} onClick={() => {
          setCustom(false); onChange({ area })
        }}>{area}</DropdownMenuItem>)}
        <DropdownMenuItem className={itemClass} onClick={() => { setCustom(true); onChange({ area: "" }) }}>Custom</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {required && <span id={`${id}-requirement`} className="sr-only">Choose a classroom or area. Required.</span>}
    {custom && <><Label htmlFor={`${id}-custom`}>Custom area name</Label><Input id={`${id}-custom`} value={value.area} maxLength={200} required pattern={".*\\S.*"} disabled={disabled}
      onChange={(event) => onChange({ area: event.target.value })} /></>}
  </div>
}
