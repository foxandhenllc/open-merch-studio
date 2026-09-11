import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';
import type { ArtworkRecord } from './collection-artwork.types.js';

export const artworkKeyPrefix = 'installation-artwork-v1:';
const fixtures = new Map<string, ArtworkRecord>();
export const artworkFolder = (id: string) => `owner-artwork/${id}`;
export function assertArtworkId(id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))
    throw new HttpError('Artwork was not found.', 404, 'collection_artwork_not_found');
}
function parse(value: unknown, id: string): ArtworkRecord {
  const record = value as ArtworkRecord;
  if (
    !record ||
    record.id !== id ||
    !['uploading', 'complete', 'deleting'].includes(record.status) ||
    typeof record.filename !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(record.mimeType) ||
    !Number.isSafeInteger(record.byteSize) ||
    record.byteSize <= 0 ||
    typeof record.namespace !== 'string' ||
    !Number.isFinite(Date.parse(record.uploadExpiresAt)) ||
    !Number.isFinite(Date.parse(record.rightsConfirmedAt)) ||
    !record.originalPath.startsWith(`${artworkFolder(id)}/original.`)
  )
    throw new Error('Invalid artwork metadata.');
  if (
    record.status === 'complete' &&
    (!record.width ||
      !record.height ||
      !record.checksum ||
      !record.previewPath?.startsWith(`${artworkFolder(id)}/`) ||
      !record.printPath?.startsWith(`${artworkFolder(id)}/`))
  )
    throw new Error('Incomplete artwork metadata.');
  return record;
}
export async function readArtworkRecord(
  id: string,
  tx?: Prisma.TransactionClient
): Promise<ArtworkRecord | null> {
  assertArtworkId(id);
  if (!env.databaseUrl) return structuredClone(fixtures.get(id) ?? null);
  const row = await (tx ?? prisma).adminSetting.findUnique({
    where: { key: artworkKeyPrefix + id },
  });
  return row ? parse(row.value, id) : null;
}
export async function listArtworkRecords(tx?: Prisma.TransactionClient): Promise<ArtworkRecord[]> {
  if (!env.databaseUrl) return structuredClone([...fixtures.values()]);
  const rows = await (tx ?? prisma).adminSetting.findMany({
    where: { key: { startsWith: artworkKeyPrefix } },
    orderBy: { createdAt: 'asc' },
    take: 101,
  });
  return rows.map((row) => parse(row.value, row.key.slice(artworkKeyPrefix.length)));
}
export async function writeArtworkRecord(
  record: ArtworkRecord,
  action: string,
  tx?: Prisma.TransactionClient
) {
  if (!tx) {
    fixtures.set(record.id, structuredClone(record));
    return;
  }
  const key = artworkKeyPrefix + record.id;
  const value = JSON.parse(JSON.stringify(record)) as Prisma.InputJsonValue;
  await tx.adminSetting.upsert({
    where: { key },
    create: { key, value, updatedBy: 'store-admin' },
    update: { value, updatedBy: 'store-admin' },
  });
  await tx.auditLog.create({
    data: { actor: 'store-admin', action, target: key, metadata: { status: record.status } },
  });
}
export async function removeArtworkRecord(id: string, tx?: Prisma.TransactionClient) {
  if (!tx) {
    fixtures.delete(id);
    return;
  }
  const key = artworkKeyPrefix + id;
  await tx.adminSetting.deleteMany({ where: { key } });
  await tx.auditLog.create({
    data: { actor: 'store-admin', action: 'collection_artwork_removed', target: key, metadata: {} },
  });
}
