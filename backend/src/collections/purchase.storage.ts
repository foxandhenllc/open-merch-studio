import { env } from '../config/env.js';
import { collectionArtworkStorage } from '../admin/collection-artwork-storage.js';
import { createPrivatePreviewUrl } from '../services/asset-storage.service.js';
import type { PurchaseStorage } from './purchase.types.js';
const fixtureFiles = new Map<string, Buffer>();
const fixture: PurchaseStorage = {
  namespace: 'collection-purchase-fixture',
  assertPrivate: async () => undefined,
  read: async (path) => {
    const bytes = fixtureFiles.get(path);
    if (!bytes) throw new Error('Missing private fixture file.');
    return Buffer.from(bytes);
  },
  write: async (path, bytes) => {
    if (fixtureFiles.has(path)) throw new Error('File already exists.');
    fixtureFiles.set(path, Buffer.from(bytes));
  },
  providerUrl: async () => {
    throw new Error('Fixture files have no provider URL.');
  },
};
export function purchaseStorage(): PurchaseStorage | null {
  if (!env.databaseUrl) return env.nodeEnv === 'production' ? null : fixture;
  const storage = collectionArtworkStorage();
  return storage ? { ...storage, providerUrl: createPrivatePreviewUrl } : null;
}
