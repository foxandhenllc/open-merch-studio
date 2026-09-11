import { randomUUID } from 'node:crypto';
import type {
  ArtworkAuthorization,
  ArtworkLibrary,
  CollectionArtwork,
} from '@open-merch-studio/collection-drafts';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import { collectionArtworkStorage } from './collection-artwork-storage.js';
import { prepareCollectionArtwork } from './collection-artwork-preparation.js';
import {
  artworkFolder,
  listArtworkRecords,
  readArtworkRecord,
  writeArtworkRecord,
  removeArtworkRecord,
} from './collection-artwork.repository.js';
import { withCollectionLock } from './collection-lock.js';
import { collectionArtworkIsReferenced } from './collection-drafts.service.js';
import type { ArtworkRecord, PrivateArtworkStorage } from './collection-artwork.types.js';

const mimeExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const missing = () => new HttpError('Artwork was not found.', 404, 'collection_artwork_not_found');
const unavailable = () =>
  new HttpError(
    'Private artwork storage could not complete this operation. Refresh the library before retrying.',
    503,
    'collection_artwork_storage_unavailable'
  );
const publicRecord = (record: ArtworkRecord): CollectionArtwork => ({
  id: record.id,
  filename: record.filename,
  mimeType: record.mimeType,
  byteSize: record.byteSize,
  status: record.status,
  rightsConfirmedAt: record.rightsConfirmedAt,
  width: record.width,
  height: record.height,
  hasTransparency: record.hasTransparency,
  readiness: record.readiness,
  readinessMessage: record.readinessMessage,
  ...(record.status === 'deleting' && record.uploadAuthorizationSettled
    ? { removeAfter: record.uploadExpiresAt }
    : {}),
});

export function createCollectionArtworkService(
  storageFactory: () => PrivateArtworkStorage | null = collectionArtworkStorage,
  now: () => Date = () => new Date()
) {
  const fixtureFiles = new Map<string, { original: Buffer; preview: Buffer; print: Buffer }>();
  const maxBytes = () =>
    env.databaseUrl
      ? Math.min(env.uploadMaxBytes, 20 * 1024 * 1024)
      : Math.min(env.uploadMaxBytes, 2 * 1024 * 1024);
  function mode() {
    if (!env.databaseUrl && env.nodeEnv === 'production') throw unavailable();
    if (!env.databaseUrl) return null;
    const storage = storageFactory();
    if (!storage) throw unavailable();
    return storage;
  }
  async function useStorage(record: ArtworkRecord) {
    const storage = mode();
    if ((storage?.namespace ?? 'fixture') !== record.namespace) throw unavailable();
    if (storage) await storage.assertPrivate();
    return storage;
  }
  async function guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw unavailable();
    }
  }
  async function list(): Promise<ArtworkLibrary> {
    return guarded(async () => {
      if (!env.databaseUrl && env.nodeEnv === 'production') throw unavailable();
      const assets = (await listArtworkRecords()).map(publicRecord);
      return {
        assets,
        maxBytes: maxBytes(),
        available: !env.databaseUrl || Boolean(storageFactory()),
        storage: env.databaseUrl ? 'private' : 'fixture',
      };
    });
  }
  async function authorize(input: {
    filename: unknown;
    contentType: unknown;
    byteSize: unknown;
    rightsConfirmed: unknown;
  }): Promise<ArtworkAuthorization> {
    return guarded(async () => {
      if (input.rightsConfirmed !== true)
        throw new HttpError(
          'Confirm that you have permission to reproduce this artwork on merchandise.',
          400,
          'artwork_rights_required'
        );
      if (
        typeof input.contentType !== 'string' ||
        !Object.hasOwn(mimeExtensions, input.contentType)
      )
        throw new HttpError('Upload a PNG, JPEG, or WebP image.', 400, 'unsupported_image_type');
      if (
        typeof input.filename !== 'string' ||
        !input.filename.trim() ||
        input.filename.length > 200
      )
        throw new HttpError('Choose a file with a valid name.', 400, 'invalid_artwork_filename');
      if (
        !Number.isSafeInteger(input.byteSize) ||
        Number(input.byteSize) <= 0 ||
        Number(input.byteSize) > maxBytes()
      )
        throw new HttpError(
          `Choose a file no larger than ${Math.floor(maxBytes() / 1024 / 1024)} MB.`,
          413,
          'upload_too_large'
        );
      const storage = mode();
      if (storage) await storage.assertPrivate();
      const id = randomUUID();
      const record: ArtworkRecord = {
        id,
        filename:
          input.filename
            .normalize('NFKC')
            .replace(/[^a-zA-Z0-9._ -]+/g, '')
            .trim()
            .slice(0, 120) || 'artwork',
        mimeType: input.contentType,
        byteSize: Number(input.byteSize),
        status: 'uploading',
        rightsConfirmedAt: now().toISOString(),
        namespace: storage?.namespace ?? 'fixture',
        originalPath: `${artworkFolder(id)}/original.${mimeExtensions[input.contentType]}`,
        uploadExpiresAt: new Date(
          now().getTime() + (storage ? 2 * 60 * 60 * 1000 : 15 * 60 * 1000)
        ).toISOString(),
        uploadAuthorizationSettled: !storage,
      };
      await withCollectionLock(async (tx) => {
        if ((await listArtworkRecords(tx)).length >= 100)
          throw new HttpError(
            'The private library holds up to 100 files. Remove unused files before uploading more.',
            409,
            'artwork_library_full'
          );
        await writeArtworkRecord(record, 'collection_artwork_upload_authorized', tx);
      });
      // Retain a pending record on an uncertain storage response so the owner can remove its folder.
      let signedUrl: string | undefined;
      if (storage) {
        try {
          signedUrl = await storage.authorize(record.originalPath);
        } finally {
          // Start the conservative expiry after signing returns, including an uncertain response.
          // If this write fails, the unsettled record prevents deletion from losing a late upload.
          await withCollectionLock(async (tx) => {
            const current = await readArtworkRecord(id, tx);
            if (!current) throw missing();
            await writeArtworkRecord(
              {
                ...current,
                uploadAuthorizationSettled: true,
                uploadExpiresAt: new Date(now().getTime() + 125 * 60 * 1000).toISOString(),
              },
              'collection_artwork_upload_window_recorded',
              tx
            );
          });
        }
      }
      return {
        assetId: id,
        transport: storage ? 'signed' : 'inline',
        ...(signedUrl ? { signedUrl } : {}),
        maxBytes: maxBytes(),
      };
    });
  }
  async function complete(id: string, inlineDataUrl?: unknown): Promise<CollectionArtwork> {
    return guarded(async () => {
      const record = await readArtworkRecord(id);
      if (!record || record.status === 'deleting') throw missing();
      const storage = await useStorage(record);
      if (record.status === 'complete') return publicRecord(record);
      if (Date.parse(record.uploadExpiresAt) <= now().getTime())
        throw new HttpError(
          'This upload expired. Remove it from the library and choose the file again.',
          409,
          'collection_upload_expired'
        );
      let original: Buffer;
      if (storage) {
        if (inlineDataUrl !== undefined)
          throw new HttpError(
            'Use the authorized private upload.',
            400,
            'invalid_upload_transport'
          );
        original = await storage.read(record.originalPath);
      } else {
        if (
          typeof inlineDataUrl !== 'string' ||
          inlineDataUrl.length > Math.ceil((maxBytes() * 4) / 3) + 100
        )
          throw new HttpError(
            'Local upload data is missing or too large.',
            400,
            'invalid_upload_transport'
          );
        const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          inlineDataUrl
        );
        if (!match || match[1] !== record.mimeType)
          throw new HttpError(
            'The file does not match its upload authorization.',
            400,
            'invalid_upload_transport'
          );
        original = Buffer.from(match[2], 'base64');
      }
      if (original.byteLength !== record.byteSize || original.byteLength > maxBytes())
        throw new HttpError(
          'The file size changed. Choose the original file again.',
          400,
          'upload_size_changed'
        );
      const prepared = await prepareCollectionArtwork(original, record.mimeType);
      const attempt = randomUUID();
      const next: ArtworkRecord = {
        ...record,
        status: 'complete',
        checksum: prepared.checksum,
        width: prepared.width,
        height: prepared.height,
        hasTransparency: prepared.hasTransparency,
        readiness: prepared.readiness,
        readinessMessage: prepared.readinessMessage,
        previewPath: `${artworkFolder(id)}/${attempt}-preview.webp`,
        printPath: `${artworkFolder(id)}/${attempt}-print.png`,
      };
      return withCollectionLock(async (tx) => {
        const current = await readArtworkRecord(id, tx);
        if (!current || current.status === 'deleting') throw missing();
        if (current.status === 'complete') return publicRecord(current);
        if (storage) {
          await storage.write(next.previewPath!, prepared.preview, 'image/webp');
          await storage.write(next.printPath!, prepared.print, 'image/png');
        }
        if (!storage) {
          const used = [...fixtureFiles.values()].reduce(
            (bytes, files) =>
              bytes + files.original.length + files.preview.length + files.print.length,
            0
          );
          if (
            used + original.length + prepared.preview.length + prepared.print.length >
            32 * 1024 * 1024
          )
            throw new HttpError(
              'The local demo artwork memory is full. Remove unused files or restart the fixture server.',
              409,
              'fixture_artwork_full'
            );
        }
        await writeArtworkRecord(next, 'collection_artwork_prepared', tx);
        if (!storage)
          fixtureFiles.set(id, { original, preview: prepared.preview, print: prepared.print });
        return publicRecord(next);
      });
    });
  }
  async function binary(id: string, kind: 'preview' | 'original' = 'preview') {
    return guarded(async () => {
      const record = await readArtworkRecord(id);
      if (!record || record.status !== 'complete') throw missing();
      const storage = await useStorage(record);
      const buffer = storage
        ? await storage.read(kind === 'original' ? record.originalPath : record.previewPath!)
        : fixtureFiles.get(id)?.[kind];
      if (!buffer) throw missing();
      return { buffer, contentType: kind === 'original' ? record.mimeType : 'image/webp' };
    });
  }
  async function originalResponse(id: string) {
    return guarded(async () => {
      const record = await readArtworkRecord(id);
      if (!record || record.status !== 'complete') throw missing();
      const storage = await useStorage(record);
      return storage
        ? { downloadUrl: await storage.downloadUrl(record.originalPath) }
        : { file: await binary(id, 'original') };
    });
  }
  async function remove(id: string) {
    return guarded(async () => {
      const record = await withCollectionLock(async (tx) => {
        const before = await readArtworkRecord(id, tx);
        if (!before) throw missing();
        if (await collectionArtworkIsReferenced(id, tx))
          throw new HttpError(
            'Detach this artwork from every collection and save those drafts before removing the file. Withdraw or update any published collection that uses it too.',
            409,
            'collection_artwork_in_use'
          );
        const next: ArtworkRecord = { ...before, status: 'deleting' };
        await writeArtworkRecord(next, 'collection_artwork_removal_requested', tx);
        return next;
      });
      const storage = await useStorage(record);
      if (storage) await storage.removeFolder(artworkFolder(id));
      else fixtureFiles.delete(id);
      // Signed upload links cannot be revoked. Keep the tombstone until it expires so a late upload
      // remains discoverable and can be cleaned instead of becoming an untracked private object.
      const pending = Boolean(
        storage &&
        (!record.uploadAuthorizationSettled || Date.parse(record.uploadExpiresAt) > now().getTime())
      );
      if (!pending) await withCollectionLock((tx) => removeArtworkRecord(id, tx));
      return {
        pending,
        ...(pending && record.uploadAuthorizationSettled
          ? { removeAfter: record.uploadExpiresAt }
          : {}),
      };
    });
  }
  return { list, authorize, complete, binary, originalResponse, remove };
}
export const collectionArtwork = createCollectionArtworkService();
