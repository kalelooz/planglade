# CODEX-PROMPT-RESOURCE-MISMATCH-AUDIT-001

Task Name:
RESOURCE-MISMATCH-AUDIT-001 - Audit Repo Against v6.2 Resources

Goal:
Compare the actual repository against the v6.2 resource pack and produce a factual mismatch report before planning further implementation.

Source of Truth:

- `PRODUCT.md`
- `TECHNICAL.md`
- `EXECUTION.md`
- `SAAS-LAUNCH.md`
- `AGENT-BOOTSTRAP.md`

Allowed Areas:

- Audit/report only.

Do-Not-Touch:

- No product code changes.
- No public copy changes.
- No package or dependency changes.
- No Prisma/schema changes.
- No fixes unless a later prompt explicitly allows them.

Report:

- Critical mismatches.
- Public copy conflicts.
- Technical mismatches.
- Launch/SaaS gaps.
- Self-host gaps.
- Suggested next tickets in priority order.

Validation:

- Report exact file evidence.
- Include validation commands run and their result.
