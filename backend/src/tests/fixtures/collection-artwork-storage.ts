import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createCollectionArtworkService } from '../../admin/collection-artwork.service.js';
import type { PrivateArtworkStorage } from '../../admin/collection-artwork.types.js';

// Test-only storage survives a new process. No Supabase or other network provider is reachable.
const directory = process.env.OMS_ARTWORK_FIXTURE_DIRECTORY!;
if (!directory?.includes('oms-artwork-storage-test-'))
  throw new Error('An isolated test folder is required.');
const pathFor = (path: string) => {
  if (!/^owner-artwork\/[a-f0-9-]{36}(\/[a-zA-Z0-9.-]+)?$/.test(path))
    throw new Error('Unexpected test path.');
  return join(directory, path);
};
export const original = await sharp({
  create: { width: 1200, height: 1400, channels: 3, background: '#294535' },
})
  .png()
  .toBuffer();
export let storageWrites = 0;
export const storage: PrivateArtworkStorage = {
  namespace: 'test-private-bucket',
  assertPrivate: async () => {
    if (process.env.OMS_ARTWORK_FIXTURE_PUBLIC === 'true')
      throw new Error('Fixture public bucket.');
  },
  authorize: async (path) => {
    await mkdir(join(pathFor(path), '..'), { recursive: true });
    await writeFile(pathFor(path), original);
    return 'https://storage.example.test/signed-upload-fixture';
  },
  read: (path) => readFile(pathFor(path)),
  downloadUrl: async (path) => {
    await readFile(pathFor(path));
    return 'https://storage.example.test/private-download-fixture';
  },
  write: async (path, bytes) => {
    storageWrites += 1;
    await mkdir(join(pathFor(path), '..'), { recursive: true });
    await writeFile(pathFor(path), bytes);
  },
  removeFolder: (path) => rm(pathFor(path), { force: true, recursive: true }),
};
export const service = createCollectionArtworkService(
  () => storage,
  () => new Date(process.env.OMS_ARTWORK_FIXTURE_NOW ?? '2026-09-10T12:00:00.000Z')
);
