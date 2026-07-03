# CODEX-PROMPT-RESOURCE-REPLACE-001

Task Name:
DOCS-TRUTH-RESOURCE-002 - Replace Resource Pack

Goal:
Replace the old PlanGlade project-resource/source files with the v6.2 pack:

- `PRODUCT.md`
- `TECHNICAL.md`
- `EXECUTION.md`
- `SAAS-LAUNCH.md`
- `AGENT-BOOTSTRAP.md`

Allowed Areas:

- Resource/source documents only.

Do-Not-Touch:

- No app code.
- No package or dependency changes.
- No Prisma/schema changes.
- No unrelated README or public website rewrites.

Requirements:

1. Stage and commit only the v6.2 resource-pack files.
2. Do not preserve duplicate truth sources.
3. Keep the resource files as the source of truth for future tickets.

Validation:

- `git diff --check`
- `git status --short`

Expected commit message:

```text
docs: replace PlanGlade resource pack v6.2
```
