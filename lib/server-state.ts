export interface VersionedServerState {
  id: string
  lastUpdated: string
}

function timestamp(value: string): number | null {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Keep a mutation/detail response when an older list request finishes later.
 * Server timestamps are authoritative; unparseable timestamps fall back to the
 * incoming snapshot so a malformed local value cannot freeze reconciliation.
 */
export function preferNewestServerState<T extends VersionedServerState>(
  current: T,
  incoming: T
): T {
  const currentTimestamp = timestamp(current.lastUpdated)
  const incomingTimestamp = timestamp(incoming.lastUpdated)

  if (currentTimestamp !== null && incomingTimestamp !== null && currentTimestamp > incomingTimestamp) {
    return current
  }

  return incoming
}
