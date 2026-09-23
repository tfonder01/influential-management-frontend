# Testing

Unit tests use Node's test runner. The focused Playwright suite exercises critical portal workflows against **staging only**.

## Install

```powershell
pnpm install
pnpm exec playwright install chromium
```

## Required Playwright environment

For local runs, create `.env.playwright.local` in the frontend repository root. The Playwright configuration loads this gitignored file before reading any E2E settings. CI may provide the same variables through its secret store instead.

```text
PLAYWRIGHT_BASE_URL=https://stg.example.com
PLAYWRIGHT_BACKEND_URL=https://stg-api.example.com
PLAYWRIGHT_OWNER_EMAIL=<dedicated STG Owner email>
PLAYWRIGHT_OWNER_PASSWORD=<dedicated STG Owner password>
PLAYWRIGHT_DIRECTOR_EMAIL=<dedicated STG Director email>
PLAYWRIGHT_DIRECTOR_PASSWORD=<dedicated STG Director password>
PLAYWRIGHT_DIRECTOR_LOCATION_NAME=<the Director's assigned location name>
PLAYWRIGHT_RESTRICTED_LOCATION_NAME=<a different location visible to the Owner>
```

`PLAYWRIGHT_BACKEND_URL` is the deployed STG backend origin used for the one-time
`/actuator/health` readiness check. Keep it explicit so a local development API URL cannot
be mistaken for the deployed staging backend.

The two accounts must belong to the same disposable STG organization. The Owner must have access to both named locations. The Director must have access to `PLAYWRIGHT_DIRECTOR_LOCATION_NAME` and no access to `PLAYWRIGHT_RESTRICTED_LOCATION_NAME`. Do not use production users or production passwords.

The configuration refuses non-HTTPS URLs and hostnames without a `stg` or `staging` segment. There is no production override.

## Run

```powershell
pnpm test:e2e
pnpm test:e2e:headed
pnpm test:e2e:debug
```

Run one case while developing:

```powershell
pnpm exec playwright test -g "Maintenance request"
```

Before the tests start, the suite polls the STG backend health endpoint for up to 120 seconds. The suite uses Chromium, one worker, retry-on-failure, and failure-only screenshots/video plus a trace on retry. It creates timestamped disposable records. Cleanup archives created records when the product permits it; it never permanently deletes shared or fixture data. If a test is interrupted before cleanup, search STG for the `E2E` title prefix and archive only that disposable record.

The coverage includes Owner session restoration/logout, Director location scoping and direct-navigation denial, Maintenance and Supply approval/progress, Compliance fields, private-file upload/download controls, and archive/restore.
