# Testing

Unit tests use Node's test runner. The focused Playwright suite exercises critical portal workflows against **staging only**.

## Install

```powershell
pnpm install
pnpm exec playwright install chromium
```

## Required Playwright environment

Set these outside source control (for example in the shell or a CI secret store):

```text
PLAYWRIGHT_BASE_URL=https://stg.example.com
PLAYWRIGHT_OWNER_EMAIL=<dedicated STG Owner email>
PLAYWRIGHT_OWNER_PASSWORD=<dedicated STG Owner password>
PLAYWRIGHT_DIRECTOR_EMAIL=<dedicated STG Director email>
PLAYWRIGHT_DIRECTOR_PASSWORD=<dedicated STG Director password>
PLAYWRIGHT_DIRECTOR_LOCATION_NAME=<the Director's assigned location name>
PLAYWRIGHT_RESTRICTED_LOCATION_NAME=<a different location visible to the Owner>
```

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

The suite uses Chromium, one worker, retry-on-failure, and failure-only screenshots/video plus a trace on retry. It creates timestamped disposable records. Cleanup archives created records when the product permits it; it never permanently deletes shared or fixture data. If a test is interrupted before cleanup, search STG for the `E2E` title prefix and archive only that disposable record.

The coverage includes Owner session restoration/logout, Director location scoping and direct-navigation denial, Maintenance and Supply approval/progress, Compliance fields, private-file upload/download controls, and archive/restore.
