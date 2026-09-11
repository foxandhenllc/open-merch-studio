import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../middleware.js';

const formats: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};
export async function prepareCollectionArtwork(original: Buffer, mimeType: string) {
  try {
    const metadata = await sharp(original, {
      limitInputPixels: 40_000_000,
      failOn: 'error',
    }).metadata();
    if (metadata.format !== formats[mimeType] || (metadata.pages ?? 1) !== 1)
      throw new Error('Unsupported image.');
    const normalized = await sharp(original, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .toColourspace('srgb')
      .png()
      .toBuffer({ resolveWithObject: true });
    if (normalized.data.byteLength > 20 * 1024 * 1024)
      throw new HttpError(
        'The prepared PNG exceeds 20 MB. Export a smaller original and try again.',
        413,
        'prepared_artwork_too_large'
      );
    const preview = await sharp(normalized.data)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const stats = await sharp(normalized.data).stats();
    const shortest = Math.min(normalized.info.width, normalized.info.height);
    return {
      print: normalized.data,
      preview,
      checksum: createHash('sha256').update(original).digest('hex'),
      width: normalized.info.width,
      height: normalized.info.height,
      hasTransparency: !stats.isOpaque,
      readiness: shortest < 600 ? ('blocked' as const) : ('needs_review' as const),
      readinessMessage:
        shortest < 600
          ? 'This image is too small for dependable printing. Replace it with a larger original.'
          : 'Image prepared. Review its size, placement, colors, and content on the product before publication.',
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      'Use a valid, single-frame PNG, JPEG, or WebP with at most 40 million pixels.',
      400,
      'invalid_collection_image'
    );
  }
}
