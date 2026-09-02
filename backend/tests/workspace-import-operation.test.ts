import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import test, { after, before } from "node:test";

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database";

const isolatedDatabase = createIsolatedTestDatabase();
let db: typeof import("../src/lib/db").db;
let claimWorkspaceImportOperation: typeof import("../src/lib/workspace-import-operation").claimWorkspaceImportOperation;
let completeWorkspaceImportOperation: typeof import("../src/lib/workspace-import-operation").completeWorkspaceImportOperation;
let releaseWorkspaceImportOperation: typeof import("../src/lib/workspace-import-operation").releaseWorkspaceImportOperation;
let runSerializableWorkspaceImport: typeof import("../src/lib/workspace-import-operation").runSerializableWorkspaceImport;

before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({
    claimWorkspaceImportOperation,
    completeWorkspaceImportOperation,
    releaseWorkspaceImportOperation,
    runSerializableWorkspaceImport,
  } = await import("../src/lib/workspace-import-operation"));
  await db.user.create({
    data: {
      id: "owner-1",
      email: "owner@example.com",
      normalizedEmail: "owner@example.com",
    },
  });
  await db.workspace.create({
    data: {
      id: "workspace-1",
      slug: "workspace-1",
      name: "Workspace",
      ownerId: "owner-1",
    },
  });
});

test("serializable imports retry bounded transaction conflicts", async () => {
  let attempts = 0;
  const options: unknown[] = [];
  const client = {
    $transaction: async (_work: unknown, transactionOptions: unknown) => {
      attempts += 1;
      options.push(transactionOptions);
      if (attempts < 3) {
        throw new Prisma.PrismaClientKnownRequestError("write conflict", {
          code: "P2034",
          clientVersion: "6.19.3",
        });
      }
      return "committed";
    },
  } as unknown as PrismaClient;

  assert.equal(
    await runSerializableWorkspaceImport(client, async () => "unused"),
    "committed",
  );
  assert.equal(attempts, 3);
  assert.deepEqual(
    options,
    Array(3).fill({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 2_000,
      timeout: 15_000,
    }),
  );
});

after(async () => {
  await db.$disconnect();
  await isolatedDatabase.cleanup();
});

test("parallel durable claims give one importer ownership and one conflict", async () => {
  const claims = await Promise.all([
    claimWorkspaceImportOperation(db, {
      workspaceId: "workspace-1",
      sourceChecksum: `sha256:${"1".repeat(64)}`,
    }),
    claimWorkspaceImportOperation(db, {
      workspaceId: "workspace-1",
      sourceChecksum: `sha256:${"1".repeat(64)}`,
    }),
  ]);

  assert.equal(claims.filter((claim) => claim.status === "acquired").length, 1);
  assert.equal(
    claims.filter((claim) => claim.status === "in_progress").length,
    1,
  );
});

test("a completed checksum replays its committed result", async () => {
  await db.workspaceImportOperation.deleteMany();
  const sourceChecksum = `sha256:${"2".repeat(64)}`;
  const claim = await claimWorkspaceImportOperation(db, {
    workspaceId: "workspace-1",
    sourceChecksum,
  });
  assert.equal(claim.status, "acquired");
  if (claim.status !== "acquired") return;

  const result = {
    workspaceId: "workspace-1",
    mode: "append",
    imported: { projects: 1 },
  };
  await db.$transaction((tx) =>
    completeWorkspaceImportOperation(tx, {
      workspaceId: "workspace-1",
      claimId: claim.claimId,
      result,
    }),
  );

  assert.deepEqual(
    await claimWorkspaceImportOperation(db, {
      workspaceId: "workspace-1",
      sourceChecksum,
    }),
    { status: "replayed", result },
  );
});

test("an expired lease can be replaced by a different import", async () => {
  await db.workspaceImportOperation.deleteMany();
  const first = await claimWorkspaceImportOperation(db, {
    workspaceId: "workspace-1",
    sourceChecksum: `sha256:${"3".repeat(64)}`,
  });
  assert.equal(first.status, "acquired");
  await db.workspaceImportOperation.update({
    where: { workspaceId: "workspace-1" },
    data: { leaseExpiresAt: new Date(0) },
  });

  const replacement = await claimWorkspaceImportOperation(db, {
    workspaceId: "workspace-1",
    sourceChecksum: `sha256:${"4".repeat(64)}`,
  });
  assert.equal(replacement.status, "acquired");
  if (first.status !== "acquired" || replacement.status !== "acquired") return;
  assert.notEqual(replacement.claimId, first.claimId);
});

test("release cannot remove another claimant's lease", async () => {
  const current = await db.workspaceImportOperation.findUniqueOrThrow({
    where: { workspaceId: "workspace-1" },
  });
  assert.equal(
    await releaseWorkspaceImportOperation(db, {
      workspaceId: "workspace-1",
      claimId: "not-the-current-claim",
    }),
    false,
  );
  assert.equal(
    await releaseWorkspaceImportOperation(db, {
      workspaceId: "workspace-1",
      claimId: current.claimId,
    }),
    true,
  );
});
