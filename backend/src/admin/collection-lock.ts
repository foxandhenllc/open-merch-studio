import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';

export const collectionDraftsKey = 'installation-collection-drafts-v1';
let fixtureQueue: Promise<unknown> = Promise.resolve();
/** Draft bindings and artwork removal share one lock, including across server replicas. */
export async function withCollectionLock<T>(
  operation: (tx?: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!env.databaseUrl) {
    if (env.nodeEnv === 'production')
      throw new HttpError(
        'Collection drafts could not be loaded or saved. Check the database connection.',
        503,
        'collection_storage_unavailable'
      );
    const run = fixtureQueue.then(() => operation());
    fixtureQueue = run.catch(() => undefined);
    return run;
  }
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${collectionDraftsKey}))`;
      return operation(tx);
    },
    { maxWait: 5000, timeout: 60000 }
  );
}
