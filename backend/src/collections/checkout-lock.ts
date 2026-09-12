import { createHash } from 'node:crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export function collectionOrderId(quoteId: string) {
  const value = createHash('sha256').update(`collection-order:${quoteId}`).digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}
const queues = new Map<string, Promise<unknown>>();
/** Separate from the publication lock: checkout validation also reads the current publication. */
export async function withCollectionCheckoutLock<T>(
  quoteId: string,
  run: () => Promise<T>
): Promise<T> {
  const key = `collection-checkout:${quoteId}`;
  if (env.databaseUrl) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        return run();
      },
      { maxWait: 5000, timeout: 60000 }
    );
  }
  const pending = (queues.get(key) ?? Promise.resolve()).then(run);
  queues.set(key, pending);
  try {
    return await pending;
  } finally {
    if (queues.get(key) === pending) queues.delete(key);
  }
}
