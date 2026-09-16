function usPhoneDigits(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (!/^[\d\s()+.-]+$/.test(trimmed)) return null

  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  if (digits.length > 10) return null
  return digits
}

export function formatUsPhoneNumber(value: string | null | undefined): string {
  const original = value ?? ""
  const digits = usPhoneDigits(original)
  if (digits === null) return original
  if (digits.length < 3) return digits
  if (digits.length === 3) {
    const trimmed = original.trim()
    return trimmed === `(${digits}` ? digits : `(${digits})`
  }

  const areaCode = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  if (digits.length <= 6) return `(${areaCode}) ${prefix}`

  return `(${areaCode}) ${prefix}-${digits.slice(6)}`
}

export function normalizeUsPhoneNumber(value: string | null | undefined): string {
  const original = value ?? ""
  const digits = usPhoneDigits(original)
  return digits === null ? original.trim() : digits
}
