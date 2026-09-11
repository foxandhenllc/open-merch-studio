import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import {
  assetStorageConfigured,
  assertUploadBucketPrivate,
  createPrivateUploadUrl,
  createPrivateOriginalDownloadUrl,
  downloadPrivateAsset,
  uploadPrivateAsset,
  removePrivateArtworkFolder,
} from '../services/asset-storage.service.js';
import type { PrivateArtworkStorage } from './collection-artwork.types.js';

export function collectionArtworkStorage(): PrivateArtworkStorage | null {
  if (!assetStorageConfigured()) return null;
  return {
    namespace: createHash('sha256')
      .update(`${env.supabaseUrl}|${env.supabaseUploadBucket}`)
      .digest('hex'),
    assertPrivate: assertUploadBucketPrivate,
    authorize: createPrivateUploadUrl,
    downloadUrl: createPrivateOriginalDownloadUrl,
    read: downloadPrivateAsset,
    write: (path, buffer, contentType) => uploadPrivateAsset({ path, buffer, contentType }),
    removeFolder: removePrivateArtworkFolder,
  };
}
