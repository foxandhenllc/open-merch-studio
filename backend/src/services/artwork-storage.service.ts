import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { dataUrlToBuffer } from './openai-design-provider.js';

type StorageBucketClient = {
  upload: (
    path: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean }
  ) => Promise<{ data?: { path?: string | null } | null; error?: unknown }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
};

export type ArtworkStorageClient = {
  storage: {
    from: (bucket: string) => StorageBucketClient;
  };
};

type UploadArtworkAssetParams = {
  assetId: string;
  imageUrl: string;
  bucket?: string;
  client?: ArtworkStorageClient;
};

export function canUseSupabaseArtworkStorage(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.supabaseStorageBucket);
}

function createSupabaseStorageClient(): ArtworkStorageClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Supabase Storage is not configured.');
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function uploadArtworkAsset({
  assetId,
  imageUrl,
  bucket = env.supabaseStorageBucket,
  client = createSupabaseStorageClient(),
}: UploadArtworkAssetParams): Promise<{ path: string; publicUrl: string }> {
  const decoded = dataUrlToBuffer(imageUrl);
  if (!decoded) {
    throw new Error('Only data URL artwork can be uploaded to Supabase Storage.');
  }

  const extension = decoded.contentType === 'image/svg+xml' ? 'svg' : 'png';
  const path = `design-assets/${assetId}.${extension}`;
  const store = client.storage.from(bucket);
  const { error } = await store.upload(path, decoded.buffer, {
    contentType: decoded.contentType,
    upsert: true,
  });
  if (error) {
    const message = error instanceof Error ? error.message : 'Supabase artwork upload failed.';
    throw new Error(message);
  }

  const configuredBase = env.supabasePublicAssetBaseUrl?.replace(/\/+$/, '');
  const publicUrl = configuredBase
    ? `${configuredBase}/${path}`
    : store.getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}

export async function durableArtworkUrl(assetId: string, imageUrl: string): Promise<string> {
  if (/^https?:\/\//.test(imageUrl) || !canUseSupabaseArtworkStorage()) {
    return imageUrl;
  }
  try {
    const uploaded = await uploadArtworkAsset({ assetId, imageUrl });
    return uploaded.publicUrl;
  } catch {
    return imageUrl;
  }
}
