import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const IMPORT_LEASE_MS = 5 * 60 * 1000;
const CLAIM_ATTEMPTS = 3;

class WorkspaceImportClaimRaceError extends Error {}

function isRetryableClaimError(error: unknown) {
  return (
    error instanceof WorkspaceImportClaimRaceError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1008", "P2002", "P2034"].includes(error.code))
  );
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export type WorkspaceImportClaim =
  | { status: "acquired"; claimId: string }
  | { status: "in_progress" }
  | { status: "replayed"; result: Prisma.JsonValue };

export async function runSerializableWorkspaceImport<T>(
  client: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2_000,
        timeout: 15_000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (attempt >= CLAIM_ATTEMPTS - 1 || !retryable) throw error;
    }
  }
  throw new Error("Workspace import transaction retry exhausted");
}

export async function claimWorkspaceImportOperation(
  client: PrismaClient,
  input: { workspaceId: string; sourceChecksum: string; now?: Date },
): Promise<WorkspaceImportClaim> {
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const now = input.now ?? new Date();
    const claimId = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + IMPORT_LEASE_MS);
    try {
      return await client.$transaction(
        async (tx) => {
          const existing = await tx.workspaceImportOperation.findUnique({
            where: { workspaceId: input.workspaceId },
          });
          if (
            existing?.completedAt &&
            existing.sourceChecksum === input.sourceChecksum &&
            existing.result !== null
          ) {
            return { status: "replayed" as const, result: existing.result };
          }
          if (
            existing &&
            !existing.completedAt &&
            existing.leaseExpiresAt > now
          ) {
            return { status: "in_progress" as const };
          }

          if (!existing) {
            await tx.workspaceImportOperation.create({
              data: {
                workspaceId: input.workspaceId,
                claimId,
                sourceChecksum: input.sourceChecksum,
                leaseExpiresAt,
              },
            });
          } else {
            const replaced = await tx.workspaceImportOperation.updateMany({
              where: {
                workspaceId: input.workspaceId,
                claimId: existing.claimId,
                OR: [
                  { completedAt: { not: null } },
                  { leaseExpiresAt: { lte: now } },
                ],
              },
              data: {
                claimId,
                sourceChecksum: input.sourceChecksum,
                leaseExpiresAt,
                completedAt: null,
                result: Prisma.DbNull,
              },
            });
            if (replaced.count !== 1) throw new WorkspaceImportClaimRaceError();
          }
          return { status: "acquired" as const, claimId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (attempt >= CLAIM_ATTEMPTS - 1 || !isRetryableClaimError(error))
        throw error;
      await pause(10 * (attempt + 1));
    }
  }
  throw new Error("Workspace import claim retry exhausted");
}

export async function completeWorkspaceImportOperation(
  client: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    claimId: string;
    result: Prisma.InputJsonValue;
    now?: Date;
  },
) {
  const completed = await client.workspaceImportOperation.updateMany({
    where: {
      workspaceId: input.workspaceId,
      claimId: input.claimId,
      completedAt: null,
    },
    data: {
      completedAt: input.now ?? new Date(),
      result: input.result,
    },
  });
  if (completed.count !== 1)
    throw new Error("Workspace import lease was lost before completion");
}

export async function releaseWorkspaceImportOperation(
  client: PrismaClient,
  input: { workspaceId: string; claimId: string },
) {
  const released = await client.workspaceImportOperation.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      claimId: input.claimId,
      completedAt: null,
    },
  });
  return released.count === 1;
}
