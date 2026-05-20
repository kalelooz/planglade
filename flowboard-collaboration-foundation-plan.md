# FlowBoard Collaboration Foundation

## Goal

Implement the next production foundation after the server-backed core loop: real activity/history, comments/mentions, notifications, durable settings/themes, import/export, and project-level feature toggles.

## Tasks

- [ ] Add server activity service and write `ActivityEvent` rows from project/work-item/note/member/settings mutations. Verify: create/edit/move/complete/delete events appear after refresh in `/activity`.
- [ ] Replace mock/Zustand Activity reads with server-backed activity API and add task-drawer history. Verify: a task drawer shows only that task's history.
- [ ] Add work-item comments API and drawer comments UI. Verify: comments survive refresh and viewer role cannot mutate them.
- [ ] Parse mentions in comments against workspace members. Verify: known members resolve, unknown mentions do not break comment creation.
- [ ] Add notification model/API and generate in-app notifications from mentions, assignments, due-date changes, and comments. Verify: unread/read state persists and respects notification settings.
- [ ] Persist light/dark/system theme, density, accent, and notification preferences through `/api/settings`. Verify: settings survive refresh/sign-out/sign-in.
- [ ] Add server-backed settings export/import and workspace JSON export. Verify: exported data contains only the active workspace and can restore settings.
- [ ] Add `ProjectSettings` with project mode and feature flags for comments, mentions, notifications, subtasks, relations, docs, attachments, custom fields, and SLA. Verify: disabling a feature hides UI and blocks related mutations.
- [ ] Implement optional child work items and relations after project flags exist. Verify: child tasks are real work items, and parent close guard works only when enabled.
- [ ] Phase X: Verification. Run targeted TypeScript, route/API checks, role-boundary tests for touched APIs, and one browser smoke pass for changed UI surfaces.

## Done When

- [ ] Activity/task history, comments, mentions, notifications, settings/themes, import/export, and project feature flags are all real server-backed behavior.
- [ ] No fake notification, history, comment, or settings controls remain visible.
- [ ] `docs/ACTIVE_PLAN.md` and `docs/FULLSTACK_ROADMAP.md` point to the same next implementation order.

## Notes

- Keep one `WorkItem` model. Do not split tasks/tickets/issues/requests into separate tables.
- Keep SLA and ITSM-lite behind service-desk project mode.
- Defer public landing page, broad reports, automation, and formula custom fields until the collaboration foundation is stable.
