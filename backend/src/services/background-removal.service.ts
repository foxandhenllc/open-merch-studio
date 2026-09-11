import { env } from '../config/env.js';
import sharp from 'sharp';
import { dataUrlToBuffer, supportsTransparentBackground } from './openai-design-provider.js';

export type PrintPreparation = {
  imageUrl: string;
  transparentUrl?: string;
  status: 'transparent' | 'removed' | 'required' | 'failed';
  provider: 'openai' | 'remove-bg' | 'none';
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

  // Native-transparent requests do not reserve a remove.bg charge. Do not add an
  // unbudgeted provider operation when the returned file does not satisfy the contract.
  if (supportsTransparentBackground(params.model)) {
    return {
      imageUrl: params.imageUrl,
      status: 'required',
      provider: 'none',
      message:
        'The image did not include a verified transparent background. Try again or upload a transparent PNG.',
    };
  }

  if (!env.removeBgApiKey) {
    return {
      imageUrl: params.imageUrl,
      status: 'required',
      provider: 'none',
      message:
        'A transparent print file has not been verified. Configure background removal or prepare a transparent PNG.',
    };
  }

  try {
    const form = new FormData();
    form.set('size', 'auto');
    form.set('format', 'png');
    const decoded = dataUrlToBuffer(params.imageUrl);
    if (decoded) {
      form.set(
        'image_file',
        new Blob([new Uint8Array(decoded.buffer)], { type: decoded.contentType }),
        'generated-artwork.png'
      );
    } else {
      form.set('image_url', params.imageUrl);
    }
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.removeBgApiKey },
      body: form,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`remove.bg returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const transparentUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    return {
      imageUrl: params.imageUrl,
      transparentUrl,
      status: 'removed',
      provider: 'remove-bg',
      message: 'Background removed and a transparent print file is ready.',
    };
  } catch (error) {
    return {
      imageUrl: params.imageUrl,
      status: 'failed',
      provider: 'remove-bg',
      message: error instanceof Error ? error.message : 'Background removal failed.',
    };
  }
}
