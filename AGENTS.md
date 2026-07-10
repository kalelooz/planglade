# PlanGlade Contributor Instructions

Keep changes small, safe, and consistent with PlanGlade's calm, solo-first product direction.

## Working Rules

- Inspect the repository state before changing files.
- Protect pre-existing work and never revert changes you did not make unless asked.
- Keep each change scoped. Avoid unrelated cleanup, broad refactors, and unrequested abstractions.
- Reuse existing code and dependencies before adding anything new.
- Do not ship fake features, metrics, claims, or placeholder behavior.

## Security And Data Isolation

- Never commit `.env` files, credentials, or secrets, and never expose secrets client-side.
- Never trust a client-provided user or workspace ID as identity.
- Never ship fake authentication, hardcode admin users, render unsanitized HTML, or expose stack traces to users.
- Every workspace operation verifies, in order: authenticated user, workspace membership, entity belongs to workspace, and role permits the operation.

## Self-Hosting

- Preserve the documented public self-host behavior and defaults.
- Public self-hosting must continue to work with NextAuth and local storage without provider-specific services or credentials.

## Validation

- Run the smallest relevant checks for the files changed.
- Use existing scripts where applicable: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npx prisma validate`.
- Report the files changed, validation run, skipped checks, and remaining risks.
