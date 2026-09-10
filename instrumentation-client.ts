import * as Sentry from "@sentry/nextjs"
import type { DataCollection } from "@sentry/core"
import {
  sentryDataCollection,
  sentryEnabled,
  sentryEnvironment,
  sentryRelease,
  sentryTracesSampleRate,
} from "@/lib/sentry"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  enabled: sentryEnabled(),
  dsn,
  environment: sentryEnvironment(),
  release: sentryRelease(),
  tracesSampleRate: sentryTracesSampleRate(),
  sendDefaultPii: false,
  dataCollection: sentryDataCollection() as DataCollection,
  initialScope: {
    tags: {
      app: "influential-management-frontend",
    },
  },
  beforeSend(event, hint) {
    const error = hint.originalException
    if (error instanceof Error) {
      if (error.message === "useAuth must be used within AuthProvider") return null
      if (error.message === "useApp must be used within AppProvider") return null
    }
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
