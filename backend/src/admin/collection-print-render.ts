import sharp from 'sharp';
import type { CollectionPrintLayout, CollectionReview } from '@open-merch-studio/collection-drafts';
import { HttpError } from '../middleware.js';

export const PRINT_DENSITY = 300;
export function layoutPixels(
  layout: CollectionPrintLayout,
  area: CollectionReview['areas'][number]
) {
  const values = [
    layout.templateWidthInches,
    layout.templateHeightInches,
    layout.leftInches,
    layout.topInches,
  ];
  const height = (area.widthInches * area.heightPixels) / area.widthPixels;
  if (
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 48) ||
    layout.templateWidthInches < 0.25 ||
    layout.templateHeightInches < 0.25 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    area.widthInches <= 0 ||
    layout.leftInches + area.widthInches > layout.templateWidthInches + 1e-9 ||
    layout.topInches + height > layout.templateHeightInches + 1e-9
  )
    throw new HttpError(
      'Keep the entire artwork inside the template. Check its dimensions and offsets.',
      400,
      'invalid_print_layout'
    );
  const pixel = (inches: number) => Math.round(inches * PRINT_DENSITY);
  const result = {
    width: pixel(layout.templateWidthInches),
    height: pixel(layout.templateHeightInches),
    left: pixel(layout.leftInches),
    top: pixel(layout.topInches),
    artworkWidth: pixel(area.widthInches),
    artworkHeight: pixel(height),
  };
  if (result.width * result.height > 40_000_000)
    throw new HttpError(
      'This template exceeds the 40-million-pixel export limit at 300 pixels per inch.',
      400,
      'print_layout_too_large'
    );
  if (
    result.left + result.artworkWidth > result.width ||
    result.top + result.artworkHeight > result.height
  )
    throw new HttpError(
      'Move the artwork slightly inside the template to fit the output pixel grid.',
      400,
      'invalid_print_layout'
    );
  return result;
}

export async function renderCollectionPrint(
  original: Buffer,
  layout: CollectionPrintLayout,
  area: CollectionReview['areas'][number],
  preview: boolean
) {
  const pixels = layoutPixels(layout, area);
  const art = await sharp(original, { limitInputPixels: 40_000_000 })
    .rotate()
    .toColourspace('srgb')
    .resize(pixels.artworkWidth, pixels.artworkHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  const canvas = await sharp({
    create: {
      width: pixels.width,
      height: pixels.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, left: pixels.left, top: pixels.top }])
    .withMetadata({ density: PRINT_DENSITY })
    .png()
    .toBuffer();
  if (canvas.length > 20 * 1024 * 1024)
    throw new HttpError(
      'The prepared PNG exceeds 20 MB. Use a smaller template or simpler artwork.',
      413,
      'print_export_too_large'
    );
  return preview
    ? sharp(canvas)
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
    : canvas;
}
