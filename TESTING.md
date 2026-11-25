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
PLAYWRIGHT_APPROVED_STAGING_ORIGINS=https://stg.example.com,https://stg-api.example.com
PLAYWRIGHT_OWNER_EMAIL=<dedicated STG Owner email>
PLAYWRIGHT_OWNER_PASSWORD=<dedicated STG Owner password>
PLAYWRIGHT_DIRECTOR_EMAIL=<dedicated STG Director email>
PLAYWRIGHT_DIRECTOR_PASSWORD=<dedicated STG Director password>
PLAYWRIGHT_ASSISTANT_DIRECTOR_EMAIL=<dedicated STG Assistant Director email>
PLAYWRIGHT_ASSISTANT_DIRECTOR_PASSWORD=<dedicated STG Assistant Director password>
PLAYWRIGHT_DIRECTOR_LOCATION_NAME=<the Director's assigned location name>
PLAYWRIGHT_RESTRICTED_LOCATION_NAME=<a different location visible to the Owner>
```

`PLAYWRIGHT_BACKEND_URL` is the deployed STG backend origin used for the one-time
`/actuator/health` readiness check. Keep it explicit so a local development API URL cannot
be mistaken for the deployed staging backend.

All three accounts must belong to the same disposable STG organization. The Owner must have access to both named locations. The Director and Assistant Director must have access to `PLAYWRIGHT_DIRECTOR_LOCATION_NAME` and no access to `PLAYWRIGHT_RESTRICTED_LOCATION_NAME`. Do not use production users or production passwords.

The frontend hostname must contain a `stg` or `staging` segment. Both HTTPS origins must exactly match the staging pair approved by the release owner. Confirm the deployed revisions, Flyway V17, synthetic fixture tenant, and outbound email isolation before enabling a mutating run.

## Run manually

From the frontend checkout, wake the Render staging backend and confirm the approved staging pair and disposable fixture organization. The harness still polls backend health before running. It archives test-created requests and disables test-created workers using exact IDs. Check the output for any cleanup failures.

For the existing email-disabled staging setup, keep your current credentials and origin settings. Enable the disposable-user suite for this terminal session and run it with retries off:

```powershell
$env:PLAYWRIGHT_ALLOW_STAGING_MAINTENANCE_ONLY = "true"
pnpm.cmd exec playwright test --config=playwright.config.ts e2e/maintenance-only.spec.ts --workers=1 --retries=0
```

Expect two executed tests. The default uses the one-time setup link shown in the Invitation ready dialog and checks in-app notifications. Leave all mail settings unset for this workflow. The invitation selector supports the previous role label on staging until the rename is deployed. An Invitation ready dialog without a setup link fails the test.

Run the existing staff suite separately:

```powershell
pnpm.cmd exec playwright test --config=playwright.config.ts e2e/critical-path.spec.ts --workers=1 --retries=0
```

For email-enabled staging only, set `PLAYWRIGHT_STAGING_MAIL_MODE=capture` and configure `PLAYWRIGHT_STAGING_MAIL_HANDOFF_DIR` and `PLAYWRIGHT_STAGING_MAIL_RECIPIENT_TEMPLATE` for the approved isolated inbox. Follow the filenames printed by the test. Keep the setup URL out of shell history and logs. The test removes its handoff files within its normal cleanup.

For offline discovery, set `PLAYWRIGHT_SKIP_LOCAL_ENV=true`, supply two HTTPS `.example.test` origins and their matching approved-origin pair, and pass `--list`.
