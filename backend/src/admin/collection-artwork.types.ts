import type { CollectionArtwork } from '@open-merch-studio/collection-drafts';

export type ArtworkRecord = CollectionArtwork & {
  originalPath: string;
  previewPath?: string;
  printPath?: string;
  namespace: string;
  uploadExpiresAt: string;
  uploadAuthorizationSettled: boolean;
  checksum?: string;
};
export type PrivateArtworkStorage = {
  namespace: string;
  assertPrivate: () => Promise<void>;
  authorize: (path: string) => Promise<string>;
  downloadUrl: (path: string) => Promise<string>;
  read: (path: string) => Promise<Buffer>;
  write: (path: string, buffer: Buffer, mime: string) => Promise<void>;
  removeFolder: (prefix: string) => Promise<void>;
};
