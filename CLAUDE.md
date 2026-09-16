# CLAUDE.md

## Instruction Hierarchy

Start with `AGENTS.md`, then read the relevant guidance in `.engineering/` before implementation or review. Preserve the repository-specific product and workflow context below; `.engineering/` provides shared standards and agent workflows without replacing these rules.

## Project Context

This is the frontend for the Influential Management Operations & Compliance platform.

Influential Management operates multiple childcare locations.

The application is an internal business system used by:

- Owners
- Directors
- Assistant Directors

The frontend originated as a v0-generated prototype and has been progressively refined into a production-oriented Next.js application.

The current design should be preserved unless a task specifically requests UI changes.

---

## Business Goal

The system centralizes information that was previously fragmented across tools such as messaging apps, documents, photos, and manual processes.

Core goals:

- organization
- centralized records
- location visibility
- controlled access
- upload/document tracking
- review status
- operational communication
- maintenance tracking
- supply approvals
- audit readiness

---

## Production Backend

The production backend lives in a sibling repository:

```text
influential-management-backend

Typical workspace layout:

Custom Work/
  influential-management-frontend/
  influential-management-backend/

When both repositories are available, backend code may be inspected as reference.

Do not modify the backend unless the task explicitly includes backend changes.

Environment Modes

Example frontend environment:

NEXT_PUBLIC_APP_MODE=demo
NEXT_PUBLIC_API_URL=http://localhost:8080

For production integration:

NEXT_PUBLIC_APP_MODE=production
NEXT_PUBLIC_API_URL=http://localhost:8080

Never commit .env.local.

UI Direction

The current visual identity is based around Influential Management.

The company does not currently have a finalized logo.

Use the existing simple text/monogram branding.

A future client-provided logo should be easy to substitute.

The application may include subtle attribution:

Powered by SentryPoint Systems

SentryPoint should not visually overpower the client brand.

Current Information Architecture

Main navigation:

Dashboard
Compliance
Operations
Maintenance
Supply Requests
Locations
Needs Review
Activity
Archived
Settings

Do not merge Operations back into Compliance.

Production Migration Strategy

The frontend contains legacy/mock prototype behavior.

When production APIs are implemented:

Preserve the working UX.
Replace mock state vertically, workflow by workflow.
Avoid rewriting the entire frontend at once.
Keep demo mode isolated if still useful.
Production mode must never depend on demo data.

Recommended production conversion sequence:

Authentication / locations
Compliance + Operations
Maintenance
Supply Requests
Audits / notifications / reporting
hardening and UAT
API Usage

Use the centralized API client.

Prefer typed request/response models.

Handle common API states consistently:

loading
success
validation errors
unauthorized
forbidden
not found
conflict
server error

Display useful messages without exposing backend implementation details.

Authorization UX

The backend decides access.

The frontend should:

hide actions the user cannot perform
only show locations returned by backend
gracefully handle 403/404
never assume hidden UI equals secure authorization
Record Organization

As data volume grows, expect production APIs to support:

search
location filtering
category/type filtering
classroom/area filtering
status filtering
date filtering
archive filtering
server-side pagination

Do not load an unlimited number of records into the browser.

Pagination and search should operate together through backend filtering.

Structured Titles

Recurring records should use structured title generation where possible.

Examples:

Infant Classroom Observation — August 2026
Fire Drill — August 2026
Opening Checklist — August 2026
Child Enrollment File — Sofia Rivera

Avoid requiring users to manually type recurring months/years into titles.

A custom-title escape hatch may remain available.

Maintenance Repeat Issues

A repeat issue should not be a manually checked demo flag in production.

The intended future behavior is derived from structured repair history, potentially using:

location
asset/fixture
area
maintenance category
historical repair count
historical cost

UI wording may use:

Potential repeat issue

or:

Repeat issue detected

Do not add a simple user-controlled "repeat issue" checkbox unless explicitly requested.

Mobile Priority

Directors may use phones while at childcare locations.

Prioritize mobile usability for:

uploads
record details
maintenance issues
photo attachments
supply requests
comments
review actions

Desktop remains important for Owners and administrative review.

Code Quality

Prefer:

reusable components
clear TypeScript types
centralized constants
small hooks/helpers
consistent patterns

Avoid:

giant components
duplicated status mappings
duplicated role logic
unnecessary abstractions
broad rewrites
new dependencies without a clear reason
Git

Never commit, stage, push, branch, or modify remotes.

The project owner performs Git operations manually.

Always report Git status at the end.
````
