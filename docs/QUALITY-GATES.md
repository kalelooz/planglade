# FlowBoard Quality Gates

## Goal

Define the minimum evidence required before a FlowBoard slice is called complete.

## Default Slice Checklist

Every meaningful change should pass this checklist:

- [ ] The change matches `AGENTS.md`, `AUDIT_AND_ROADMAP.md`, and `docs/PAGE-BY-PAGE-PLAN.md`.
- [ ] Fake controls are removed, disabled, or made real.
- [ ] The changed UI uses existing component patterns before custom widgets.
- [ ] Desktop layout is checked.
- [ ] Mobile layout is checked when the changed surface is visible on mobile.
- [ ] The relevant command output has been read before claiming it passes.
- [ ] Documentation is updated when behavior, setup, or product direction changes.

## Command Gates

Use the smallest command set that proves the slice.

### Documentation-only changes

- Read changed Markdown files.
- Run a targeted search for stale contradictions when wording changes product status.

Suggested checks:

```bash
rg --line-number "full-featured|production-ready|Build passes|/home/z|fake|mock|Quick Capture|Inbox" README.md AUDIT_AND_ROADMAP.md docs worklog.md
```

### TypeScript or React component changes

- Run TypeScript checking.
- Run the most relevant lint/build command that is currently usable for the touched area.
- If lint/build is known to fail for unrelated reasons, record the exact known failure instead of claiming it passes.

Suggested checks:

```bash
npx tsc --noEmit
npm run lint
```

### UI page changes

- Start or reuse the dev server.
- Check the page in a browser.
- Capture or inspect desktop and mobile viewports.
- Verify no text overlap, clipped primary controls, duplicate page titles, or fake primary actions.

Suggested browser checks:

- Desktop: 1440 x 900.
- Mobile: 390 x 844.
- Changed page plus any page affected by shared shell/navigation.

### State or workflow changes

- Verify the original user workflow manually.
- Verify all affected views update from the same state.
- If local persistence is touched, refresh and confirm data remains.

Minimum workflow proof:

- Create.
- Edit.
- Move or complete.
- Delete.
- Refresh if persistence is in scope.

## Known Red Gates

These are known project-level issues from the audit. Do not report them as fixed unless fresh verification proves it.

- `npm run build` is not Windows-safe while it uses Linux `cp`.
- `npm run lint` has existing failures.
- `next.config.ts` currently has `typescript.ignoreBuildErrors: true`.
- The app still has mock/in-memory product data.
- Auth, Prisma, and API routes are placeholders for the actual product.

## Definition of Done

A slice is done only when:

- [ ] The requested behavior is implemented or the blocker is documented.
- [ ] Relevant verification was run after the final edit.
- [ ] Any failing check is named with the exact failure category.
- [ ] The final response names changed files and verification evidence.
- [ ] No future work is described as already complete.
