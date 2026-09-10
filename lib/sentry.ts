function releaseFromEnv() {
  return nonEmpty(process.env.NEXT_PUBLIC_SENTRY_RELEASE)
    ?? nonEmpty(process.env.SENTRY_RELEASE)
    ?? nonEmpty(process.env.VERCEL_GIT_COMMIT_SHA)
    ?? nonEmpty(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA)
    ?? undefined
}

function nonEmpty(value: string | undefined) {
  return value && value.trim() ? value : undefined
}

export function sentryEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function sentryEnvironment() {
  const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT
    ?? process.env.SENTRY_ENVIRONMENT
  return environment === "stg" || environment === "prd" ? environment : undefined
}

export function sentryRelease() {
  return releaseFromEnv()
}

export function sentryTracesSampleRate() {
  const environment = sentryEnvironment()
  if (environment === "stg") return 0.05
  if (environment === "prd") return 0.02
  return 0
}

export function sentryDataCollection() {
  return {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: false,
      response: false,
    },
    httpBodies: [],
    urlQueryParams: false,
    genAI: { inputs: false, outputs: false },
    stackFrameVariables: false,
    frameContextLines: 3,
  }
}
