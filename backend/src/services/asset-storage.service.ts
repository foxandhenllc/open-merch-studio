import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let client: SupabaseClient | null = null;

export const assetStorageConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.databaseUrl);

function storageClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Supabase Storage is not configured.');
  }
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export async function assertUploadBucketPrivate(): Promise<void> {
  const { data, error } = await storageClient().storage.getBucket(env.supabaseUploadBucket);
  if (error || !data || data.public !== false)
    throw new Error('Private upload storage is required.');
}

/** Only server-owned, flat artwork folders are accepted; errors never look like successful removal. */
export async function removePrivateArtworkFolder(prefix: string): Promise<void> {
  if (!/^owner-artwork\/[a-f0-9-]{36}$/.test(prefix)) throw new Error('Invalid artwork folder.');
  const bucket = storageClient().storage.from(env.supabaseUploadBucket);
  for (let batch = 0; batch < 10; batch += 1) {
    const { data, error } = await bucket.list(prefix, { limit: 100, offset: 0 });
    if (error || !data) throw new Error('Private artwork cleanup failed.');
    if (!data.length) return;
    if (data.some((file) => !file.id || /[\\/]/.test(file.name)))
      throw new Error('Unexpected artwork folder contents.');
    const removed = await bucket.remove(data.map((file) => `${prefix}/${file.name}`));
    if (removed.error) throw new Error('Private artwork cleanup failed.');
  }
  throw new Error('Private artwork cleanup needs another attempt.');
}

export async function createPrivateUploadUrl(path: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw error ?? new Error('Storage did not return an upload URL.');
  return data.signedUrl;
}

/** Original downloads bypass the function response limit; the bearer link expires after one minute. */
export async function createPrivateOriginalDownloadUrl(path: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .createSignedUrl(path, 60, { download: true });
  if (error || !data?.signedUrl) throw new Error('Private original download is unavailable.');
  return data.signedUrl;
}

export async function downloadPrivateAsset(path: string): Promise<Buffer> {
  const { data, error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .download(path);
  if (error || !data) throw error ?? new Error('Uploaded file is unavailable.');
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPrivateAsset(params: {
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const { error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .upload(params.path, params.buffer, {
      contentType: params.contentType,
      cacheControl: '3600',
      upsert: false,
    });
  if (error) throw error;
}

export async function uploadPublicPrintAsset(params: {
  path: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<string> {
  const bucket = storageClient().storage.from(env.supabaseStorageBucket);
  const { error } = await bucket.upload(params.path, params.buffer, {
    contentType: params.contentType ?? 'image/png',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return bucket.getPublicUrl(params.path).data.publicUrl;
}

export async function createPrivatePreviewUrl(path: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw error ?? new Error('Preview URL is unavailable.');
  return data.signedUrl;
}

export async function removeStoredAssets(params: {
  privatePaths?: string[];
  publicPaths?: string[];
}): Promise<void> {
  const removals: Promise<unknown>[] = [];
  if (params.privatePaths?.length) {
    removals.push(
      storageClient().storage.from(env.supabaseUploadBucket).remove(params.privatePaths)
    );
  }
  if (params.publicPaths?.length) {
    removals.push(
      storageClient().storage.from(env.supabaseStorageBucket).remove(params.publicPaths)
    );
  }
  await Promise.all(removals);
}
