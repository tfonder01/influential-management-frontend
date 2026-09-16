# Frontend Standards

## Stack and implementation

- Use the current Next.js, React, TypeScript, Tailwind CSS, and component patterns. Read repository version-specific Next.js guidance before runtime or routing changes.
- Reuse existing UI components, hooks, typed models, stores, and API/client abstractions.
- Do not bypass centralized authentication, session, refresh, route-protection, or API error handling.
- Frontend role/location checks are UX only; they do not replace backend enforcement.
- Avoid unrelated redesigns/refactors. Preserve established information architecture and interactions unless the task changes them.
- Use structured IDs and state, not display labels or formatted text, for mutations and workflow decisions.

## User experience

- Provide explicit loading, error, retry, empty, disabled, and success states where relevant.
- Preserve responsive behavior. Check representative phone, tablet, and desktop widths; prevent overflow and unreadable scaled-down desktop layouts.
- Preserve accessibility and keyboard behavior: semantic controls, focus visibility, labels, valid nesting, contrast, and reduced motion.
- Keep destructive, approval, archive/restore, upload, and status actions clear and success-aware. Do not navigate or claim success before server confirmation.
- Reuse the shared attachment UI pattern for file lists and upload controls instead of creating module-specific layouts. When workflow semantics require distinct groups, such as Maintenance Original Photos, Completion Photos, and Invoices, preserve those groups while reusing the shared attachment rows and upload controls. Prefer large, obvious upload targets and readable file rows over cramped inline controls.

## Forms and input formatting

- Reuse shared form/input utilities instead of implementing formatting ad hoc in individual components.
- US phone-number inputs should format user-entered digits as `(###) ###-####` while typing when practical.
- Accept pasted formatted or unformatted US phone numbers.
- Normalize phone numbers before persistence according to the existing API/data contract.
- Existing stored US phone values should render in the standard display format when possible.
- Do not apply US formatting rules to fields explicitly designed for international phone numbers.
- Phone-number formatting must not prevent normal editing, deletion, pasting, or mobile keyboard use.
- Holding Backspace must be able to clear the field to empty without selecting text.

## Configuration, privacy, and modes

- Keep demo and production paths explicit. Production must use the authenticated backend and never depend on mock data, demo role switching, or frontend-only persistence.
- Do not hard-code backend origins. Use approved environment/configuration helpers.
- Treat `NEXT_PUBLIC_*` values as public. Never place secrets, private credentials, bearer tokens, or server-only configuration in client bundles.
- Preserve Sentry privacy: do not send tokens, cookies, passwords, message bodies, sensitive record/file contents, or storage credentials. Expected 4xx flows should not become noisy exceptions.
- Preserve private-file access through authorized backend endpoints and avoid leaking backend implementation details.
- Keep client-specific data and branding separate from reusable SentryPoint components.
- Avoid generated-file drift unless required and understood.

## Validation

Run relevant focused tests while developing. Current repository validation commands are:

```text
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Use configured scripts/package tooling. A production build is required for changes affecting Next.js runtime behavior, routing, rendering boundaries, or configuration. Report unavailable browser, backend, or external-service verification separately.
