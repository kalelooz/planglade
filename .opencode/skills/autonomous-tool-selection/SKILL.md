---
name: autonomous-tool-selection
description: Use at the start of EVERY task. This is the meta-skill that governs autonomous tool and skill selection. When the user gives any instruction in plain English, you MUST proactively decide which MCPs, skills, and tools to invoke without being asked. Trigger keywords: always, every task, any request, plain english.
---

# Autonomous Tool & Skill Selection

## Core Directive

**The user speaks in plain English. You decide what tools, MCPs, and skills to use.**

Never wait for the user to tell you which tool to use. At the start of every task, run through this checklist and invoke what's relevant immediately.

## Decision Checklist (Run Silently on Every Request)

### 1. Is this a creative/feature work?
→ Load `brainstorming` skill first

### 2. Is this a multi-step task?
→ Load `writing-plans` skill, create a plan, then load `executing-plans` or `subagent-driven-development`

### 3. Does it involve UI/components?
→ Load `ui-component-patterns` skill
→ Load `flowboard-conventions` skill
→ Use existing shadcn/ui components from `@/components/ui/`

### 4. Does it involve the kanban board or drag-and-drop?
→ Load `flowboard-dnd-kanban` skill
→ DO NOT refactor the DnD pattern — it's verified working

### 5. Does it need library/API documentation?
→ Use `context7` MCP to look up current docs for the library in question

### 6. Does it need browser validation or visual testing?
→ Use `playwright` MCP to open browser, navigate to localhost:3000, verify UI

### 7. Does it involve GitHub (PRs, issues, commits, repo)?
→ Use `github` MCP

### 8. Is this a complex problem requiring structured thinking?
→ Use `sequential-thinking` MCP

### 9. Is this a bug or unexpected behavior?
→ Load `systematic-debugging` skill before proposing fixes

### 10. Are you about to claim work is complete?
→ Load `verification-before-completion` skill — run relevant checks first

### 11. Working on a branch that's ready to integrate?
→ Load `finishing-a-development-branch` skill

### 12. Receiving code review feedback?
→ Load `receiving-code-review` skill

### 13. Before merging or after completing a major feature?
→ Load `requesting-code-review` skill

## Tool Usage Rules

### Parallel by Default
- Independent searches → parallel tool calls
- Independent file reads → parallel tool calls
- Independent bash commands → parallel tool calls

### Search Strategy
1. `glob` for file patterns first (fast)
2. `grep` for content search
3. `read` for specific files
4. `task` with explore subagent for deep codebase questions

### Bash Rules
- Use `workdir` parameter instead of `cd`
- Quote paths with spaces
- Explain non-trivial commands before running

### Edit Rules
- Always `read` before `edit`
- Use `replaceAll` for renames across a file
- Preserve existing code style and conventions

## MCP Quick Reference

| MCP | When to Use |
|-----|-------------|
| **playwright** | Browser testing, visual validation, UI review, checking localhost:3000 |
| **context7** | Looking up library docs (shadcn, Radix, TanStack, Prisma, Next.js, etc.) |
| **github** | PRs, issues, commits, repo management, code review workflows |
| **sequential-thinking** | Complex architectural decisions, multi-factor analysis, debugging root causes |

## Skill Quick Reference

| Skill | When to Use |
|-------|-------------|
| **brainstorming** | Before any creative work — features, components, behavior changes |
| **flowboard-conventions** | Any FlowBoard project work — tech stack, patterns, file structure |
| **flowboard-dnd-kanban** | Kanban board drag-and-drop work ONLY |
| **ui-component-patterns** | Creating/modifying UI components, forms, dialogs, tables |
| **writing-plans** | Multi-step tasks with clear requirements |
| **executing-plans** | When you have a written plan to execute |
| **subagent-driven-development** | Parallel independent tasks in current session |
| **systematic-debugging** | Any bug, test failure, unexpected behavior |
| **test-driven-development** | Before writing feature or bugfix implementation code |
| **verification-before-completion** | Before claiming work is done, fixed, or passing |
| **requesting-code-review** | Before merging or after major features |
| **receiving-code-review** | When implementing review feedback |
| **finishing-a-development-branch** | When implementation is complete and tests pass |

## Anti-Patterns (Never Do These)

- Waiting for the user to specify which tool to use
- Using only one tool when multiple would be faster in parallel
- Hand-rolling UI components that shadcn already provides
- Refactoring the verified DnD kanban pattern
- Running full lint/build/test suites for small scoped changes
- Adding comments unless explicitly asked
- Using decorative gradients, vanity metrics, or fake demo data
- Guessing library APIs — use context7 MCP instead

## Example Flow

User says: "Add a filter dropdown to the tasks page"

You silently:
1. Load `flowboard-conventions` (project context)
2. Load `ui-component-patterns` (component work)
3. `glob` to find the tasks page file
4. `read` the tasks page and existing filter patterns
5. `grep` for existing Select/dropdown usage
6. Use `context7` MCP if unsure about shadcn Select API
7. Implement using existing `@/components/ui/select`
8. `bash` to run TypeScript check on touched file
9. Use `playwright` MCP to verify in browser if visual risk is real
