import type { PurchaseManifest } from './purchase.types.js';

export const preparationGraceMs = 7 * 24 * 60 * 60 * 1000;
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
/** Treat persisted metadata as untrusted; never turn arbitrary JSON paths into deletion targets. */
export function expiredPreparation(
  value: unknown,
  namespace: string,
  now: number
): PurchaseManifest | null {
  try {
    const m = value as PurchaseManifest;
    if (
      m.schemaVersion !== 1 ||
      !uuid(m.quoteId) ||
      m.quote.id !== m.quoteId ||
      m.namespace !== namespace ||
      !m.sessionId ||
      !Array.isArray(m.files) ||
      !m.files.length ||
      m.files.length > 100 ||
      !Number.isFinite(Date.parse(m.quote.expiresAt)) ||
      Date.parse(m.quote.expiresAt) > now - preparationGraceMs
    )
      return null;
    if (new Set(m.files.map((f) => f.assetId)).size !== m.files.length) return null;
    for (const f of m.files) {
      if (
        !uuid(f.assetId) ||
        f.path !== `owner-artwork/${f.assetId}/purchase.png` ||
        !Number.isSafeInteger(f.byteSize) ||
        f.byteSize < 1 ||
        !/^[a-f0-9]{64}$/.test(f.sha256)
      )
        return null;
    }
    return m;
  } catch {
    return null;
  }
}
