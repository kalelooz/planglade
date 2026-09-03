# PlanGlade user guide

This guide introduces the core PlanGlade workflow. Interface labels may vary slightly between local and authenticated workspaces, but the planning model stays the same.

## Start with quick capture

Use **Quick capture** whenever you need to record something without interrupting your current work. New items appear in the Inbox so you can organize them later.

## Process the Inbox

The Inbox holds work that has not been fully organized. Review each item, add the useful context, and move it into the project or schedule where it belongs.

## Work with tasks

The Tasks page keeps every task in one searchable workspace. Use its controls to:

- Switch between list, board, and timeline presentations.
- Filter by the properties relevant to your current review.
- Group related tasks.
- Show or hide completed work.
- Open a task drawer for its full details, relations, and history.

Edits update the same underlying task everywhere it appears.

## Organize projects

Projects collect related tasks and project context. Use them when several pieces of work contribute to one outcome. Project pages provide a focused view without creating copies of tasks.

## Keep reference notes

Notes hold supporting information that does not belong in a task description. Link notes to a project when the context is project-specific, or leave them independent for general reference.

## Plan on the calendar

The Calendar page places tasks on their due dates. Switch between month and week views, filter the visible workload, and select a task to open its drawer.

Busy days display a task count. Selecting the count opens the day's task list; selecting a task from that list opens its normal detail drawer.

## Explore connections

Connections visualizes relationships between projects, tasks, notes, people, and labels. Filter the graph when you need a smaller view, and select a node to inspect its direct relationships.

## Adjust settings and protect your data

Settings contains workspace preferences, appearance and date controls, account information, and data tools.

Read [workspace permissions](./PERMISSIONS.md) to see what each role can view, change, export, import, or delete.

Workspace export, append import, and server backup/restore are different operations. A workspace export is a portable JSON snapshot of the permitted product records listed in its manifest; it excludes authentication, memberships, attachments, and operations data. Append import creates imported projects with unique destination slugs, creates other supported records, skips possible duplicates by normalized name or title, and discards fields listed in its preview. The confirmed source checksum is its idempotency key: every completed checksum retains and replays its committed result, while another import already running for the workspace returns a conflict. It does not restore a workspace. Administrators of authenticated workspaces must review the version, checksum, exact counts, relationship remaps, collision strategy, and discarded fields before confirming an append import.

For disaster recovery, back up the database and attachment volume together. A JSON workspace export is not a server backup.

For server backups, upgrades, and recovery procedures, see:

- [Backup and restore](../backend/docs/BACKUP_RESTORE.md)
- [Production migrations](../backend/docs/PRODUCTION_MIGRATIONS.md)
- [Self-hosting](../backend/docs/SELF_HOSTING.md)

## Get help

- [Support and bug reports](./SUPPORT.md)
- [Read the security policy](../SECURITY.md)
- [Review recent changes](../CHANGELOG.md)
