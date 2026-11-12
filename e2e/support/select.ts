import { GLOBAL_CLASSROOM_GROUPS } from "../../lib/maintenance-area-options"
import { expect, type Locator } from "@playwright/test"

export async function openSelectOptions(trigger: Locator): Promise<Locator> {
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeEnabled()
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  const popup = trigger.page().getByRole("listbox")
  await expect(popup).toHaveCount(1)
  await expect(popup).toBeVisible()
  return popup
}

async function closeSelectOptions(trigger: Locator, popup: Locator): Promise<void> {
  if (await trigger.getAttribute("aria-expanded") === "true") await trigger.page().keyboard.press("Escape")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(popup).toBeHidden()
}

/** Inspect the actual available options, and close the popup even when an assertion fails. */
export async function withSelectOptions(trigger: Locator, inspect: (popup: Locator) => Promise<void>): Promise<void> {
  const popup = await openSelectOptions(trigger)
  try {
    await inspect(popup)
  } finally {
    await closeSelectOptions(trigger, popup)
  }
}

/** Select popups are portaled outside their form/dialog. */
export async function selectPopupOption(trigger: Locator, label: string): Promise<void> {
  const popup = await openSelectOptions(trigger)
  const option = popup.getByRole("option", { name: label, exact: true })
  await expect(option).toBeVisible()
  await expect(option).toBeEnabled()
  await option.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(popup).toBeHidden()
  await expect(trigger).toContainText(label)
}

/** The same tree drives both Maintenance and Supply. */
export async function selectClassroomArea(trigger: Locator, name: string): Promise<void> {
  await trigger.click()
  const page = trigger.page()
  await expect(page.getByRole("menu")).toHaveCount(1)
  const group = GLOBAL_CLASSROOM_GROUPS.find((group) => group.rooms.includes(name) || group.branches.some((branch) => branch.rooms.includes(name)))
  if (group) {
    const groupTrigger = page.getByRole("menuitem", { name: group.label, exact: true })
    await groupTrigger.click()
    const branch = group.branches.find((branch) => branch.rooms.includes(name))
    if (branch) {
      const branchTrigger = page.getByRole("menuitem", { name: branch.level, exact: true })
      await expect(branchTrigger).toBeVisible()
      await branchTrigger.click()
    }
  }
  const option = page.getByRole("menuitem", { name, exact: true })
  await expect(option).toBeVisible()
  await expect(option).toBeEnabled()
  await option.click()
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(trigger).toContainText(name)
}
