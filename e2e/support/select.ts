import { GLOBAL_CLASSROOM_GROUPS } from "../../lib/maintenance-area-options"
import type { Locator } from "@playwright/test"

/** Select popups are portaled outside their form/dialog. */
export async function selectPopupOption(trigger: Locator, label: string): Promise<void> {
  await trigger.click()
  await trigger.page().getByRole("option", { name: label, exact: true }).click()
}

/** The same tree drives both Maintenance and Supply. */
export async function selectClassroomArea(trigger: Locator, name: string): Promise<void> {
  await trigger.click()
  const page = trigger.page()
  const group = GLOBAL_CLASSROOM_GROUPS.find((group) => group.rooms.includes(name) || group.branches.some((branch) => branch.rooms.includes(name)))
  if (group) {
    await page.getByRole("menuitem", { name: group.label, exact: true }).click()
    const branch = group.branches.find((branch) => branch.rooms.includes(name))
    if (branch) await page.getByRole("menuitem", { name: branch.level, exact: true }).click()
  }
  await page.getByRole("menuitem", { name, exact: true }).click()
}
