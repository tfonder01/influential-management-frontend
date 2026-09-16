export type AuthStatus = "loading" | "authenticated" | "anonymous"

export type ProtectedRouteDecision = "allow" | "loading" | "redirect"

const INTERNAL_ORIGIN = "https://internal.invalid"
const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard"

export function protectedRouteDecision(
  isProductionMode: boolean,
  status: AuthStatus
): ProtectedRouteDecision {
  if (!isProductionMode || status === "authenticated") return "allow"
  return status === "loading" ? "loading" : "redirect"
}

export function safeInternalReturnTo(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return null
  }

  try {
    const decodedCandidate = decodeURIComponent(candidate)
    const containsControlCharacter = Array.from(decodedCandidate).some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
    if (decodedCandidate.startsWith("//") || decodedCandidate.includes("\\") || containsControlCharacter) {
      return null
    }

    const url = new URL(candidate, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN || url.pathname === "/login") return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function loginHrefFor(returnTo: string): string {
  const safeReturnTo = safeInternalReturnTo(returnTo)
  return safeReturnTo ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}` : "/login"
}

export function authenticatedDestination(search: string): string {
  const returnTo = new URLSearchParams(search).get("returnTo")
  return safeInternalReturnTo(returnTo) ?? DEFAULT_AUTHENTICATED_ROUTE
}
