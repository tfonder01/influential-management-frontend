# AGENTS.md

## Project

Influential Management Frontend

This repository contains the Next.js frontend for Influential Management's internal Operations & Compliance platform.

The application supports multiple childcare locations and internal roles including:

* Owner
* Director
* Assistant Director

Primary workspaces include:

* Dashboard
* Compliance
* Operations
* Maintenance
* Supply Requests
* Locations
* Needs Review
* Activity
* Archived
* Settings

The application began as a frontend prototype and is now being connected to a production backend.

***

## Technology

* Next.js
* TypeScript
* React
* Tailwind CSS
* Existing UI component primitives already present in the repository

Preserve the existing stack unless explicitly instructed otherwise.

***

## Critical Git Rules

Never:

* create commits
* stage files
* push changes
* create branches
* switch branches
* modify Git remotes
* force-push
* rewrite Git history

The repository owner reviews and commits changes manually.

At the end of implementation, report:

* files modified
* files created
* validation performed
* remaining issues
* `git status`

***

## General Working Rules

Before changing code:

1. Inspect the existing implementation.
2. Identify reusable components and patterns.
3. Understand whether the app is currently running in demo or production mode.
4. Avoid unnecessary refactors.
5. Preserve existing functionality unless the task explicitly replaces it.

Do not make unrelated changes.

Do not redesign working screens unless specifically requested.

Prefer small, reviewable changes over broad rewrites.

***

## Demo Mode vs Production Mode

The application currently supports a distinction between demo/prototype behavior and production behavior.

Environment configuration includes:

```env
NEXT_PUBLIC_APP_MODE=
NEXT_PUBLIC_API_URL=

Demo mode may use:

local/mock data
demo role switching
frontend-only interactions

Production mode must use:

real authenticated user
backend-provided role
backend-provided location access
backend APIs
server-enforced permissions

Never allow demo role switching or mock authorization to affect production authorization.

Frontend permission checks are for UX only.

The backend is the source of truth for authorization.

Roles

Business roles:

OWNER
may view all locations in the organization
may review and approve applicable items
may access organization-wide workflows
DIRECTOR
limited to assigned location(s)
may create/upload/update permitted records
must not see unrelated locations
ASSISTANT_DIRECTOR
limited to assigned location(s)
currently similar to Director
architecture should allow permissions to diverge later

Never hard-code role behavior in many unrelated components if centralized helpers/hooks can be reused.

Location Restrictions

Production data must respect backend-provided location permissions.

Do not expose records from locations the authenticated user cannot access.

Never assume frontend filtering is sufficient security.

If an API returns forbidden/not-found for an unauthorized resource, handle it gracefully.

API Integration

Prefer centralized API access through the existing API client.

Do not scatter raw fetch() calls throughout components if avoidable.

API integration should consistently handle:

authentication
token refresh
errors
loading states
request cancellation where useful
backend URL configuration

Never log:

JWTs
refresh tokens
passwords
sensitive uploaded document contents
Authentication

Production authentication uses the backend.

Expected capabilities include:

login
current-user session
access-token handling
refresh behavior
logout
route protection

Do not add public registration.

Do not add social login unless explicitly requested.

Product UX Principles

The app should feel:

simple
calm
professional
operational
easy for nontechnical staff
mobile friendly

Avoid:

excessive animations
excessive gradients
clutter
unnecessary dashboards/charts
hidden critical actions
overly dense forms

Prefer:

clear hierarchy
concise labels
strong status visibility
predictable workflows
restrained colors
useful empty states
Responsive Design

Mobile support is important because Directors and Assistant Directors may use phones for:

uploads
maintenance photos
checklist records
comments
supply requests
review/status checks

Every touched screen should be checked around:

390px
430px
768px
desktop

Avoid horizontal overflow.

Complex desktop tables may:

become responsive cards
or use controlled horizontal scrolling

Do not shrink desktop tables into unreadable mobile layouts.

Status Colors

Use consistent semantic meaning.

Green
Reviewed
Approved
Completed
Received
Yellow / Orange
Needs Attention
Awaiting Approval
Waiting
Pending
Red
Declined
Critical incident
Complaint
Urgent/destructive state
Blue / Indigo
New
In Progress
Ready
informational operational states

Do not communicate meaning by color alone.

Always retain labels/icons where appropriate.

Compliance Workspace

Expected categories include:

Licensing
Health & Safety Drills
Child Files
Staff Files
Classroom Observations
CCIR / Critical Incidents
Parent Complaints
Staff Complaints

Operations is intentionally a separate workspace and should not be reintroduced as a Compliance category.

Operations Workspace

Initial record types include:

Opening Checklist
Closing Checklist
Playground Checklist
Other Operations Record

Operations should remain separate from Compliance in the navigation and UX.

Classroom / Age Groups

Use this exact order:

Infant
Toddler
Twaddler
Prepper
Preschool

Do not reorder these values without explicit instruction.

Maintenance

Maintenance concepts include:

issue/request
location
classroom/area
category
photos
approval status
repair progress
vendor
estimated cost
final cost
invoice
completion photos
comments
activity history

Approval and repair progress are separate concepts.

Do not collapse them into one status.

Supply Requests

Supply concepts include:

request/item
location
classroom/area
category
quantity
estimated unit cost
estimated total
approval
ordering/fulfillment status
photo
vendor/store
comments
history

Approval and fulfillment status are separate concepts.

Files and Uploads

Production file interactions must eventually use authorized backend endpoints.

Do not assume uploaded files are publicly accessible.

Do not introduce public storage URLs.

Frontend upload UX should support:

PDFs
JPG
PNG

according to backend constraints.

Display file errors clearly.

Accessibility

Preserve:

keyboard navigation
focus-visible styles
valid HTML
appropriate button/link semantics
useful ARIA labels
readable color contrast
reduced-motion support

Do not introduce:

nested buttons
nested interactive controls
invalid asChild usage
inaccessible clickable divs
Testing and Validation

After changes, run available commands such as:

npm run lint
npm run typecheck
npm test
npm run build

Only run scripts that exist.

Also manually verify affected flows.

Report warnings instead of hiding them.

Security

Do not:

expose secrets
commit .env files
trust frontend role checks as security
log tokens/passwords
expose internal stack traces to users

Do not claim regulatory certifications such as:

HIPAA
FERPA
SOC 2

unless explicitly established outside the codebase.

Out-of-Scope Behavior

Do not add major product functionality unless explicitly requested.

Examples:

payment processing
accounting integrations
vendor portals
public signup
external customer accounts
AI features
inventory systems
advanced analytics
Final Response Requirements

After implementing a task, provide:

Summary
Files modified
Behavior changed
Validation performed
Remaining warnings/issues
Git status
Confirmation that no commits, staging, pushes, branches, or remotes were changed
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
