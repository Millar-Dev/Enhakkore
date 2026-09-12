import { PrismaClient } from '@prisma/client';
import { env } from '../env';

// A single client per process. `globalThis` caching keeps hot-reload in dev from
// opening a new connection pool on every file change.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
