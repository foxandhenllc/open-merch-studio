import {
  assertUploadBucketPrivate,
  createPrivatePreviewUrl,
  downloadPrivateAsset,
} from './asset-storage.service.js';

/** New upload prints remain in private storage. Legacy public paths are never reclassified. */
export function isPrivateUploadPrint(asset: {
  sourceType?: string;
  printStoragePath?: string | null;
}): boolean {
  return (
    asset.sourceType === 'uploaded' &&
    /^(?:private-uploads|sess_[A-Za-z0-9_]+|[a-f0-9-]{36})\/[a-f0-9-]{36}\/print\.png$/.test(
      asset.printStoragePath ?? ''
    )
  );
}
export async function privateUploadPrintUrl(asset: {
  sourceType?: string;
  printStoragePath?: string | null;
}): Promise<string | null> {
  if (!isPrivateUploadPrint(asset)) return null;
  await assertUploadBucketPrivate();
  await downloadPrivateAsset(asset.printStoragePath!);
  return createPrivatePreviewUrl(asset.printStoragePath!);
}
