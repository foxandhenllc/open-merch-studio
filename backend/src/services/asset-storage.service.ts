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

export async function createPrivateUploadUrl(path: string): Promise<string> {
  const { data, error } = await storageClient()
    .storage.from(env.supabaseUploadBucket)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw error ?? new Error('Storage did not return an upload URL.');
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
