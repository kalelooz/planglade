# PlanGlade Agent Instructions

Codex reads this file automatically before work in this repository. Keep it short and practical.

## Source Of Truth

- Read `PRODUCT.md`, `TECHNICAL.md`, `EXECUTION.md`, and `SAAS-LAUNCH.md` before substantial work.
- `PRODUCT.md` owns product/design direction.
- `TECHNICAL.md` owns architecture, security, deployment, and known implementation drift.
- `EXECUTION.md` owns tickets, workflow, current state, and report format.
- `SAAS-LAUNCH.md` owns website, cloud, demo, pricing, and launch sequencing.
- If the live repo disagrees with these docs, do not silently rewrite direction. Flag the drift and keep the fix scoped.

## Working Rules

- One scoped ticket at a time.
- No unrelated cleanup.
- No broad refactors.
- No new dependency unless the ticket needs it and the reason is explicit.
- Protect existing work. Check the working tree before editing and never revert changes you did not make unless asked.
- Preserve the product direction: calm, solo-first, capture first, organize second.
- Do not ship fake features, fake metrics, placeholder claims, or unbuilt feature promises.

## Security Rules

- Never commit `.env` or secrets.
- Never expose secrets client-side.
- Never trust a client-provided user or workspace ID.
- Never ship fake auth in production.
- Never hardcode admin users.
- Never render unsanitized HTML.
- Never expose stack traces to users.
- Every workspace operation verifies, in order: authenticated user, workspace membership, entity belongs to workspace, role permits the operation.

## Skills And Plugins

- Let Codex use relevant installed skills and plugins automatically.
- If a ticket lists `Skills`, use required skills when available and suggested skills when they apply.
- If a listed skill is unavailable, continue manually using the same checks and report that the skill was not installed.
- Keep skills for repeatable workflows. Keep always-on repo rules in `AGENTS.md`.
- Do not install third-party skill packs, add repo `.agents/skills`, or commit private workflow skills unless the maintainer explicitly asks.

## Validation And Reporting

- Run the smallest relevant validation for the change.
- Use existing package scripts where applicable: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npx prisma validate`.
- Report files changed, validation run, what was built, what was skipped, and remaining risks.
- Use the completion report format in `EXECUTION.md`.
