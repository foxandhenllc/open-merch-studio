import type { QuoteBreakdown } from '../types/catalog.js';
import type { PrivateArtworkStorage } from '../admin/collection-artwork.types.js';

export type CollectionQuoteOrigin = {
  collectionId: string;
  version: number;
  layoutRevision: number;
  reviewDigest: string;
  salesRevision: number;
};
export type PurchaseFile = {
  assetId: string;
  itemId: string;
  placementCode: string;
  path: string;
  sha256: string;
  sourceChecksum: string;
  width: number;
  height: number;
  byteSize: number;
};
export type PurchaseManifest = {
  schemaVersion: 1;
  quoteId: string;
  sessionId: string;
  requestHash: string;
  namespace: string;
  origin: CollectionQuoteOrigin;
  files: PurchaseFile[];
  quote: QuoteBreakdown;
};
export type PurchaseStorage = Pick<
  PrivateArtworkStorage,
  'namespace' | 'assertPrivate' | 'read' | 'write'
> & {
  providerUrl: (path: string) => Promise<string>;
};
