const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1"])

export function resolveApiUrl(configured: string, browserHostname?: string): string {
  if (!browserHostname) return configured
  try {
    const url = new URL(configured)
    if (LOOPBACK_HOSTNAMES.has(url.hostname)
      && LOOPBACK_HOSTNAMES.has(browserHostname)
      && url.hostname !== browserHostname) {
      url.hostname = browserHostname
    }
    return url.origin
  } catch {
    return configured
  }
}
