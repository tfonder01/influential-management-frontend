export const PERMANENT_DELETE_CONFIRMATION = "DELETE" as const

export function isPermanentDeleteConfirmed(value: string): boolean {
  return value === PERMANENT_DELETE_CONFIRMATION
}

export interface ClipboardWriter {
  writeText(value: string): Promise<void>
}

export async function copyPermanentDeleteConfirmation(clipboard: ClipboardWriter): Promise<void> {
  await clipboard.writeText(PERMANENT_DELETE_CONFIRMATION)
}
export function createPermanentDeleteSubmissionGuard() {
  let submitting = false
  return async function runOnce(action: () => Promise<void>): Promise<boolean> {
    if (submitting) return false
    submitting = true
    try {
      await action()
      return true
    } finally {
      submitting = false
    }
  }
}