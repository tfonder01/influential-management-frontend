import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8")
}

const sharedSource = source("../components/attachment-ui.tsx")
const recordSource = source("../app/(app)/records/[id]/page.tsx")
const supplySource = source("../app/(app)/supply-requests/[id]/page.tsx")
const supplyApiSource = source("../lib/supply-api.ts")
const typeSource = source("../lib/types.ts")
const maintenanceSource = source("../app/(app)/maintenance/[id]/page.tsx")
const standardsSource = source("../.engineering/frontend-standards.md")

test("shared attachment UI provides readable rows, obvious uploads, empty states, and accessible actions", () => {
  assert.match(sharedSource, /export function AttachmentSectionHeader/)
  assert.match(sharedSource, /export function AttachmentRow/)
  assert.match(sharedSource, /export function AttachmentEmptyState/)
  assert.match(sharedSource, /export function AttachmentUploadControl/)
  assert.match(sharedSource, /min-h-12 min-w-0/)
  assert.match(sharedSource, /w-full truncate/)
  assert.match(sharedSource, /h-9 w-9/)
  assert.match(sharedSource, /min-h-11 cursor-pointer/)
  assert.match(sharedSource, /focus-visible:ring-2/)
  assert.match(sharedSource, /focus-within:ring-2/)
})

test("Compliance and Operations record details retain file actions through the shared UI", () => {
  assert.match(recordSource, /<AttachmentSectionHeader/)
  assert.match(recordSource, /title="Attached Documents"/)
  assert.match(recordSource, /<AttachmentRow/)
  assert.match(recordSource, /handleDownload\(attachment\)/)
  assert.match(recordSource, /handleOpenInNewTab\(attachment\)/)
  assert.match(recordSource, /openRenameDialog\(attachment\)/)
  assert.match(recordSource, /handleReplaceAttachment\(attachment, file\)/)
  assert.match(recordSource, /requestRemoveAttachment\(attachment\)/)
  assert.match(recordSource, /<AttachmentEmptyState>No attachments\.<\/AttachmentEmptyState>/)
  assert.match(recordSource, /canManageAttachments && \(\s*<AttachmentUploadControl/)
  assert.match(recordSource, /label="Add Attachment"/)
})

test("Supply uses generic attachment rows without a visible type badge while preserving metadata and actions", () => {
  assert.match(supplySource, /<AttachmentSectionHeader/)
  assert.match(supplySource, /<AttachmentRow/)
  assert.doesNotMatch(supplySource, /badge=\{item\.attachmentType/)
  assert.match(supplySource, /handleDownloadAttachment\(item\)/)
  assert.match(supplySource, /handleOpenInNewTab\(item\)/)
  assert.match(supplySource, /openRenameDialog\(item\)/)
  assert.match(supplySource, /triggerReplace\(item\)/)
  assert.match(supplySource, /requestRemoveAttachment\(item\)/)
  assert.match(supplySource, /<AttachmentEmptyState>No attachments yet\.<\/AttachmentEmptyState>/)
  assert.match(supplySource, /canEdit && \(\s*<AttachmentUploadControl/)
  assert.match(supplySource, /label="Add Attachment"/)
  assert.match(supplySource, /ATTACHMENT_TYPE_TO_API\[attachment\.attachmentType\]/)
  assert.match(supplyApiSource, /attachmentType: ATTACHMENT_TYPE_FROM_API\[attachment\.attachmentType\]/)
  assert.match(typeSource, /attachmentType\?: SupplyAttachmentType/)
})

test("Maintenance preserves its three workflow groups with shared rows, uploads, and clear empty states", () => {
  for (const group of ["Original photos", "Completion photos", "Invoices"]) {
    assert.match(maintenanceSource, new RegExp(`title: "${group}"`))
  }
  assert.match(maintenanceSource, /<AttachmentGroup key=\{field\}/)
  assert.match(maintenanceSource, /<AttachmentRow/)
  assert.match(maintenanceSource, /uploadLabel: "Add Original Photo"/)
  assert.match(maintenanceSource, /uploadLabel: "Add Completion Photo"/)
  assert.match(maintenanceSource, /uploadLabel: "Add Invoice"/)
  assert.match(maintenanceSource, /emptyLabel: "No original photos attached\."/)
  assert.match(maintenanceSource, /emptyLabel: "No completion photos attached\."/)
  assert.match(maintenanceSource, /emptyLabel: "No invoices attached\."/)
  assert.match(maintenanceSource, /canEdit && \(\s*<AttachmentUploadControl/)
  assert.match(maintenanceSource, /handleDownloadAttachment\(item\)/)
  assert.match(maintenanceSource, /handleOpenInNewTab\(item\)/)
})

test("frontend standards require shared attachment UI while preserving semantic grouping", () => {
  assert.match(standardsSource, /Reuse the shared attachment UI pattern/)
  assert.match(standardsSource, /Maintenance Original Photos, Completion Photos, and Invoices/)
  assert.match(standardsSource, /large, obvious upload targets and readable file rows/)
})
