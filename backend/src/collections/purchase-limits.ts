import { createHash } from 'node:crypto';
import { withCollectionLock } from '../admin/collection-lock.js';
import { HttpError } from '../middleware.js';

type Attempt = { at: number; session: string };
const key = 'collection-print-preparation-attempts-v1';
let fixture: Attempt[] = [];
/** Bound expensive new render attempts across replicas. Completed request retries do not render. */
export async function reserveCollectionPreparation(sessionId: string, now = Date.now()) {
  return withCollectionLock(async (tx) => {
    const row = tx ? await tx.adminSetting.findUnique({ where: { key } }) : null;
    const stored = tx ? (row?.value ?? []) : fixture;
    if (
      !Array.isArray(stored) ||
      stored.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          !('at' in item) ||
          !Number.isFinite(item.at) ||
          !('session' in item) ||
          typeof item.session !== 'string'
      )
    )
      throw new HttpError('Order preparation is temporarily unavailable.', 503);
    const recent = (stored as Attempt[]).filter((item) => item.at > now - 60 * 60 * 1000);
    const session = createHash('sha256').update(sessionId).digest('hex');
    if (recent.length >= 120 || recent.filter((item) => item.session === session).length >= 30)
      throw new HttpError(
        'Too many order estimates have been requested. Please try again in an hour.',
        429,
        'collection_preparation_limit'
      );
    recent.push({ at: now, session });
    if (tx)
      await tx.adminSetting.upsert({
        where: { key },
        create: { key, value: recent, updatedBy: 'collection-checkout' },
        update: { value: recent, updatedBy: 'collection-checkout' },
      });
    else fixture = recent;
  });
}
