# PlanGlade — Technical Reference v2

**Status:** Final technical companion to Master Source v5  
**Date:** 2026-06-14  
**Purpose:** Define architecture, data model, authorization, testing, deployment, self-hosting, and technical guardrails for building PlanGlade from scratch.

---

## 1. Architecture Decision

Keep PlanGlade as **one full-stack Next.js application**.

Do not split into microservices.

### Rationale

- The MVP needs product speed, not distributed-system complexity.
- Next.js App Router can handle pages, route handlers, server actions, and server components.
- Self-hosting is simpler with one app + one database.
- No current scaling pressure justifies services, queues, or Kubernetes.

### Shape

```text
Browser
  → Next.js App Router
      → Server Components
      → Server Actions / Route Handlers
      → Central AuthN/AuthZ Layer
      → Prisma
      → Database
```

---

## 2. Required Stack

| Layer | Decision |
|---|---|
| Framework | Next.js 14+ or newer App Router |
| Language | TypeScript strict mode |
| Styling | Tailwind CSS |
| UI | shadcn/ui + Radix primitives |
| Icons | Lucide React |
| ORM | Prisma |
| Database | PostgreSQL production, SQLite allowed for local dev |
| Auth | Auth.js / NextAuth v5 |
| Validation | Zod |
| Forms | React Hook Form |
| Package manager | npm |
| Testing | Vitest + Playwright |
| Deployment | Docker + docker-compose baseline |

---

## 3. Core Data Model

This schema is intentionally designed around the research principle:

> One work item should appear across list, board, calendar, and timeline views without duplication.

### Required Prisma model direction

```prisma
model User {
  id          String   @id @default(cuid())
  name        String?
  email       String   @unique
  image       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships WorkspaceMember[]
  tasks        Task[]  @relation("TaskAssignee")
  notes        Note[]
}

model Workspace {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  members    WorkspaceMember[]
  projects   Project[]
  tasks      Task[]
  notes      Note[]
  docs       Doc[]
  inboxItems InboxItem[]
  labels     Label[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  role        String   @default("owner") // owner, admin, member
  userId      String
  workspaceId String
  joinedAt    DateTime @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("active") // active, paused, done, archived
  color       String?
  startDate   DateTime?
  dueDate     DateTime?
  workspaceId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       Task[]
  notes       Note[]
  docs        Doc[]

  @@index([workspaceId])
  @@index([workspaceId, status])
}

model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      String   @default("todo") // backlog, todo, in_progress, blocked, done, cancelled
  priority    String   @default("medium") // low, medium, high, urgent
  type        String   @default("task") // task, subtask, milestone
  startDate   DateTime?
  dueDate     DateTime?
  completedAt DateTime?
  workspaceId String
  projectId   String?
  parentId    String?
  assigneeId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  parent      Task?     @relation("Subtasks", fields: [parentId], references: [id], onDelete: SetNull)
  subtasks    Task[]    @relation("Subtasks")
  assignee    User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  labels      TaskLabel[]
  blocks      TaskDependency[] @relation("TaskBlocks")
  blockedBy   TaskDependency[] @relation("TaskBlockedBy")

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, dueDate])
  @@index([workspaceId, projectId])
}

model TaskDependency {
  id            String   @id @default(cuid())
  blockerTaskId String
  blockedTaskId String
  type          String   @default("finish_to_start")
  createdAt     DateTime @default(now())

  blockerTask   Task     @relation("TaskBlocks", fields: [blockerTaskId], references: [id], onDelete: Cascade)
  blockedTask   Task     @relation("TaskBlockedBy", fields: [blockedTaskId], references: [id], onDelete: Cascade)

  @@unique([blockerTaskId, blockedTaskId])
}

model InboxItem {
  id              String   @id @default(cuid())
  content         String
  status          String   @default("pending") // pending, converted, dismissed
  source          String   @default("manual") // manual, note, calendar, import
  workspaceId     String
  convertedTaskId String?
  convertedNoteId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status])
}

model Note {
  id          String   @id @default(cuid())
  title       String
  content     String?
  workspaceId String
  projectId   String?
  authorId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  author      User?     @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
  @@index([workspaceId, projectId])
}

model Doc {
  id          String   @id @default(cuid())
  title       String
  content     String?
  status      String   @default("active") // active, archived
  workspaceId String
  projectId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([projectId, status])
}

model Label {
  id          String   @id @default(cuid())
  name        String
  color       String
  workspaceId String

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       TaskLabel[]

  @@unique([workspaceId, name])
}

model TaskLabel {
  taskId  String
  labelId String

  task    Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label   Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([taskId, labelId])
}
```

---

## 4. Authorization Architecture

All permissions must live in `src/lib/permissions/`.

No inline permission logic scattered through route handlers.

### Required check order

Every API/server action touching workspace data must verify:

1. User is authenticated.
2. User is a workspace member.
3. Entity belongs to the verified workspace.
4. User role allows the operation.

### Hard rule

Never use a client-provided `userId` or `workspaceId` as trusted identity.

The session is the source of truth.

### Helper pattern

```ts
export async function requireWorkspaceMember(workspaceId: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new PermissionError("UNAUTHENTICATED")
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId,
      },
    },
  })

  if (!member) {
    throw new PermissionError("UNAUTHORIZED")
  }

  return {
    userId: session.user.id,
    workspaceId,
    role: member.role,
  }
}
```

---

## 5. API and Server Action Rules

### Prefer server actions for app mutations

Use server actions for simple authenticated app mutations where possible:
- create task
- update task
- create project
- capture inbox item
- convert inbox item
- create note/doc

Use route handlers when:
- external integrations need endpoints
- import/export uses file upload/download
- API-like contract is clearer
- testing boundary benefits from HTTP contract

### Standard response shape

For route handlers:

```ts
return Response.json({ data })
return Response.json({ error: "Message", code: "CODE" }, { status: 400 })
```

### Validation

All request bodies must use Zod.

---

## 6. Calendar and Timeline Technical Rule

Calendar and timeline must not duplicate task data.

### Calendar MVP

Query tasks where `dueDate` is not null.

### Timeline v1

Query tasks where either `startDate` or `dueDate` is not null.

If `startDate` is null, represent as a milestone/due marker.

---

## 7. Notes and Docs Technical Rule

Notes and docs are separate by product meaning.

- Notes: freeform, can be global or project-linked.
- Docs: structured, always project-linked.

Do not create one confusing “content” object until there is a real need.

---

## 8. Self-Hosting Baseline

Before public self-host claim, ship:

1. `.env.example`
2. `Dockerfile`
3. `docker-compose.yml`
4. `docs/SELF_HOSTING.md`
5. `docs/DEPLOYMENT.md`
6. `docs/BACKUP_RESTORE.md`
7. working `prisma migrate deploy`
8. app health check endpoint

### docker-compose baseline

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: planglade
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 9. Testing Requirements

### Test layers

```text
tests/
  unit/
  integration/
  e2e/
```

### Minimum tests before public MVP

Unit:
- validators
- task date logic
- project progress logic
- note checklist extraction

Integration:
- unauthenticated API denied
- cross-workspace reads denied
- cross-workspace writes denied
- inbox conversion creates task and marks inbox item converted
- calendar query only returns workspace tasks
- docs are project/workspace scoped

E2E:
- sign in dev flow
- create workspace
- capture inbox item
- convert item to task
- create project
- add task to project
- create note/doc
- calendar shows task
- navigation works without console errors

---

## 10. CI/CD

### GitHub Actions

Required checks:
- npm ci
- lint
- typecheck
- tests
- prisma validate
- build

### Security

- pin third-party GitHub Actions to SHA
- minimal permissions
- Dependabot weekly
- secret scanning
- push protection
- protected main branch

---

## 11. Observability

MVP:
- structured server logs
- request IDs
- safe error handling
- no PII/secrets in logs

Later:
- OpenTelemetry
- Sentry or self-hosted error tracking
- audit log for destructive/admin actions

---

## 12. File Structure

```text
src/
  app/
    (marketing)/
    (auth)/
    (app)/
      layout.tsx
      page.tsx
      inbox/
      tasks/
      projects/
      notes/
      calendar/
      settings/
    api/
  components/
    ui/
    layout/
    inbox/
    tasks/
    projects/
    notes/
    docs/
    calendar/
    shared/
  lib/
    auth/
    db/
    permissions/
    validations/
    services/
    utils/
  hooks/
  types/
prisma/
tests/
docs/
```

---

## 13. Security Hard Rules

- Never commit `.env`.
- Never expose secrets in browser.
- Never hardcode admin credentials.
- Never ship fake auth.
- Never trust client-provided user/workspace identity.
- Never render raw HTML without sanitization.
- Never expose stack traces.
- Never add packages without license/security review.
- Rate limit auth and import endpoints before public launch.
- Sanitize imported content.

---

## 14. Build Validation Checklist

Every Codex completion report must include:

1. Files changed.
2. What was implemented.
3. What was intentionally skipped.
4. Validation commands run.
5. Browser/manual checks.
6. Known risks/follow-ups.
7. Confirmation that no unrelated files were changed.

Required local validation where relevant:

```bash
npm run lint
npm run typecheck
npm run test
npx prisma validate
npm run build
```

---

## 15. Technical Non-Goals

Do not build in MVP:
- microservices
- background worker
- realtime collaboration
- native mobile
- complex rich-text blocks
- external calendar sync
- AI classification
- time tracking reports
- resource/inventory management
- billing
- team workload dashboards
