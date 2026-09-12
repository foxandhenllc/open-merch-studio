import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { merchantConfig } from '../generated/merchant-config.js';
import { HttpError } from '../middleware.js';
import { collectionArtwork } from './collection-artwork.service.js';
import { readArtworkRecord } from './collection-artwork.repository.js';
import { collectionArtworkStorage } from './collection-artwork-storage.js';
import { withCollectionLock } from './collection-lock.js';
import type { PrivateArtworkStorage } from './collection-artwork.types.js';
import type { BrandAsset, BrandAssetKind, BrandAssetRecord } from './brand-assets.types.js';

const prefix = 'installation-brand-asset-v1:';
const hashBytes = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const publicPath = (hash: string) => `/api/brand-assets/${hash}.png`;
const filePath = (hash: string) =>
  `owner-artwork/${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}/brand.png`;
const unavailable = () =>
  new HttpError(
    'This brand image could not be prepared or verified. Check private storage and retry.',
    503,
    'brand_asset_unavailable'
  );
const dto = (record: BrandAssetRecord): BrandAsset => ({
  hash: record.hash,
  kind: record.kind,
  width: record.width,
  height: record.height,
  byteSize: record.byteSize,
  publicPath: record.publicPath,
});
type Storage = Pick<PrivateArtworkStorage, 'namespace' | 'assertPrivate' | 'read' | 'write'>;
const fixtureBytes = new Map<string, Buffer>();
const fixture: Storage = {
  namespace: 'brand-assets-fixture',
  assertPrivate: async () => undefined,
  read: async (path) => {
    const bytes = fixtureBytes.get(path);
    if (!bytes) throw unavailable();
    return Buffer.from(bytes);
  },
  write: async (path, bytes) => {
    if (fixtureBytes.has(path)) throw unavailable();
    fixtureBytes.set(path, Buffer.from(bytes));
  },
};
const defaultStorage = () =>
  env.databaseUrl ? collectionArtworkStorage() : env.nodeEnv !== 'production' ? fixture : null;
const fixtureRecords = new Map<string, BrandAssetRecord>();
const parse = (value: unknown, hash: string) => {
  const r = value as BrandAssetRecord;
  if (
    !r ||
    r.schemaVersion !== 1 ||
    r.hash !== hash ||
    !['logo', 'share'].includes(r.kind) ||
    !['staged', 'complete'].includes(r.status) ||
    r.publicPath !== publicPath(hash) ||
    r.path !== filePath(hash) ||
    typeof r.namespace !== 'string' ||
    r.width !== (r.kind === 'logo' ? 512 : 1200) ||
    r.height !== (r.kind === 'logo' ? 512 : 630) ||
    !Number.isSafeInteger(r.byteSize) ||
    r.byteSize < 1 ||
    r.byteSize > 3 * 1024 * 1024
  )
    throw unavailable();
  return r;
};
async function read(hash: string, tx?: Prisma.TransactionClient) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new HttpError('Brand image not found.', 404);
  if (!env.databaseUrl) return fixtureRecords.get(hash) ?? null;
  const row = await (tx ?? prisma).adminSetting.findUnique({ where: { key: prefix + hash } });
  return row ? parse(row.value, hash) : null;
}
async function write(record: BrandAssetRecord, tx?: Prisma.TransactionClient) {
  if (!tx) {
    fixtureRecords.set(record.hash, structuredClone(record));
    return;
  }
  const value = JSON.parse(JSON.stringify(record)) as Prisma.InputJsonValue;
  await tx.adminSetting.upsert({
    where: { key: prefix + record.hash },
    create: { key: prefix + record.hash, value, updatedBy: 'store-admin' },
    update: { value, updatedBy: 'store-admin' },
  });
  await tx.auditLog.create({
    data: {
      actor: 'store-admin',
      action: `brand_asset_${record.status}`,
      target: prefix + record.hash,
      metadata: {
        kind: record.kind,
        width: record.width,
        height: record.height,
        byteSize: record.byteSize,
      },
    },
  });
}

export function createBrandAssetsService(storageFor = defaultStorage) {
  async function verified(hash: string) {
    const storage = storageFor(),
      record = await read(hash);
    if (
      !storage ||
      !record ||
      record.status !== 'complete' ||
      record.namespace !== storage.namespace
    )
      throw unavailable();
    await storage.assertPrivate();
    const bytes = await storage.read(record.path);
    if (hashBytes(bytes) !== record.hash || bytes.length !== record.byteSize) throw unavailable();
    return { record, bytes };
  }
  return {
    async prepare(input: unknown): Promise<BrandAsset> {
      const value = input as { assetId: string; kind: BrandAssetKind; background: string };
      if (
        !value ||
        Array.isArray(value) ||
        Object.keys(value).sort().join() !== 'assetId,background,kind' ||
        typeof value.assetId !== 'string' ||
        !['logo', 'share'].includes(value.kind) ||
        typeof value.background !== 'string' ||
        !/^#[a-f0-9]{6}$/i.test(value.background)
      )
        throw new HttpError(
          'Choose a private image, a brand image type, and a background color.',
          400
        );
      const storage = storageFor();
      if (!storage) throw unavailable();
      try {
        await storage.assertPrivate();
        const source = await withCollectionLock(async (tx) => {
          const record = await readArtworkRecord(value.assetId, tx);
          if (!record || record.status !== 'complete')
            throw new HttpError('Prepare the original image in your private library first.', 400);
          const original = await collectionArtwork.binary(value.assetId, 'original');
          if (!original || hashBytes(original.buffer) !== record.checksum) throw unavailable();
          return original.buffer;
        });
        const width = value.kind === 'logo' ? 512 : 1200,
          height = value.kind === 'logo' ? 512 : 630;
        const background =
          value.kind === 'logo' ? { r: 0, g: 0, b: 0, alpha: 0 } : value.background;
        const image = sharp(source, { limitInputPixels: 40000000 })
          .rotate()
          .resize(width, height, { fit: 'contain', background })
          .png();
        const bytes = await (
          value.kind === 'share' ? image.flatten({ background: value.background }) : image
        ).toBuffer();
        if (bytes.length > 3 * 1024 * 1024)
          throw new HttpError(
            'This image is too detailed for a brand preview. Choose a smaller image.',
            400
          );
        const hash = hashBytes(bytes);
        let record = await withCollectionLock(async (tx) => {
          const existing = await read(hash, tx);
          if (existing) {
            if (existing.namespace !== storage.namespace || existing.kind !== value.kind)
              throw unavailable();
            return existing;
          }
          const count = tx
            ? await tx.adminSetting.count({ where: { key: { startsWith: prefix } } })
            : fixtureRecords.size;
          if (count >= 200)
            throw new HttpError(
              'The brand image archive is full. Ask your operator to review retained brand versions.',
              409
            );
          const next: BrandAssetRecord = {
            schemaVersion: 1,
            hash,
            kind: value.kind,
            width,
            height,
            byteSize: bytes.length,
            publicPath: publicPath(hash),
            path: filePath(hash),
            namespace: storage.namespace,
            status: 'staged',
          };
          await write(next, tx);
          return next;
        });
        if (record.status === 'complete') return dto((await verified(hash)).record);
        let matches = false;
        try {
          matches = hashBytes(await storage.read(record.path)) === hash;
        } catch {
          /* Unwritten staged file. */
        }
        if (!matches) {
          try {
            await storage.write(record.path, bytes, 'image/png');
          } catch {
            /* Verify an uncertain upload before deciding it failed. */
          }
          if (hashBytes(await storage.read(record.path)) !== hash) throw unavailable();
        }
        record = await withCollectionLock(async (tx) => {
          const found = await read(hash, tx);
          if (!found || found.namespace !== storage.namespace) throw unavailable();
          if (found.status === 'complete') return found;
          const complete: BrandAssetRecord = { ...found, status: 'complete' };
          await write(complete, tx);
          return complete;
        });
        return dto(record);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw unavailable();
      }
    },
    async preview(hash: string) {
      try {
        return (await verified(hash)).bytes;
      } catch {
        throw unavailable();
      }
    },
    async assertProfile(fields: Record<string, string>) {
      for (const [field, kind] of [
        ['brand.logoPath', 'logo'],
        ['brand.socialImagePath', 'share'],
      ] as const) {
        const match = /^\/api\/brand-assets\/([a-f0-9]{64})\.png$/.exec(fields[field] ?? '');
        if (!match) continue;
        const { record } = await verified(match[1]);
        if (record.kind !== kind)
          throw new HttpError('Choose the prepared image for the correct brand slot.', 400);
      }
    },
    async publicImage(hash: string) {
      if (
        merchantConfig.brand.logoPath !== publicPath(hash) &&
        merchantConfig.brand.socialImagePath !== publicPath(hash)
      )
        return null;
      try {
        return (await verified(hash)).bytes;
      } catch {
        return null;
      }
    },
  };
}
export const brandAssets = createBrandAssetsService();
