# Definition of Done

Before completing a task, the agent must:

1. Read `AGENTS.md`, relevant `.engineering` guidance, and the complete task.
2. Inspect implementation, tests, responsive behavior, auth/session flow, and affected API contracts before editing.
3. Implement the narrowest correct change while preserving behavior outside scope.
4. Add or update focused regression tests where appropriate.
5. Run relevant tests and full repository validation when requested or appropriate.
6. Run `git diff --check`, inspect the complete diff, and check for generated or unrelated drift.
7. Report exact files changed, tests and builds with their results, warnings, unresolved risks, Git status, and anything not verified.

Compilation alone does not prove completion. Validate behavior, loading/error/empty states, accessibility, responsive layouts, authorization UX, privacy, and runtime assumptions in proportion to the change.

## Git boundary

Unless the user explicitly requests the specific action, never run `git add`, `git commit`, or `git push`; create, delete, or switch branches; change remotes; or rewrite history.

The repository owner controls Git history. Always report staging and working-tree status.
