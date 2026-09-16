# Project Context

## Product and ownership

- This is the frontend for the Influential Management Operations & Compliance Portal, maintained by SentryPoint Systems.
- The application began as a prototype and is now production-oriented. Production mode must use real authenticated backend services and persisted data, never fake or mock data.
- `influential-management-frontend` and `influential-management-backend` are sibling repositories. Inspect affected contracts across both repositories, but modify the sibling only when the task includes it.
- Influential Management client data and branding must remain distinct from reusable SentryPoint intellectual property.

## Access and privacy boundaries

- Roles are Owner, Director, and Assistant Director.
- Owners have organization-wide location access. Directors and Assistant Directors are restricted to assigned locations; their permissions may diverge over time.
- Backend authorization is authoritative. Frontend permission handling improves UX but never substitutes for backend organization/location enforcement.
- Files are private and must use authorized backend flows; do not make public object URLs the access model.
- The product does not score, rank, or compare employees.

## Durable workflow rules

- Compliance and Operations are distinct workspaces. Applicable review actions reflect backend role and location rules.
- Maintenance approval and repair progress are separate state dimensions. Supply approval and fulfillment progress are also separate.
- Archive and restore preserve history, access rules, filtering, and established confirmation/error behavior.
- User-facing activity, in-app notifications, and email are distinct concerns. Preserve backend recipient and authorization decisions; delivery failures must not erase successful business actions.
- Demo behavior and production behavior stay visibly and technically separate. Production must not fall back to demo data or mock authorization.

Keep this file limited to durable product facts, not temporary sprint details.
