import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const layoutSource = readFileSync(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8")
const topbarSource = readFileSync(new URL("../components/topbar.tsx", import.meta.url), "utf8")
const sidebarSource = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
const supportDialogSource = readFileSync(new URL("../components/support-dialog.tsx", import.meta.url), "utf8")

test("authenticated shell renders one shared support dialog for both entry points", () => {
  assert.equal((layoutSource.match(/<SupportDialog\b/g) ?? []).length, 1)
  assert.equal((topbarSource.match(/<SupportDialog\b/g) ?? []).length, 0)
  assert.equal((sidebarSource.match(/<SupportDialog\b/g) ?? []).length, 0)
  assert.equal((layoutSource.match(/onOpenSupport=\{openSupport\}/g) ?? []).length, 2)
})

test("account menu and sidebar expose support actions without adding a route", () => {
  assert.match(topbarSource, /<DropdownMenuItem onClick=\{onOpenSupport\}>/)
  assert.match(sidebarSource, /aria-label="Help & support"/)
  assert.match(sidebarSource, /onOpenSupport\(\)/)
  assert.doesNotMatch(sidebarSource, /href="\/support"/)
})

test("collapsed and mobile sidebar support behavior stays accessible", () => {
  assert.match(sidebarSource, /title=\{collapsed \? "Help & support" : undefined\}/)
  assert.match(sidebarSource, /collapsed && "justify-center px-0"/)
  assert.match(sidebarSource, /onClose\?\.\(\)/)
})

test("support dialog constrains intrinsic widths and wraps long message content", () => {
  assert.match(supportDialogSource, /<form className="min-w-0 max-w-full"/)
  assert.match(supportDialogSource, /<fieldset className="mt-5 min-w-0 max-w-full"/)
  assert.match(supportDialogSource, /grid min-w-0 max-w-full grid-cols-1/)
  assert.match(supportDialogSource, /flex min-w-0 max-w-full cursor-pointer/)
  assert.match(supportDialogSource, /wrap="soft"/)
  assert.match(supportDialogSource, /\[overflow-wrap:anywhere\]/)
  assert.match(supportDialogSource, /style=\{\{ fieldSizing: "fixed" \}\}/)
  assert.doesNotMatch(supportDialogSource, /overflow-x-(?:auto|scroll)/)
})
