import { PrismaClient } from '@prisma/client'

export function getPrismaLogLevels(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'production'
    ? (['warn', 'error'] as const)
    : (['query', 'warn', 'error'] as const)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [...getPrismaLogLevels()],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
