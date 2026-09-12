import sharp from 'sharp';
import { dataUrlToBuffer, supportsTransparentBackground } from './openai-design-provider.js';

export type PrintPreparation = {
  imageUrl: string;
  transparentUrl?: string;
  status: 'transparent' | 'removed' | 'required' | 'failed';
  provider: 'openai' | 'none';
  message: string;
};

export async function prepareArtworkForPrint(params: {
  imageUrl: string;
  model: string;
}): Promise<PrintPreparation> {
  let transparent = false;
  if (supportsTransparentBackground(params.model)) {
    const decoded = dataUrlToBuffer(params.imageUrl);
    if (decoded?.contentType === 'image/png') {
      try {
        const input = sharp(decoded.buffer, { limitInputPixels: 40_000_000 });
        const metadata = await input.metadata();
        const stats = await input.stats();
        transparent = Boolean(metadata.hasAlpha && (stats.channels.at(-1)?.min ?? 255) < 255);
      } catch {
        transparent = false;
      }
    }
  }
  if (transparent) {
    return {
      imageUrl: params.imageUrl,
      transparentUrl: params.imageUrl,
      status: 'transparent',
      provider: 'openai',
      message: 'The image model supplied a transparent PNG.',
    };
  }

  return {
    imageUrl: params.imageUrl,
    status: 'required',
    provider: 'none',
    message:
      'A transparent print file has not been verified. Try again or upload a transparent PNG. No external background-removal service is used.',
  };
}
