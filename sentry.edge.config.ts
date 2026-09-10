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
      runtime: "edge",
    },
  },
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies
      delete event.request.data
      delete event.request.headers
      delete event.request.query_string
    }
    return event
  },
})
